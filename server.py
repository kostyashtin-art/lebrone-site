import os
import json
import time
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8080"))
BASE = "https://dota2protracker.com"
CACHE_TTL = 1800
cache = {}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    "Referer": "https://dota2protracker.com/",
    "Accept": "application/json,text/plain,*/*",
    "Origin": "https://dota2protracker.com",
}


def fetch_json(url, cache_key=None):
    now = time.time()
    if cache_key and cache_key in cache and now - cache[cache_key]["time"] < CACHE_TTL:
        return cache[cache_key]["data"]
    req = Request(url, headers=HEADERS, method="GET")
    with urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    if cache_key:
        cache[cache_key] = {"data": data, "time": now}
    return data


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def d2pt_error(self, status, message, details=""):
        return self.send_json(status, {"error": message, "details": details})

    def do_GET(self):
        parsed = urlsplit(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/d2pt/heroes":
            try:
                data = fetch_json(BASE + "/api/heroes/list", "heroes")
                if isinstance(data, list):
                    data = {"heroes": data}
                return self.send_json(200, data)
            except HTTPError as e:
                return self.d2pt_error(502, f"Dota2ProTracker HTTP {e.code}", "D2PT may return a Cloudflare challenge from datacenter IPs.")
            except URLError as e:
                return self.d2pt_error(502, "Не удалось подключиться к Dota2ProTracker", str(e.reason))
            except Exception as e:
                return self.d2pt_error(500, "Ошибка прокси", str(e))

        if path.startswith("/api/d2pt/hero/") and path.endswith("/builds"):
            parts = path.strip("/").split("/")
            if len(parts) != 5 or parts[0:3] != ["api", "d2pt", "hero"] or parts[4] != "builds":
                return self.d2pt_error(400, "Неверный URL сборки")
            hero_id = parts[3]
            position = query.get("position", ["pos 1"])[0]
            if not position.startswith("pos "):
                position = "pos " + position.replace("pos", "").strip()
            url = f"{BASE}/api/hero/{quote(hero_id, safe='')}/builds?position={quote(position, safe='') }"
            key = f"build:{hero_id}:{position}"
            try:
                data = fetch_json(url, key)
                return self.send_json(200, data)
            except HTTPError as e:
                return self.d2pt_error(502, f"D2PT build HTTP {e.code}", "D2PT may return a Cloudflare challenge from datacenter IPs.")
            except URLError as e:
                return self.d2pt_error(502, "Не удалось подключиться к Dota2ProTracker", str(e.reason))
            except Exception as e:
                return self.d2pt_error(500, "Ошибка загрузки сборки", str(e))

        if path in ("/", "/index.html"):
            try:
                body = Path(__file__).with_name("index.html").read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self.d2pt_error(500, "Не удалось отдать index.html", str(e))
            return

        self.send_error(404)


if __name__ == "__main__":
    print(f"Lebrone Mentally server listening on {HOST}:{PORT}")
    print("D2PT meta: /api/d2pt/heroes")
    print("D2PT builds: /api/d2pt/hero/<id>/builds?position=pos%201")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
