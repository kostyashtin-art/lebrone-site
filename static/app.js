
const form = document.getElementById('analyze-form');
const matchInput = document.getElementById('match-id');
const fileInput = document.getElementById('replay-file');
const fileName = document.getElementById('file-name');
const statusBox = document.getElementById('status');
const errorBox = document.getElementById('error');
const results = document.getElementById('results');
const button = document.getElementById('analyze-button');

// Показываем выбранный файл
fileInput.addEventListener('change', () => {
  fileName.textContent = fileInput.files[0]
    ? fileInput.files[0].name
    : 'Нажми, чтобы выбрать файл на компьютере';
});

// Отображение ошибки
function showError(message, details = '') {
  errorBox.classList.remove('hidden');
  errorBox.textContent = message + (details ? ' ' + details : '');
}

// Скрытие предыдущих результатов
function hideOld() {
  errorBox.classList.add('hidden');
  results.classList.add('hidden');
  statusBox.classList.remove('hidden');
}

// Форматирование чисел
function fmt(n) {
  if (n === null || n === undefined || n === '') {
    return '—';
  }

  const number = Number(n);
  return Number.isFinite(number)
    ? number.toLocaleString('ru-RU')
    : '—';
}

// Безопасное отображение текста
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// Строка игрока
function renderPlayer(p) {
  const isDire = String(p.team || '')
    .toLowerCase()
    .includes('dire');

  const teamLabel = isDire ? 'DIRE' : 'RADIANT';
  const chip = `<span class="team-chip ${isDire ? 'd' : 'r'}">${teamLabel}</span>`;

  return `
    <tr>
      <td>${chip}</td>
      <td>${escapeHtml(p.hero || '—')}</td>
      <td>${escapeHtml(p.name || '—')}</td>
      <td>${fmt(p.kills)}</td>
      <td>${fmt(p.deaths)}</td>
      <td>${fmt(p.assists)}</td>
      <td>${fmt(p.last_hits)}</td>
      <td>${fmt(p.gpm)}</td>
      <td>${fmt(p.net_worth)}</td>
      <td>${fmt(p.hero_damage)}</td>
    </tr>
  `;
}

// Отображение результатов
function render(data) {
  document.getElementById('match-meta').textContent =
    `Match ID: ${data.match_id ?? '—'} · Файл: ${data.source_file || 'replay.dem'}`;

  document.getElementById('radiant-score').textContent =
    data.radiant_score ?? '—';

  document.getElementById('dire-score').textContent =
    data.dire_score ?? '—';

  document.getElementById('match-duration').textContent =
    data.duration || '—';

  document.getElementById('winner-banner').textContent =
    data.winner === 'Unknown' || !data.winner
      ? 'Победитель не определён по извлечённым данным.'
      : `Победитель по данным повтора: ${
          data.winner === 'Radiant'
            ? 'Силы Света (Radiant)'
            : 'Силы Тьмы (Dire)'
        }.`;

  const tbody = document.getElementById('players-body');

  tbody.innerHTML = (data.players || []).map(renderPlayer).join('')
    || '<tr><td colspan="10">Парсер не вернул список игроков.</td></tr>';

  const downloadLink = document.getElementById('download-json');
  downloadLink.href = data.report_json || '#';

  results.classList.remove('hidden');
  results.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

// Отправка запроса на сервер
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const matchId = matchInput.value.trim();
  const replayFile = fileInput.files[0];

  if (!matchId && !replayFile) {
    showError('Введи Match ID или выбери файл .dem.');
    return;
  }

  if (replayFile && !replayFile.name.toLowerCase().endsWith('.dem')) {
    showError('Выбери файл повтора с расширением .dem.');
    return;
  }

  hideOld();
  button.disabled = true;

  document.getElementById('status-title').textContent =
    'Обрабатываем повтор…';

  document.getElementById('status-text').textContent =
    'Скачивание и разбор могут занять несколько минут. Не закрывай страницу.';

  const data = new FormData();
  data.append('match_id', matchId);

  if (replayFile) {
    data.append('replay', replayFile);
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: data
    });

    // Сначала читаем текст: сервер может вернуть не JSON, а HTML-страницу ошибки
    const responseText = await response.text();

    let payload;

    try {
      payload = JSON.parse(responseText);
    } catch {
      console.error(
        'Сервер вернул ответ не в формате JSON:',
        response.status,
        responseText
      );

      throw new Error(
        `Сервер вернул некорректный ответ (HTTP ${response.status}). Проверь Logs на Render.`
      );
    }

    statusBox.classList.add('hidden');

    if (!response.ok) {
      const message = payload.error || 'Не удалось обработать матч.';
      const details = payload.details || payload.hint || '';

      console.error('Ошибка API:', response.status, payload);
      showError(`${message} (HTTP ${response.status}).`, details);
      return;
    }

    render(payload);

  } catch (error) {
    statusBox.classList.add('hidden');

    console.error('Dota Replay Analyzer — ошибка запроса:', error);

    showError(
      'Не удалось получить корректный ответ от сервера.',
      error.message || String(error)
    );

  } finally {
    button.disabled = false;
  }
});
