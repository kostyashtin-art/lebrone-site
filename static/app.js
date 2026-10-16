const form = document.getElementById('analyze-form');
const matchInput = document.getElementById('match-id');
const fileInput = document.getElementById('replay-file');
const fileName = document.getElementById('file-name');
const statusBox = document.getElementById('status');
const errorBox = document.getElementById('error');
const results = document.getElementById('results');
const button = document.getElementById('analyze-button');

fileInput.addEventListener('change', () => {
  fileName.textContent = fileInput.files[0] ? fileInput.files[0].name : 'Нажми, чтобы выбрать файл на компьютере';
});

function showError(message, details='') {
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
  return Number(n).toLocaleString('ru-RU');
}
function renderPlayer(p) {
  const isDire = String(p.team).toLowerCase().includes('dire');
  const teamLabel = isDire ? 'DIRE' : 'RADIANT';
  const chip = `<span class="team-chip ${isDire ? 'd' : 'r'}">${teamLabel}</span>`;
  return `<tr><td>${chip}</td><td>${escapeHtml(p.hero || '—')}</td><td>${escapeHtml(p.name || '—')}</td><td>${fmt(p.kills)}</td><td>${fmt(p.deaths)}</td><td>${fmt(p.assists)}</td><td>${fmt(p.last_hits)}</td><td>${fmt(p.gpm)}</td><td>${fmt(p.net_worth)}</td><td>${fmt(p.hero_damage)}</td></tr>`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function render(data) {
  document.getElementById('match-meta').textContent = `Match ID: ${data.match_id} · Файл: ${data.source_file || 'replay.dem'}`;
  document.getElementById('radiant-score').textContent = data.radiant_score ?? '—';
  document.getElementById('dire-score').textContent = data.dire_score ?? '—';
  document.getElementById('match-duration').textContent = data.duration || '—';
  document.getElementById('winner-banner').textContent = data.winner === 'Unknown' ? 'Победитель не определён по извлечённым данным.' : `Победитель по данным повтора: ${data.winner === 'Radiant' ? 'Силы Света (Radiant)' : 'Силы Тьмы (Dire)'}.`;
  const tbody = document.getElementById('players-body');
  tbody.innerHTML = (data.players || []).map(renderPlayer).join('') || '<tr><td colspan="10">Парсер не вернул список игроков.</td></tr>';
  document.getElementById('download-json').href = data.report_json || '#';
  results.classList.remove('hidden');
  results.scrollIntoView({behavior:'smooth',block:'start'});
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!matchInput.value.trim() && !fileInput.files.length) {
    showError('Введи Match ID или выбери файл .dem.');
    return;
  }
  hideOld();
  errorBox.classList.add('hidden');
  button.disabled = true;
  document.getElementById('status-title').textContent = 'Обрабатываем повтор…';
  document.getElementById('status-text').textContent = 'Скачивание и разбор могут занять несколько минут. Не закрывай страницу.';
  const data = new FormData();
  data.append('match_id', matchInput.value.trim());
  if (fileInput.files[0]) data.append('replay', fileInput.files[0]);
  try {
    const response = await fetch('/api/analyze', {method:'POST', body:data});
    const payload = await response.json();
    statusBox.classList.add('hidden');
    if (!response.ok) {
      showError(payload.error || 'Не удалось обработать матч.', payload.details || payload.hint || '');
      return;
    }
    render(payload);
  } catch (e) {
    statusBox.classList.add('hidden');
    showError('Не удалось связаться с сервером приложения. Проверь, что локальный сервер запущен.');
  } finally {
    button.disabled = false;
  }
});
