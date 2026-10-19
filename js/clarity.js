(() => {
  const $ = (id) => document.getElementById(id);
  const urlInput = $("clarityBackendUrl");
  const saveButton = $("claritySaveBackend");
  const parseButton = $("clarityParseMatch");
  const status = $("clarityStatus");
  const summary = $("claritySummary");
  const eventsBox = $("clarityEvents");
  if (!urlInput || !saveButton || !parseButton || !status || !summary || !eventsBox) return;

  const STORAGE_KEY = "whoRuinedClarityBackendUrl";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) urlInput.value = stored;

  function backendBase() {
    const raw = urlInput.value.trim();
    if (!raw) throw new Error("Сначала укажи адрес backend API.");
    let parsed;
    try { parsed = new URL(raw); } catch { throw new Error("Проверь адрес backend: нужен полный URL, например https://my-api.onrender.com."); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Адрес backend должен начинаться с http:// или https://.");
    return parsed.href.replace(/\/+$/, "");
  }

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = "clarityStatus" + (kind ? " " + kind : "");
  }

  saveButton.addEventListener("click", async () => {
    try {
      const base = backendBase();
      localStorage.setItem(STORAGE_KEY, base);
      setStatus("Проверяю соединение с backend…", "loading");
      const response = await fetch(base + "/health");
      if (!response.ok) throw new Error("Backend ответил HTTP " + response.status + ".");
      const health = await response.json();
      setStatus(health.ok
        ? "Backend доступен. Парсер: " + (health.parser || "Clarity") + (health.parser_configured ? " · команда парсера настроена." : " · команда парсера не настроена.")
        : "Backend ответил, но не подтвердил готовность.", health.ok ? "success" : "error");
    } catch (error) {
      setStatus(error.message || "Не удалось проверить backend.", "error");
    }
  });

  function valueText(value, fallback = "—") {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value);
  }

  function renderResult(payload) {
    const result = payload.result || payload;
    const events = Array.isArray(result.events) ? result.events : [];
    summary.replaceChildren();
    eventsBox.replaceChildren();
    summary.classList.remove("hidden");
    const tiles = [
      ["Матч", valueText(payload.match_id)],
      ["Событий найдено", valueText(result.events_total ?? events.length)],
      ["Показано", valueText(result.events_returned ?? events.length)],
      ["Время парсинга", result.parse_time_ms != null ? result.parse_time_ms + " мс" : "—"]
    ];
    for (const [label, value] of tiles) {
      const tile = document.createElement("div");
      const b = document.createElement("b");
      const small = document.createElement("span");
      b.textContent = value;
      small.textContent = label;
      tile.append(b, small);
      summary.append(tile);
    }
    if (!events.length) {
      const empty = document.createElement("p");
      empty.className = "clarityEmpty";
      empty.textContent = "Парсер завершился, но событий боевого лога в ответе нет.";
      eventsBox.append(empty);
      return;
    }
    const heading = document.createElement("h3");
    heading.textContent = "События боевого лога";
    eventsBox.append(heading);
    const list = document.createElement("div");
    list.className = "clarityEventList";
    events.slice(0, 250).forEach((event) => {
      const row = document.createElement("article");
      row.className = "clarityEvent";
      const time = document.createElement("strong");
      const seconds = Number(event.time);
      if (Number.isFinite(seconds)) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        time.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
      } else time.textContent = "—";
      const details = document.createElement("div");
      details.className = "clarityEventDetails";
      const title = document.createElement("b");
      title.textContent = valueText(event.type, "event").replaceAll("_", " ");
      const line = document.createElement("span");
      const actors = [event.attacker, event.target].filter(Boolean).join(" → ");
      const extra = [event.ability, event.value != null && event.value !== 0 ? "значение: " + event.value : ""].filter(Boolean).join(" · ");
      line.textContent = [actors, extra].filter(Boolean).join(" — ") || "Дополнительных данных нет";
      details.append(title, line);
      row.append(time, details);
      list.append(row);
    });
    eventsBox.append(list);
    if (events.length > 250) {
      const note = document.createElement("p");
      note.className = "clarityEmpty";
      note.textContent = `Показаны первые 250 из ${events.length} событий.`;
      eventsBox.append(note);
    }
  }

  parseButton.addEventListener("click", async () => {
    let base;
    try { base = backendBase(); }
    catch (error) { setStatus(error.message, "error"); return; }
    const matchId = $("matchId")?.value.trim();
    if (!matchId || !/^\d{5,15}$/.test(matchId)) {
      setStatus("Сначала введи корректный Match ID в поле вверху страницы.", "error");
      $("matchId")?.focus();
      return;
    }
    localStorage.setItem(STORAGE_KEY, base);
    parseButton.disabled = true;
    parseButton.textContent = "РАЗБИРАЮ РЕПЛЕЙ…";
    summary.classList.add("hidden");
    eventsBox.replaceChildren();
    setStatus("Запрашиваю реплей у OpenDota и запускаю Clarity. Это может занять несколько минут…", "loading");
    try {
      const response = await fetch(`${base}/api/replay/parse-match/${encodeURIComponent(matchId)}`, { method: "POST" });
      let data;
      try { data = await response.json(); } catch { data = {}; }
      if (!response.ok) throw new Error(data.detail || data.message || `Ошибка backend: HTTP ${response.status}`);
      renderResult(data);
      setStatus("Разбор завершён. Ниже показаны события, которые вернул Clarity.", "success");
    } catch (error) {
      const message = error instanceof TypeError
        ? "Не удалось подключиться. Проверь адрес backend, CORS и то, что сервер запущен."
        : (error.message || "Ошибка разбора реплея.");
      setStatus(message, "error");
    } finally {
      parseButton.disabled = false;
      parseButton.textContent = "РАЗОБРАТЬ ЭТОТ MATCH ID";
    }
  });
})();
