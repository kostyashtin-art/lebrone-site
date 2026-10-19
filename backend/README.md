# Who Ruined — Clarity Replay Gateway

FastAPI gateway + Java 17 worker using the open-source Clarity parser.

## What is connected

- `GET /health` — reports whether the Clarity worker command is configured.
- `GET /api/replay/{match_id}` — checks OpenDota metadata for a replay URL.
- `POST /api/replay/parse-match/{match_id}` — downloads an available replay from the OpenDota `replay_url`, decompresses it when it is BZip2, and parses its combat log with Clarity.
- `POST /api/replay/parse-upload` — parses an uploaded `.dem` file.

The worker returns `parsed-events.json` containing normalized combat-log events (game time, event type, attacker, target, ability/inflictor, value, location, and attacker team). It caps the returned list at 100,000 events and reports if the list was truncated.

## Deploy with Docker

Build with the **backend directory as the build context**:

```bash
docker build -t who-ruined-clarity .
docker run --rm -p 8000:8000 who-ruined-clarity
```

The Dockerfile builds the Java worker using Maven and Java 17, then copies the packaged JAR into the Python API image. The default parser command is configured automatically. For a hosted service, deploy this Dockerfile on a container-capable host and point the frontend/API calls at that backend. GitHub Pages alone cannot run Java or Python.

## Local development

Requires Python 3.12, Java 17, and Maven. Build the worker first:

```bash
cd clarity-worker
mvn -DskipTests package
cd ..
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Set `REPLAY_PARSER_COMMAND` only if you intentionally want to override the bundled worker. It is an administrator-controlled command template; never expose a user-editable command.

## Limits / notes

- OpenDota may not have a replay URL for every match; the API returns a clear error in that case.
- A replay can be very large. `MAX_REPLAY_BYTES` defaults to 512 MiB for both compressed and expanded data; `PARSER_TIMEOUT_SECONDS` defaults to 240 seconds.
- This is an initial integration: Clarity combat-log events are parsed, but higher-level coaching insights, net-worth timeline reconstruction, secure authentication, queueing, persistent storage, and rate limiting still need implementation before a public production deployment.
- Keep the backend private or rate-limited until authentication, queueing, request limits, and storage lifecycle are configured.

Clarity is an open-source parser: https://github.com/skadistats/clarity


## Подключение к фронтенду

На сайте в блоке «Полный разбор реплея · Clarity» укажите публичный HTTPS URL этого API и нажмите «Сохранить адрес». Кнопка проверит `/health`; затем выберите Match ID в основном поле сайта и нажмите «Разобрать этот Match ID». На сервере установите `CORS_ORIGINS` в точный origin сайта (например, `https://kostyashtin-art.github.io`) вместо `*` перед публичным использованием.
