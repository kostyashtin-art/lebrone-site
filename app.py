from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
import traceback
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
REPLAY_DIR = BASE_DIR / "replays"
REPORT_DIR = BASE_DIR / "reports"
REPLAY_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024
PARSE_TIMEOUT_SECONDS = int(os.environ.get("PARSE_TIMEOUT_SECONDS", "600"))
DOWNLOAD_TIMEOUT_SECONDS = int(os.environ.get("DOWNLOAD_TIMEOUT_SECONDS", "180"))

# This project is configured for one Gunicorn worker on Render. Task state is
# intentionally in-memory; use a persistent queue/Redis if scaling to multiple workers.
TASKS: dict[str, dict] = {}
TASKS_LOCK = threading.Lock()
ACTIVE_JOB_LOCK = threading.Lock()
MAX_TASKS_IN_MEMORY = 40


def safe_int(value, default=0):
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError, OverflowError):
        return default


def get_attr(obj, *names, default=None):
    for name in names:
        try:
            value = getattr(obj, name)
            if value is not None:
                return value
        except Exception:
            pass
    return default


def player_to_dict(player, index):
    hero_name = str(get_attr(player, "hero_name", "hero", default="Unknown hero"))
    return {
        "slot": index + 1,
        "name": str(get_attr(player, "name", "player_name", default=f"Player {index + 1}") or f"Player {index + 1}"),
        "hero": hero_name.replace("npc_dota_hero_", "").replace("_", " ").title(),
        "team": str(get_attr(player, "team", "team_name", default="Unknown")),
        "kills": safe_int(get_attr(player, "kills", default=0)),
        "deaths": safe_int(get_attr(player, "deaths", default=0)),
        "assists": safe_int(get_attr(player, "assists", default=0)),
        "last_hits": safe_int(get_attr(player, "last_hits", "last_hits_total", default=0)),
        "denies": safe_int(get_attr(player, "denies", default=0)),
        "gpm": safe_int(get_attr(player, "gpm", "gold_per_min", default=0)),
        "xpm": safe_int(get_attr(player, "xpm", "xp_per_min", default=0)),
        "net_worth": safe_int(get_attr(player, "net_worth", "final_net_worth", default=0)),
        "hero_damage": safe_int(get_attr(player, "hero_damage", default=0)),
        "tower_damage": safe_int(get_attr(player, "tower_damage", default=0)),
    }


def summarize_match(match, match_id=None):
    raw_players = get_attr(match, "players", default=[]) or []
    players = [player_to_dict(player, i) for i, player in enumerate(raw_players)]
    duration = safe_int(get_attr(match, "duration_s", "duration", default=0))
    radiant_score = safe_int(get_attr(match, "radiant_score", default=0))
    dire_score = safe_int(get_attr(match, "dire_score", default=0))
    radiant_win = get_attr(match, "radiant_win", default=None)
    if radiant_win is None and radiant_score != dire_score:
        radiant_win = radiant_score > dire_score

    radiant_players, dire_players = [], []
    for player in players:
        team = player["team"].lower()
        if "dire" in team:
            dire_players.append(player)
        elif "radiant" in team:
            radiant_players.append(player)
    if not radiant_players and len(players) >= 10:
        radiant_players, dire_players = players[:5], players[5:10]
        for player in radiant_players:
            player["team"] = "Radiant"
        for player in dire_players:
            player["team"] = "Dire"

    return {
        "match_id": str(match_id or get_attr(match, "match_id", default="Unknown")),
        "duration_s": duration,
        "duration": f"{duration // 60}:{duration % 60:02d}" if duration else "—",
        "radiant_score": radiant_score,
        "dire_score": dire_score,
        "radiant_win": radiant_win,
        "winner": ("Radiant" if radiant_win else "Dire") if radiant_win is not None else "Unknown",
        "players": players,
        "radiant_players": radiant_players,
        "dire_players": dire_players,
        "parse_error": get_attr(match, "parse_error", default=None),
        "truncated_at_tick": get_attr(match, "truncated_at_tick", default=None),
    }


def parse_dem(path, match_id=None):
    import gem
    try:
        match = gem.parse(str(path))
    except SystemExit as exc:
        raise RuntimeError(f"Парсер gem-dota завершился с кодом: {exc}") from exc
    return summarize_match(match, match_id)


def set_task(task_id, **changes):
    with TASKS_LOCK:
        task = TASKS.get(task_id)
        if task:
            task.update(changes)
            task["updated_at"] = time.time()


