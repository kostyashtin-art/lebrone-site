const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OPENDOTA = "https://api.opendota.com/api";

const PLAYERS = [
  { name: "Артем", accountId: 127394881 },
  { name: "Ильшат", accountId: 1585608718 },
  { name: "Костя", accountId: 129692343 },
  { name: "Кирилл", accountId: 421012634 },
  { name: "Инсаф", accountId: 237813481 }
];

const INITIAL_SYNC_DAYS = Number(process.env.INITIAL_SYNC_DAYS || 730);
const INCREMENTAL_SYNC_DAYS = Number(process.env.INCREMENTAL_SYNC_DAYS || 30);
const PAGE_SIZE = Math.min(100, Math.max(20, Number(process.env.PAGE_SIZE || 100)));
const DETAIL_DELAY_MS = Math.max(250, Number(process.env.DETAIL_DELAY_MS || 500));
const REQUEST_TIMEOUT_MS = 20000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const sbHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json"
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, headers: options.headers || undefined });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${typeof body === "string" ? body.slice(0, 250) : JSON.stringify(body).slice(0, 250)}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function sb(path, options = {}) {
  return fetchJson(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { ...sbHeaders, ...(options.headers || {}) } });
}

async function openDota(path) {
  return fetchJson(`${OPENDOTA}${path}`);
}

function encodeParams(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  return p.toString();
}

function combinationKey(ids) {
  return [...ids].sort((a, b) => a - b).join("-");
}

function combinations(items, minSize = 2) {
  const out = [];
  function walk(start, chosen) {
    if (chosen.length >= minSize) out.push([...chosen]);
    for (let i = start; i < items.length; i++) {
      chosen.push(items[i]);
      walk(i + 1, chosen);
      chosen.pop();
    }
  }
  walk(0, []);
  return out;
}

async function existingMatchIds() {
  const rows = await sb("team_matches?select=match_id&limit=50000");
  return new Set((rows || []).map(x => Number(x.match_id)));
}

async function fetchPairCandidates(a, b, days) {
  const all = [];
  let offset = 0;
  while (true) {
    const qs = encodeParams({
      limit: PAGE_SIZE,
      offset,
      included_account_id: b.accountId,
      _date: days,
      significant: 1,
      sort: "start_time"
    });
    const rows = await openDota(`/players/${a.accountId}/matches?${qs}`);
    if (!Array.isArray(rows) || !rows.length) break;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset >= 5000) break;
  }
  return all;
}

function compactTeamPlayers(detail) {
  const teamIds = new Set(PLAYERS.map(p => p.accountId));
  const players = (detail.players || [])
    .filter(x => teamIds.has(Number(x.account_id)))
    .map(x => ({
      account_id: Number(x.account_id),
      player_slot: Number(x.player_slot),
      kills: Number(x.kills || 0),
      deaths: Number(x.deaths || 0),
      assists: Number(x.assists || 0),
      gold_per_min: Number(x.gold_per_min || 0),
      xp_per_min: Number(x.xp_per_min || 0)
    }));

  if (players.length < 2) return null;
  const sides = new Set(players.map(p => Number(p.player_slot) < 128 ? "radiant" : "dire"));
  if (sides.size !== 1) return null;

  const side = Number(players[0].player_slot) < 128 ? "radiant" : "dire";
  const won = side === "radiant" ? Boolean(detail.radiant_win) : !Boolean(detail.radiant_win);
  return { players, won };
}

async function collectMatches(existingIds, days) {
  const candidateIds = new Set();
  let candidateRows = 0;
  for (let i = 0; i < PLAYERS.length; i++) {
    for (let j = i + 1; j < PLAYERS.length; j++) {
      const rows = await fetchPairCandidates(PLAYERS[i], PLAYERS[j], days);
      candidateRows += rows.length;
      for (const row of rows) candidateIds.add(Number(row.match_id));
      console.log(`pair ${PLAYERS[i].name}+${PLAYERS[j].name}: ${rows.length} candidates`);
    }
  }

  const newIds = [...candidateIds].filter(id => !existingIds.has(id));
  console.log(`unique candidates=${candidateIds.size}, new=${newIds.length}`);

  const details = [];
  for (let i = 0; i < newIds.length; i++) {
    const matchId = newIds[i];
    try {
      const detail = await openDota(`/matches/${matchId}`);
      const compact = compactTeamPlayers(detail);
      if (compact) {
        details.push({
          match_id: Number(detail.match_id),
          start_time: detail.start_time ? new Date(Number(detail.start_time) * 1000).toISOString() : null,
          duration: Number(detail.duration || 0),
          radiant_win: Boolean(detail.radiant_win),
          game_mode: detail.game_mode == null ? null : Number(detail.game_mode),
          lobby_type: detail.lobby_type == null ? null : Number(detail.lobby_type),
          league_id: detail.leagueid == null ? null : Number(detail.leagueid),
          team_players: compact.players
        });
      }
    } catch (e) {
      console.warn(`match ${matchId}: ${e.message}`);
    }
    if (i < newIds.length - 1) await sleep(DETAIL_DELAY_MS);
    if ((i + 1) % 25 === 0) console.log(`details ${i + 1}/${newIds.length}`);
  }
  return { details, candidateRows };
}

