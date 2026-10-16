
from pathlib import Path
import os
import re
import sys
import json
import traceback
import subprocess

from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
REPLAY_DIR = BASE_DIR / "replays"
REPORT_DIR = BASE_DIR / "reports"

REPLAY_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)

app = Flask(__name__)

# Ограничение размера загружаемого файла: 1 ГБ
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024

ALLOWED_EXTENSIONS = {".dem"}
PARSE_TIMEOUT = 600


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
    hero_name = get_attr(
        player, "hero_name", "hero", default="Unknown hero"
    )

    hero_name = str(hero_name)

    return {
        "slot": index + 1,
        "name": str(
            get_attr(
                player, "name", "player_name",
                default=f"Player {index + 1}"
            ) or f"Player {index + 1}"
        ),
        "hero": hero_name.replace(
            "npc_dota_hero_", ""
        ).replace("_", " ").title(),
        "team": str(get_attr(player, "team", "team_name", default="Unknown")),
        "kills": safe_int(get_attr(player, "kills", default=0)),
        "deaths": safe_int(get_attr(player, "deaths", default=0)),
        "assists": safe_int(get_attr(player, "assists", default=0)),
        "last_hits": safe_int(
            get_attr(player, "last_hits", "last_hits_total", default=0)
        ),
        "denies": safe_int(get_attr(player, "denies", default=0)),
        "gpm": safe_int(get_attr(player, "gpm", "gold_per_min", default=0)),
        "xpm": safe_int(get_attr(player, "xpm", "xp_per_min", default=0)),
        "net_worth": safe_int(
            get_attr(player, "net_worth", "final_net_worth", default=0)
        ),
        "hero_damage": safe_int(
            get_attr(player, "hero_damage", default=0)
        ),
        "tower_damage": safe_int(
            get_attr(player, "tower_damage", default=0)
        ),
    }


def summarize_match(match, match_id=None):
    players_raw = get_attr(match, "players", default=[]) or []
    players = [
        player_to_dict(player, i)
        for i, player in enumerate(players_raw)
    ]

    duration = safe_int(
        get_attr(match, "duration_s", "duration", default=0)
    )
    radiant_score = safe_int(
        get_attr(match, "radiant_score", default=0)
    )
    dire_score = safe_int(
        get_attr(match, "dire_score", default=0)
    )

    radiant_win = get_attr(match, "radiant_win", default=None)

    if radiant_win is None and radiant_score != dire_score:
        radiant_win = radiant_score > dire_score

    radiant_players = []
    dire_players = []

    for player in players:
        team = player["team"].lower()

        if "dire" in team:
            dire_players.append(player)
        elif "radiant" in team:
            radiant_players.append(player)

    if not radiant_players and len(players) >= 10:
        radiant_players = players[:5]
        dire_players = players[5:10]

        for player in radiant_players:
            player["team"] = "Radiant"

        for player in dire_players:
            player["team"] = "Dire"

    return {
        "match_id": str(
            match_id or get_attr(match, "match_id", default="Unknown")
        ),
        "duration_s": duration,
        "duration": (
            f"{duration // 60}:{duration % 60:02d}"
            if duration else "—"
        ),
        "radiant_score": radiant_score,
        "dire_score": dire_score,
        "radiant_win": radiant_win,
        "winner": (
            "Radiant" if radiant_win else "Dire"
        ) if radiant_win is not None else "Unknown",
        "players": players,
        "radiant_players": radiant_players,
        "dire_players": dire_players,
        "parse_error": get_attr(match, "parse_error", default=None),
        "truncated_at_tick": get_attr(
            match, "truncated_at_tick", default=None
        ),
    }


def parse_dem(path, match_id=None):
    import gem

    try:
        match = gem.parse(str(path))
    except SystemExit as exc:
        raise RuntimeError(
            f"Парсер gem-dota аварийно завершился: {exc}"
        ) from exc

    return summarize_match(match, match_id)


def parse_worker(path, match_id):
    """Запускает парсер в отдельном процессе."""
    try:
        result = parse_dem(path, match_id)

        report_path = REPORT_DIR / (
            secure_filename(str(result["match_id"])) + ".json"
        )

        report_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

        print(json.dumps({
            "ok": True,
            "result": result
        }, ensure_ascii=False))

        return 0

    except BaseException as exc:
        # Этот обработчик работает только внутри отдельного процесса.
        print(json.dumps({
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
            "traceback": traceback.format_exc()
        }, ensure_ascii=False))
        return 1


