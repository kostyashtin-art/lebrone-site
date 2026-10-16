from pathlib import Path
import os
import re
import traceback

from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
REPLAY_DIR = BASE_DIR / "replays"
REPORT_DIR = BASE_DIR / "reports"
REPLAY_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024  # replay files can be large
ALLOWED_EXTENSIONS = {".dem"}

def safe_int(value, default=0):
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
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
    hero_name = get_attr(player, "hero_name", "hero", default="Unknown hero")
    if not isinstance(hero_name, str):
        hero_name = str(hero_name)
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
    players_raw = get_attr(match, "players", default=[]) or []
    players = [player_to_dict(p, i) for i, p in enumerate(players_raw)]
    duration = safe_int(get_attr(match, "duration_s", "duration", default=0))
    radiant_score = safe_int(get_attr(match, "radiant_score", default=0))
    dire_score = safe_int(get_attr(match, "dire_score", default=0))
    radiant_win = get_attr(match, "radiant_win", default=None)
    if radiant_win is None and radiant_score != dire_score:
        radiant_win = radiant_score > dire_score

    # Derive teams from player team fields when parser labels are available.
    radiant_players = []
    dire_players = []
    for p in players:
        team = p["team"].lower()
        if "dire" in team:
            dire_players.append(p)
        elif "radiant" in team:
            radiant_players.append(p)
    if not radiant_players and len(players) >= 10:
        radiant_players = players[:5]
        dire_players = players[5:10]
        for p in radiant_players:
            p["team"] = "Radiant"
        for p in dire_players:
            p["team"] = "Dire"

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
    try:
        import gem
    except ImportError as exc:
        raise RuntimeError("Не найден gem-dota. Установи зависимости командой install.bat.") from exc
    match = gem.parse(str(path))
    result = summarize_match(match, match_id)
    # Store parser-generated JSON when available, so raw parsed data can be inspected later.
    try:
        from gem import to_json
        raw_json = to_json(match)
        if isinstance(raw_json, str):
            (REPORT_DIR / f"{result['match_id']}.json").write_text(raw_json, encoding="utf-8")
    except Exception:
        pass
    return result

@app.get("/")
def index():
    return render_template("index.html")

@app.post("/api/analyze")
def analyze():
    match_id = (request.form.get("match_id") or "").strip()
    upload = request.files.get("replay")
    replay_path = None

    if upload and upload.filename:
        filename = secure_filename(upload.filename)
        if Path(filename).suffix.lower() != ".dem":
            return jsonify({"error": "Поддерживается только файл повтора .dem"}), 400
        replay_path = REPLAY_DIR / filename
        upload.save(replay_path)
        match_id = match_id or Path(filename).stem
    else:
        if not match_id:
            return jsonify({"error": "Вставь Match ID или выбери файл .dem."}), 400
        if not re.fullmatch(r"\d{5,20}", match_id):
            return jsonify({"error": "Match ID должен состоять из цифр."}), 400
        try:
            import gem
            # gem.fetch_replay downloads and decompresses an available replay through OpenDota.
            fetched = gem.fetch_replay(match_id, str(REPLAY_DIR))
            if fetched:
                replay_path = Path(fetched)
            else:
                candidates = sorted(REPLAY_DIR.glob(f"{match_id}*.dem"), key=lambda p: p.stat().st_mtime, reverse=True)
                replay_path = candidates[0] if candidates else None
            if replay_path and not replay_path.is_absolute():
                replay_path = (BASE_DIR / replay_path).resolve()
            if not replay_path or not replay_path.exists():
                candidates = sorted(REPLAY_DIR.glob("*.dem"), key=lambda p: p.stat().st_mtime, reverse=True)
                replay_path = candidates[0] if candidates else None
            if not replay_path or not replay_path.exists():
                return jsonify({"error": "Повтор не найден после запроса. Возможно, он уже недоступен у источника или Match ID не поддерживается."}), 404
        except Exception as exc:
            return jsonify({"error": "Не удалось автоматически скачать повтор. " + str(exc)}), 502

    try:
        result = parse_dem(replay_path, match_id)
        result["source_file"] = replay_path.name
        result["report_json"] = f"/reports/{secure_filename(str(result['match_id']))}.json"
        return jsonify(result)
    except Exception as exc:
        traceback.print_exc()
        return jsonify({
            "error": "Файл найден, но парсер не смог завершить разбор.",
            "details": str(exc),
            "hint": "Проверь версию Python и зависимости. Некоторые повторы могут быть повреждены или несовместимы."
        }), 500

@app.get("/reports/<path:filename>")
def get_report(filename):
    return send_from_directory(REPORT_DIR, filename, as_attachment=True)

@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "Файл превышает лимит загрузки 1 ГБ."}), 413

if __name__ == "__main__":
    print("Dota Replay Analyzer: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