def download_replay(match_id, task_id):
    set_task(task_id, status="downloading", message="Запрашиваем повтор матча…", progress=10)
    print(f"Task {task_id}: starting replay download for match {match_id}", flush=True)
    command = [sys.executable, str(Path(__file__).resolve()), "--download-worker", str(match_id)]
    try:
        completed = subprocess.run(
            command,
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=DOWNLOAD_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"Скачивание превысило лимит {DOWNLOAD_TIMEOUT_SECONDS} секунд.") from exc

    print(f"Task {task_id}: download worker exited with code {completed.returncode}", flush=True)
    lines = (completed.stdout or "").strip().splitlines()
    payload = None
    for line in reversed(lines):
        try:
            candidate = json.loads(line)
            if isinstance(candidate, dict) and "download_result" in candidate:
                payload = candidate["download_result"]
                break
        except json.JSONDecodeError:
            continue

    if completed.returncode != 0 or not payload or not payload.get("ok"):
        details = (payload or {}).get("error") or (completed.stderr or "")[-2000:] or "Источник не вернул повтор."
        raise RuntimeError(f"Не удалось скачать повтор: {details}")

    fetched = payload.get("path")
    if fetched:
        path = Path(fetched)
        if not path.is_absolute():
            path = (BASE_DIR / path).resolve()
        if path.is_file() and path.suffix.lower() == ".dem":
            return path

    candidates = sorted(
        REPLAY_DIR.glob(f"{match_id}*.dem"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def parse_child(path, match_id, task_id):
    """Run gem.parse in a separate process; child failures won't become HTTP timeouts."""
    print(f"Task {task_id}: starting parser for {Path(path).name}", flush=True)
    command = [sys.executable, str(Path(__file__).resolve()), "--parse-worker", str(path), str(match_id)]
    set_task(task_id, status="parsing", message="Повтор скачан. Разбираем игровые данные…", progress=35)
    try:
        completed = subprocess.run(
            command,
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=PARSE_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"Разбор превысил лимит {PARSE_TIMEOUT_SECONDS} секунд.") from exc

    stdout = (completed.stdout or "").strip()
    if not stdout:
        details = (completed.stderr or "")[-2500:]
        raise RuntimeError(
            "Парсер завершился без результата. Возможна нехватка памяти на Render. " + details
        )
    try:
        payload = json.loads(stdout.splitlines()[-1])
    except json.JSONDecodeError as exc:
        raise RuntimeError("Парсер вернул некорректный результат. Проверь Logs на Render.") from exc
    if completed.returncode != 0 or not payload.get("ok"):
        details = payload.get("error", "Неизвестная ошибка парсера")
        child_trace = payload.get("traceback", "")
        print(f"Replay parser failed: {details}\n{child_trace}\n{completed.stderr[-2500:]}")
        raise RuntimeError(details)
    return payload["result"]


def run_analysis(task_id, match_id, uploaded_path=None):
    # Avoid multiple heavy replay jobs exhausting the small Render instance.
    if not ACTIVE_JOB_LOCK.acquire(blocking=False):
        set_task(
            task_id, status="failed", progress=100,
            message="Сервер уже обрабатывает другой повтор.",
            error="Сейчас выполняется другой анализ. Подожди его завершения и попробуй снова.",
            hint="На бесплатном Render одновременно поддерживается один тяжёлый анализ."
        )
        if uploaded_path:
            try:
                Path(uploaded_path).unlink(missing_ok=True)
            except OSError:
                pass
        return
    try:
        print(f"Task {task_id}: background job started", flush=True)
        set_task(task_id, status="starting", message="Подготавливаем задачу…", progress=5)
        replay_path = uploaded_path
        if replay_path is None:
            if not re.fullmatch(r"\d{5,20}", match_id or ""):
                raise ValueError("Match ID должен состоять из 5–20 цифр.")
            replay_path = download_replay(match_id, task_id)
            if not replay_path or not Path(replay_path).is_file():
                raise FileNotFoundError(
                    "Повтор не найден. Возможно, он недоступен у источника. Попробуй загрузить .dem вручную."
                )
        replay_path = Path(replay_path)
        set_task(task_id, status="parsing", message="Запускаем анализ повтора…", progress=30)
        result = parse_child(replay_path, match_id or replay_path.stem, task_id)
        result["source_file"] = replay_path.name
        safe_match_id = secure_filename(str(result.get("match_id", match_id or "report"))) or "report"
        report_path = REPORT_DIR / f"{safe_match_id}.json"
        report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        result["report_json"] = f"/reports/{safe_match_id}.json"
        set_task(task_id, status="completed", message="Анализ завершён.", progress=100, result=result)
    except BaseException as exc:
        # Catch SystemExit/other BaseException in the background task to avoid silently losing task state.
        print(f"Task {task_id} failed: {type(exc).__name__}: {exc}")
        traceback.print_exc()
        set_task(
            task_id,
            status="failed",
            message="Не удалось завершить анализ.",
            progress=100,
            error=str(exc) or type(exc).__name__,
            hint="Проверь логи Render. На бесплатном тарифе может не хватать памяти для некоторых реплеев.",
        )
    finally:
        ACTIVE_JOB_LOCK.release()
        # Uploaded files can be removed after the parser has finished.
        if uploaded_path:
            try:
                Path(uploaded_path).unlink(missing_ok=True)
            except OSError:
                pass


def create_task(match_id, uploaded_path=None):
    task_id = uuid.uuid4().hex
    now = time.time()
    with TASKS_LOCK:
        # Keep memory bounded; remove old finished task metadata.
        finished = sorted(
            ((tid, task.get("updated_at", 0)) for tid, task in TASKS.items()
             if task.get("status") in {"completed", "failed"}),
            key=lambda item: item[1],
        )
        while len(TASKS) >= MAX_TASKS_IN_MEMORY and finished:
            old_id, _ = finished.pop(0)
            TASKS.pop(old_id, None)
        TASKS[task_id] = {
            "task_id": task_id,
            "status": "queued",
            "message": "Задача добавлена в очередь…",
            "progress": 2,
            "created_at": now,
            "updated_at": now,
        }
    # A daemon thread starts immediately; unlike a single-thread executor, it
    # cannot leave newly-created tasks silently queued behind a stuck old future.
    thread = threading.Thread(
        target=run_analysis,
        args=(task_id, match_id, uploaded_path),
        daemon=True,
        name=f"replay-job-{task_id[:8]}",
    )
    thread.start()
    print(f"Task {task_id}: thread started", flush=True)
    return task_id


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/analyze")
def analyze():
    match_id = (request.form.get("match_id") or "").strip()
    upload = request.files.get("replay")
    uploaded_path = None

    if upload and upload.filename:
        filename = secure_filename(upload.filename)
        if Path(filename).suffix.lower() != ".dem":
            return jsonify({"error": "Поддерживается только файл повтора .dem"}), 400
        if match_id and not re.fullmatch(r"\d{5,20}", match_id):
            return jsonify({"error": "Match ID должен состоять из цифр."}), 400
        uploaded_path = REPLAY_DIR / f"upload_{uuid.uuid4().hex}.dem"
        upload.save(uploaded_path)
        match_id = match_id or Path(filename).stem
    elif not match_id:
        return jsonify({"error": "Вставь Match ID или выбери файл .dem."}), 400
    elif not re.fullmatch(r"\d{5,20}", match_id):
        return jsonify({"error": "Match ID должен состоять из 5–20 цифр."}), 400

    try:
        task_id = create_task(match_id, str(uploaded_path) if uploaded_path else None)
    except Exception as exc:
        if uploaded_path:
            Path(uploaded_path).unlink(missing_ok=True)
        traceback.print_exc()
        return jsonify({"error": "Не удалось создать задачу анализа.", "details": str(exc)}), 500
    return jsonify({"task_id": task_id, "status": "queued", "message": "Задача создана."}), 202


@app.get("/api/tasks/<task_id>")
def task_status(task_id):
    with TASKS_LOCK:
        task = TASKS.get(task_id)
        if not task:
            return jsonify({"error": "Задача не найдена. Возможно, сервис перезапускался."}), 404
        # Copy to avoid returning a mutable shared object.
        result = dict(task)
    result.pop("created_at", None)
    result.pop("updated_at", None)
    return jsonify(result)


@app.get("/reports/<path:filename>")
def get_report(filename):
    return send_from_directory(REPORT_DIR, filename, as_attachment=True)


@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "Файл превышает лимит загрузки 1 ГБ."}), 413