def download_replay(match_id):
    import gem

    fetched = gem.fetch_replay(match_id, str(REPLAY_DIR))

    if fetched:
        path = Path(fetched)

        if not path.is_absolute():
            path = (BASE_DIR / path).resolve()

        if path.is_file() and path.suffix.lower() == ".dem":
            return path

    # Ищем только файл, соответствующий указанному матчу.
    candidates = sorted(
        REPLAY_DIR.glob(f"{match_id}*.dem"),
        key=lambda path: path.stat().st_mtime,
        reverse=True
    )

    return candidates[0] if candidates else None


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
    replay_path = None

    if upload and upload.filename:
        filename = secure_filename(upload.filename)

        if Path(filename).suffix.lower() != ".dem":
            return jsonify({
                "error": "Поддерживается только файл повтора .dem"
            }), 400

        # Уникальное имя предотвращает перезапись другого загруженного файла.
        import uuid
        replay_path = REPLAY_DIR / f"{uuid.uuid4().hex}.dem"
        upload.save(replay_path)

        if not match_id:
            match_id = Path(filename).stem

    else:
        if not match_id:
            return jsonify({
                "error": "Вставь Match ID или выбери файл .dem."
            }), 400

        if not re.fullmatch(r"\d{5,20}", match_id):
            return jsonify({
                "error": "Match ID должен состоять из цифр."
            }), 400

        try:
            replay_path = download_replay(match_id)

        except Exception as exc:
            traceback.print_exc()
            return jsonify({
                "error": "Не удалось скачать повтор.",
                "details": str(exc),
                "hint": "Проверь доступность источника повтора и логи Render."
            }), 502

        if not replay_path or not replay_path.is_file():
            return jsonify({
                "error": "Повтор этого матча не найден.",
                "details": f"Match ID: {match_id}",
                "hint": "Попробуй загрузить файл .dem вручную."
            }), 404

    try:
        # gem.parse выполняется отдельно от веб-процесса Gunicorn.
        completed = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve()),
                "--parse-worker",
                str(replay_path.resolve()),
                match_id
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=PARSE_TIMEOUT,
            cwd=str(BASE_DIR)
        )

        output = completed.stdout.strip()

        if not output:
            print("Parser stderr:", completed.stderr[-5000:])
            return jsonify({
                "error": "Парсер завершился без результата.",
                "details": completed.stderr[-2000:],
                "hint": "Проверь логи Render и доступную память."
            }), 500

        try:
            worker_result = json.loads(output.splitlines()[-1])
        except json.JSONDecodeError:
            print("Invalid parser output:", output[-5000:])
            print("Parser stderr:", completed.stderr[-5000:])
            return jsonify({
                "error": "Парсер вернул некорректный результат.",
                "hint": "Подробности находятся в Logs на Render."
            }), 500

        if completed.returncode != 0 or not worker_result.get("ok"):
            print("Parser error:", output[-5000:])
            print("Parser stderr:", completed.stderr[-5000:])

            return jsonify({
                "error": "Не удалось разобрать повтор.",
                "details": worker_result.get("error", "Неизвестная ошибка"),
                "hint": "Проверь совместимость повтора и gem-dota."
            }), 500

        result = worker_result["result"]
        result["source_file"] = replay_path.name
        result["report_json"] = (
            "/reports/" +
            secure_filename(str(result["match_id"])) +
            ".json"
        )

        return jsonify(result)

    except subprocess.TimeoutExpired:
        return jsonify({
            "error": "Разбор превысил лимит времени.",
            "details": f"Лимит: {PARSE_TIMEOUT} секунд.",
            "hint": "Повтор может быть слишком большим или сложным для сервера."
        }), 504

    except Exception as exc:
        traceback.print_exc()
        return jsonify({
            "error": "Ошибка при обработке повтора.",
            "details": str(exc)
        }), 500


@app.get("/reports/<path:filename>")
def get_report(filename):
    return send_from_directory(
        REPORT_DIR,
        filename,
        as_attachment=True
    )


@app.errorhandler(413)
def too_large(_):
    return jsonify({
        "error": "Файл превышает лимит загрузки 1 ГБ."
    }), 413


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--parse-worker":
        replay = sys.argv[2]
        match = sys.argv[3] if len(sys.argv) >= 4 else None
        sys.exit(parse_worker(replay, match))

    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
