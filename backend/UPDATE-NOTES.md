# Replay API update — Zstandard + diagnostics

This archive contains the existing website with backend changes for the current replay investigation.

## Changes
- `backend/app.py`: detects and decompresses BZip2 and Zstandard replay payloads; logs compressed/decompressed sizes and the decompressed header.
- `backend/requirements.txt`: adds `zstandard==0.23.0`.
- `backend/clarity-worker/.../ClarityWorker.java`: prints the replay size and first 16 bytes in HEX/ASCII before Clarity starts.
- Existing Clarity dependency remains at `4.0.1`.

## Important
This is a diagnostic/update build, not a guaranteed final parser fix. The latest observed decompressed signature is `PBDEMS2`; if Clarity still rejects it, the remaining issue is parser/format compatibility and will need a compatible Clarity version or another parser.

## Deploy
1. Extract the archive.
2. Upload/commit the project files to the `main` branch of the repository.
3. Render should rebuild the backend from `backend/Dockerfile`.
4. Retest `POST /api/replay/parse-match/{match_id}` and inspect Render logs.