async function upsertMatches(rows) {
  if (!rows.length) return;
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await sb("team_matches?on_conflict=match_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(chunk)
    });
  }
}

async function readAllMatches() {
  const rows = [];
  let offset = 0;
  while (true) {
    const chunk = await sb(`team_matches?select=match_id,start_time,duration,radiant_win,team_players&order=start_time.asc&offset=${offset}&limit=1000`);
    if (!Array.isArray(chunk) || !chunk.length) break;
    rows.push(...chunk);
    if (chunk.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

function aggregate(matches) {
  const playerMap = new Map(PLAYERS.map(p => [p.accountId, p]));
  const stats = new Map();

  for (const match of matches) {
    const teamPlayers = Array.isArray(match.team_players) ? match.team_players : [];
    const ids = teamPlayers.map(p => Number(p.account_id)).filter(id => playerMap.has(id));
    const uniqueIds = [...new Set(ids)].sort((a, b) => a - b);
    if (uniqueIds.length < 2) continue;

    // Create every 2..N combination that existed on the same side in this match.
    for (const idsCombo of combinations(uniqueIds, 2)) {
      const key = combinationKey(idsCombo);
      if (!stats.has(key)) {
        stats.set(key, {
          combination_key: key,
          combination_size: idsCombo.length,
          account_ids: idsCombo,
          player_names: idsCombo.map(id => playerMap.get(id).name),
          matches: 0, wins: 0, losses: 0,
          duration: 0, kills: 0, deaths: 0, assists: 0, gpm: 0, xpm: 0,
          last_match_at: null
        });
      }
    }

    // Rebuild all sizes 2..N in one pass.
    for (const idsCombo of combinations(uniqueIds, 2)) {
      const key = combinationKey(idsCombo);
      const s = stats.get(key);
      const selected = teamPlayers.filter(p => idsCombo.includes(Number(p.account_id)));
      s.matches += 1;
      if (match.radiant_win !== null && match.radiant_win !== undefined) {
        const side = Number(selected[0]?.player_slot) < 128 ? "radiant" : "dire";
        const won = side === "radiant" ? Boolean(match.radiant_win) : !Boolean(match.radiant_win);
        if (won) s.wins += 1; else s.losses += 1;
      }
      s.duration += Number(match.duration || 0);
      for (const p of selected) {
        s.kills += Number(p.kills || 0);
        s.deaths += Number(p.deaths || 0);
        s.assists += Number(p.assists || 0);
        s.gpm += Number(p.gold_per_min || 0);
        s.xpm += Number(p.xp_per_min || 0);
      }
      if (!s.last_match_at || new Date(match.start_time) > new Date(s.last_match_at)) s.last_match_at = match.start_time;
    }
  }

  return [...stats.values()].map(s => ({
    combination_key: s.combination_key,
    combination_size: s.combination_size,
    account_ids: s.account_ids,
    player_names: s.player_names,
    matches: s.matches,
    wins: s.wins,
    losses: s.losses,
    winrate: s.matches ? Number(((s.wins / s.matches) * 100).toFixed(2)) : 0,
    avg_duration: s.matches ? Number((s.duration / s.matches).toFixed(2)) : null,
    avg_kills: s.matches ? Number((s.kills / s.matches).toFixed(2)) : null,
    avg_deaths: s.matches ? Number((s.deaths / s.matches).toFixed(2)) : null,
    avg_assists: s.matches ? Number((s.assists / s.matches).toFixed(2)) : null,
    avg_gpm: s.matches ? Number((s.gpm / s.matches / s.combination_size).toFixed(2)) : null,
    avg_xpm: s.matches ? Number((s.xpm / s.matches / s.combination_size).toFixed(2)) : null,
    last_match_at: s.last_match_at,
    updated_at: new Date().toISOString()
  }));
}

async function replaceStats(rows) {
  await sb("team_synergy_stats?combination_size=gte.2", { method: "DELETE" });
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 100) {
    await sb("team_synergy_stats?on_conflict=combination_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 100))
    });
  }
}

async function main() {
  console.log("4T1J synergy sync started");
  const existingIds = await existingMatchIds();
  const firstRun = existingIds.size === 0;
  const days = firstRun ? INITIAL_SYNC_DAYS : INCREMENTAL_SYNC_DAYS;
  console.log(`mode=${firstRun ? "initial" : "incremental"}, days=${days}, existing=${existingIds.size}`);

  const { details, candidateRows } = await collectMatches(existingIds, days);
  await upsertMatches(details);
  const allMatches = await readAllMatches();
  const stats = aggregate(allMatches);
  await replaceStats(stats);

  console.log(`candidateRows=${candidateRows}, newTeamMatches=${details.length}, totalStored=${allMatches.length}, combinations=${stats.length}`);
  for (const size of [2, 3, 4, 5]) {
    console.log(`size ${size}: ${stats.filter(x => x.combination_size === size).length}`);
  }
  console.log("4T1J synergy sync finished");
}

main().catch(err => { console.error(err); process.exit(1); });
