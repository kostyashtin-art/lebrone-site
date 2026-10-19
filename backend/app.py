"""Replay-analysis API backed by the Clarity Dota replay parser."""
import bz2
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Who Ruined Replay Gateway", version="0.3.0-clarity")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])
OPENDOTA = os.getenv("OPENDOTA_BASE_URL", "https://api.opendota.com/api").rstrip("/")
PARSER_CMD = os.getenv("REPLAY_PARSER_COMMAND", "java -jar /app/clarity-worker.jar {file} {output}").strip()
MAX_REPLAY_BYTES = int(os.getenv("MAX_REPLAY_BYTES", str(512 * 1024 * 1024)))
PARSER_TIMEOUT_SECONDS = int(os.getenv("PARSER_TIMEOUT_SECONDS", "240"))


def run_clarity(replay_path: Path, output_dir: Path) -> dict:
    """Run only the administrator-configured Clarity worker command."""
    if not PARSER_CMD:
        raise HTTPException(503, "Clarity не настроен на сервере")
    cmd = [part.replace("{file}", str(replay_path)).replace("{output}", str(output_dir))
           for part in PARSER_CMD.split()]
    try:
        run = subprocess.run(cmd, cwd=str(output_dir), capture_output=True, text=True,
                             timeout=PARSER_TIMEOUT_SECONDS, check=False)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Clarity не завершил разбор за отведённое время")
    if run.returncode != 0:
        # Keep details in server logs only; don't leak local paths or stack traces to visitors.
        print("Clarity worker failed:", run.stderr[-4000:])
        raise HTTPException(502, "Clarity не смог обработать этот реплей. Попробуйте другой матч.")
    result_path = output_dir / "parsed-events.json"
    if not result_path.is_file():
        raise HTTPException(502, "Clarity завершился без результата parsed-events.json")
    try:
        return json.loads(result_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(502, "Clarity вернул некорректный JSON")


async def get_match_metadata(client: httpx.AsyncClient, match_id: str) -> dict:
    if not re.fullmatch(r"\d{5,15}", match_id):
        raise HTTPException(400, "Некорректный Match ID")
    try:
        resp = await client.get(f"{OPENDOTA}/matches/{match_id}")
    except httpx.HTTPError:
        raise HTTPException(502, "Не удалось подключиться к OpenDota")
    if resp.status_code == 404:
        raise HTTPException(404, "Матч не найден в OpenDota")
    if resp.status_code >= 400:
        raise HTTPException(502, "OpenDota временно недоступен")
    return resp.json()


@app.get("/health")
def health():
    return {"ok": True, "parser": "Clarity", "parser_configured": bool(PARSER_CMD),
            "mode": "clarity-worker" if PARSER_CMD else "metadata-only"}


@app.get("/api/replay/{match_id}")
async def replay_info(match_id: str):
    async with httpx.AsyncClient(timeout=20) as client:
        data = await get_match_metadata(client, match_id)
    available = bool(data.get("replay_url"))
    return {
        "match_id": data.get("match_id"), "duration": data.get("duration"),
        "replay_url": data.get("replay_url"), "replay_salt": data.get("replay_salt"),
        "cluster": data.get("cluster"), "available": available,
        "parser": "Clarity", "parser_configured": bool(PARSER_CMD),
        "status": "replay_available" if available else "replay_unavailable",
        "message": "Реплей найден; можно запустить Clarity." if available else
                   "OpenDota не предоставил ссылку на реплей для этого матча."
    }


@app.post("/api/replay/parse-upload")
async def parse_upload(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".dem"):
        raise HTTPException(400, "Загрузите файл реплея .dem")
    with tempfile.TemporaryDirectory(prefix="who-ruined-") as td:
        root = Path(td)
        path = root / "match.dem"
        size = 0
        with path.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_REPLAY_BYTES:
                    raise HTTPException(413, "Реплей превышает установленный лимит размера")
                out.write(chunk)
        result = run_clarity(path, root)
        return {"status": "parsed", "source": "uploaded_replay", "result": result}


@app.post("/api/replay/parse-match/{match_id}")
async def parse_match(match_id: str):
    """Download a publicly available OpenDota replay and parse it with Clarity."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=15), follow_redirects=True) as client:
        data = await get_match_metadata(client, match_id)
        replay_url = data.get("replay_url")
        if not replay_url:
            raise HTTPException(409, "Для этого матча OpenDota не предоставляет реплей. Попробуйте загрузить .dem вручную.")
        parsed_url = urlparse(replay_url)
        if parsed_url.scheme not in {"http", "https"} or not (parsed_url.hostname or "").endswith(".valve.net"):
            raise HTTPException(502, "OpenDota вернул неизвестный адрес реплея; загрузка заблокирована для безопасности.")
        try:
            download = await client.get(replay_url)
        except httpx.HTTPError:
            raise HTTPException(502, "Не удалось скачать реплей с сервера Dota 2")
        if download.status_code >= 400 or not download.content:
            raise HTTPException(502, "Сервер реплеев не отдал файл. Попробуйте загрузить .dem вручную.")
        if len(download.content) > MAX_REPLAY_BYTES:
            raise HTTPException(413, "Сжатый реплей превышает установленный лимит размера")
        with tempfile.TemporaryDirectory(prefix="who-ruined-match-") as td:
            root = Path(td)
            compressed = download.content
            # OpenDota replay URLs commonly return bzip2-compressed .dem files.
            if compressed[:3] == b"BZh":
                try:
                    raw = bz2.decompress(compressed)
                except (OSError, EOFError) as exc:
                    print("Replay decompression failed:", str(exc))
                    raise HTTPException(502, "Не удалось распаковать реплей")
            else:
                raw = compressed
            if len(raw) > MAX_REPLAY_BYTES:
                raise HTTPException(413, "Распакованный реплей превышает установленный лимит размера")
            replay_path = root / "match.dem"
            replay_path.write_bytes(raw)
            result = run_clarity(replay_path, root)
            return {"status": "parsed", "source": "opendota_replay", "match_id": int(match_id),
                    "result": result}
