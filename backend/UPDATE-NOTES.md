# Replay parser update

## Included changes

- Supports BZip2 and Zstandard replay decompression in `app.py`.
- Streams Clarity combat-log events directly into `parsed-events.json` using Gson `JsonWriter` instead of building one large in-memory `JsonArray`.
- Keeps the existing response keys (`parser`, `parser_version`, `event_type`, `events_total`, `events_returned`, `truncated`, `parse_time_ms`, `events`). The JSON property order changed, which is valid JSON and does not affect clients.
- Returns up to 100,000 events, while continuing to count total events beyond the output limit.
- Sets Java heap maximum to 512 MiB. Adjust only if the Render instance has a compatible memory limit.

## Deploy

Render configuration should use:
- Root Directory: `backend`
- Dockerfile Path: `./Dockerfile`
- Docker Build Context Directory: `.`

Commit the archive contents to the repository and wait for Render to become Live before testing `POST /api/replay/parse-match/{match_id}`.

## Limitations

Streaming reduces memory used to serialize JSON; it does not guarantee lower memory use inside Clarity itself. Player/hero names may still be unknown for some combat-log entries because this worker currently adapts only combat-log fields and does not yet build a player/entity lookup table from replay string tables.