def parser_worker(path, match_id):
    try:
        result = parse_dem(path, match_id)
        print(json.dumps({"ok": True, "result": result}, ensure_ascii=False), flush=True)
        return 0
    except BaseException as exc:
        print(json.dumps({
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
            "traceback": traceback.format_exc(),
        }, ensure_ascii=False), flush=True)
        return 1


def downloader_worker(match_id):
    try:
        import gem
        fetched = gem.fetch_replay(match_id, str(REPLAY_DIR))
        path = None
        if fetched:
            candidate = Path(fetched)
            if not candidate.is_absolute():
                candidate = (BASE_DIR / candidate).resolve()
            if candidate.is_file() and candidate.suffix.lower() == ".dem":
                path = str(candidate)
        print(json.dumps({"download_result": {"ok": True, "path": path}}, ensure_ascii=False), flush=True)
        return 0
    except BaseException as exc:
        print(json.dumps({"download_result": {
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
            "traceback": traceback.format_exc(),
        }}, ensure_ascii=False), flush=True)
        return 1


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--parse-worker":
        replay = sys.argv[2]
        match = sys.argv[3] if len(sys.argv) >= 4 else None
        sys.exit(parser_worker(replay, match))
    if len(sys.argv) >= 2 and sys.argv[1] == "--download-worker":
        sys.exit(downloader_worker(sys.argv[2]))
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
