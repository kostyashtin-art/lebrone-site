const form = document.getElementById('analyze-form');
const matchInput = document.getElementById('match-id');
const fileInput = document.getElementById('replay-file');
const fileName = document.getElementById('file-name');
const statusBox = document.getElementById('status');
const errorBox = document.getElementById('error');
const results = document.getElementById('results');
const button = document.getElementById('analyze-button');
let pollTimer = null;

fileInput.addEventListener('change', () => {
  fileName.textContent = fileInput.files[0]
    ? fileInput.files[0].name
    : 'Нажми, чтобы выбрать файл на компьютере';
});

function showError(message, details = '') {
  errorBox.classList.remove('hidden');
  errorBox.textContent = message + (details ? ' ' + details : '');
}

function hideOld() {
  errorBox.classList.add('hidden');
  results.classList.add('hidden');
  statusBox.classList.remove('hidden');
}

function fmt(n) {
  if (n === null || n === undefined || n === '') return '—';
  const number = Number(n);
  return Number.isFinite(number) ? number.toLocaleString('ru-RU') : '—';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderPlayer(p) {
  const isDire = String(p.team || '').toLowerCase().includes('dire');
  const teamLabel = isDire ? 'DIRE' : 'RADIANT';
  const chip = `<span class="team-chip ${isDire ? 'd' : 'r'}">${teamLabel}</span>`;
  return `<tr><td>${chip}</td><td>${escapeHtml(p.hero || '—')}</td><td>${escapeHtml(p.name || '—')}</td><td>${fmt(p.kills)}</td><td>${fmt(p.deaths)}</td><td>${fmt(p.assists)}</td><td>${fmt(p.last_hits)}</td><td>${fmt(p.gpm)}</td><td>${fmt(p.net_worth)}</td><td>${fmt(p.hero_damage)}</td></tr>`;
}

function render(data) {
  document.getElementById('match-meta').textContent = `Match ID: ${data.match_id ?? '—'} · Файл: ${data.source_file || 'replay.dem'}`;
  document.getElementById('radiant-score').textContent = data.radiant_score ?? '—';
  document.getElementById('dire-score').textContent = data.dire_score ?? '—';
  document.getElementById('match-duration').textContent = data.duration || '—';
  document.getElementById('winner-banner').textContent =
    data.winner === 'Unknown' || !data.winner
      ? 'Победитель не определён по извлечённым данным.'
      : `Победитель по данным повтора: ${data.winner === 'Radiant' ? 'Силы Света (Radiant)' : 'Силы Тьмы (Dire)'}.`;
  const tbody = document.getElementById('players-body');
  tbody.innerHTML = (data.players || []).map(renderPlayer).join('')
    || '<tr><td colspan="10">Парсер не вернул список игроков.</td></tr>';
  document.getElementById('download-json').href = data.report_json || '#';
  statusBox.classList.add('hidden');
  results.classList.remove('hidden');
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setProgress(task) {
  document.getElementById('status-title').textContent = task.message || 'Обрабатываем повтор…';
  const pct = Number(task.progress || 0);
  document.getElementById('status-text').textContent =
    `${task.message || 'Обработка…'}${pct ? ` (${pct}%)` : ''} Не закрывай страницу.`;
}

async function pollTask(taskId) {
  try {
    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { cache: 'no-store' });
    const task = await response.json();
    if (!response.ok) throw new Error(task.error || `Ошибка проверки задачи: HTTP ${response.status}`);

    if (task.status === 'completed') {
      render(task.result);
      return;
    }
    if (task.status === 'failed') {
      statusBox.classList.add('hidden');
      showError(task.error || 'Не удалось завершить анализ.', task.hint || '');
      return;
    }

    setProgress(task);
    pollTimer = setTimeout(() => pollTask(taskId), 2500);
  } catch (error) {
    statusBox.classList.add('hidden');
    showError('Не удалось проверить состояние анализа.', error.message || String(error));
    button.disabled = false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pollTimer) clearTimeout(pollTimer);

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
  document.getElementById('status-title').textContent = 'Создаём задачу анализа…';
  document.getElementById('status-text').textContent = 'Сначала получим повтор, затем разберём игровые данные. Это может занять несколько минут.';

  const data = new FormData();
  data.append('match_id', matchId);
  if (replayFile) data.append('replay', replayFile);

  try {
    const response = await fetch('/api/analyze', { method: 'POST', body: data });
    const payload = await response.json();
    if (!response.ok) {
      statusBox.classList.add('hidden');
      showError(payload.error || 'Не удалось создать задачу.', payload.details || payload.hint || '');
      button.disabled = false;
      return;
    }
    setProgress(payload);
    pollTask(payload.task_id);
  } catch (error) {
    statusBox.classList.add('hidden');
    showError('Не удалось связаться с сервером приложения.', error.message || String(error));
    button.disabled = false;
  }
});
