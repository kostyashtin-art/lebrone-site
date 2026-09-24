import os
import json
import time
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# =========================
# НАСТРОЙКИ
# =========================

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 8080))

D2PT_URL = "https://dota2protracker.com/api/heroes/list"

# Кэш на 30 минут
CACHE_SECONDS = 1800

d2pt_cache = {
    "data": None,
    "time": 0
}


# =========================
# ЗАПРОС К DOTA2PROTRACKER
# =========================

def get_d2pt_data():
    global d2pt_cache

    # Используем кэш, если он ещё актуален
    if (
        d2pt_cache["data"] is not None
        and time.time() - d2pt_cache["time"] < CACHE_SECONDS
    ):
        return d2pt_cache["data"]

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/150.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://dota2protracker.com/",
        "Origin": "https://dota2protracker.com"
    }

    request = urllib.request.Request(
        D2PT_URL,
        headers=headers,
        method="GET"
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw)

            d2pt_cache["data"] = data
            d2pt_cache["time"] = time.time()

            return data

    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise RuntimeError(
                "Dota2ProTracker отклонил запрос (403 Cloudflare)."
            )

        raise RuntimeError(
            f"Dota2ProTracker HTTP ошибка: {e.code}"
        )

    except urllib.error.URLError as e:
        raise RuntimeError(
            f"Не удалось подключиться к Dota2ProTracker: {e.reason}"
        )

    except json.JSONDecodeError:
        raise RuntimeError(
            "Dota2ProTracker вернул некорректный JSON."
        )

    except Exception as e:
        raise RuntimeError(
            f"Ошибка Dota2ProTracker: {str(e)}"
        )


# =========================
# HTTP SERVER
# =========================

class Handler(SimpleHTTPRequestHandler):

    def end_headers(self):
        # Разрешаем запросы к API
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):

        # -------------------------
        # Dota2ProTracker API
        # -------------------------

        if self.path == "/api/d2pt/heroes":

            try:
                data = get_d2pt_data()

                # Приводим ответ к единому формату
                if isinstance(data, dict) and "heroes" in data:
                    result = data
                else:
                    result = {
                        "heroes": data
                    }

                body = json.dumps(
                    result,
                    ensure_ascii=False
                ).encode("utf-8")

                self.send_response(200)
                self.send_header(
                    "Content-Type",
                    "application/json; charset=utf-8"
                )
                self.send_header(
                    "Content-Length",
                    str(len(body))
                )
                self.end_headers()

                self.wfile.write(body)

            except Exception as e:

                body = json.dumps(
                    {
                        "error": str(e),
                        "heroes": []
                    },
                    ensure_ascii=False
                ).encode("utf-8")

                self.send_response(502)
                self.send_header(
                    "Content-Type",
                    "application/json; charset=utf-8"
                )
                self.send_header(
                    "Content-Length",
                    str(len(body))
                )
                self.end_headers()

                self.wfile.write(body)

            return

        # -------------------------
        # Обычные файлы сайта
        # -------------------------

        if self.path == "/":
            self.path = "/index.html"

        return super().do_GET()


# =========================
# ЗАПУСК
# =========================

if __name__ == "__main__":

    server = ThreadingHTTPServer(
        (HOST, PORT),
        Handler
    )

    print("=" * 60)
    print("LEBRONE MENTALLY SERVER")
    print("=" * 60)
    print(f"Server started on {HOST}:{PORT}")
    print("D2PT API: /api/d2pt/heroes")
    print("=" * 60)

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print("\nServer stopped.")

    finally:
        server.server_close()
