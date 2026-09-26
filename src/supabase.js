const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

function headers(token) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token || SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json"
  };
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(body?.message || body?.error_description || body?.error || `HTTP ${res.status}`);
  return body;
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem("4t1j:supabase-session") || "null"); } catch { return null; }
}

export function saveSession(session) {
  localStorage.setItem("4t1j:supabase-session", JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem("4t1j:supabase-session");
}

export async function signIn(email, password) {
  if (!supabaseConfigured) throw new Error("Supabase не настроен: добавь VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.");
  const data = await request(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  saveSession(data);
  return data;
}

export function signOut() { clearSession(); }

export async function isAdmin(session) {
  const token = session?.access_token;
  const userId = session?.user?.id;
  if (!token || !userId || !supabaseConfigured) return false;
  const params = new URLSearchParams();
  params.set("select", "user_id");
  params.set("user_id", `eq.${encodeURIComponent(userId)}`);
  const rows = await request(`${SUPABASE_URL}/rest/v1/admin_users?${params}`, { headers: headers(token) });
  return Array.isArray(rows) && rows.length > 0;
}

export async function listHighlights(filters = {}) {
  if (!supabaseConfigured) return [];
  const params = new URLSearchParams();
  params.set("select", "id,title,description,player,hero,video_url,thumbnail_url,created_at,is_featured,sort_order");
  params.set("is_published", "eq.true");
  if (filters.player && filters.player !== "ALL") params.set("player", `eq.${filters.player}`);
  if (filters.hero && filters.hero !== "ALL") params.set("hero", `eq.${filters.hero}`);
  params.set("order", "is_featured.desc,sort_order.asc,created_at.desc");
  return request(`${SUPABASE_URL}/rest/v1/highlights?${params}`, { headers: headers() });
}

export async function listAllHighlights(session) {
  const token = session?.access_token;
  if (!token) throw new Error("Нет авторизации");
  const params = new URLSearchParams();
  params.set("select", "id,title,description,player,hero,video_url,thumbnail_url,created_at,is_featured,is_published,sort_order");
  params.set("order", "created_at.desc");
  return request(`${SUPABASE_URL}/rest/v1/highlights?${params}`, { headers: headers(token) });
}

export async function createHighlight(session, payload) {
  const token = session?.access_token;
  if (!token) throw new Error("Нет авторизации");
  const data = await request(`${SUPABASE_URL}/rest/v1/highlights`, {
    method: "POST", headers: { ...headers(token), Prefer: "return=representation" }, body: JSON.stringify(payload)
  });
  return data?.[0] || data;
}

export async function updateHighlight(session, id, payload) {
  const token = session?.access_token;
  return request(`${SUPABASE_URL}/rest/v1/highlights?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { ...headers(token), Prefer: "return=representation" }, body: JSON.stringify(payload)
  });
}

export async function deleteHighlight(session, id) {
  const token = session?.access_token;
  return request(`${SUPABASE_URL}/rest/v1/highlights?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: headers(token) });
}

export async function listCupResults() {
  if (!supabaseConfigured) return [];
  const params = new URLSearchParams();
  params.set("select", "id,cup_date,result,score,opponent,note,created_at");
  params.set("order", "cup_date.desc,created_at.desc");
  params.set("limit", "12");
  return request(`${SUPABASE_URL}/rest/v1/battle_cups?${params}`, { headers: headers() });
}

export async function createCupResult(session, payload) {
  const token = session?.access_token;
  if (!token) throw new Error("Нет авторизации");
  const data = await request(`${SUPABASE_URL}/rest/v1/battle_cups`, {
    method: "POST", headers: { ...headers(token), Prefer: "return=representation" }, body: JSON.stringify(payload)
  });
  return data?.[0] || data;
}

export async function deleteCupResult(session, id) {
  const token = session?.access_token;
  if (!token) throw new Error("Нет авторизации");
  return request(`${SUPABASE_URL}/rest/v1/battle_cups?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: headers(token) });
}

export async function uploadFile(session, file, folder) {
  const token = session?.access_token;
  if (!token) throw new Error("Нет авторизации");
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/gi, "-");
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/highlights/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`; try { const x = await res.json(); msg = x.message || x.error || msg; } catch {}
    throw new Error(msg);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/highlights/${path}`;
}

export async function listSynergyStats() {
  if (!supabaseConfigured) return [];
  const params = new URLSearchParams();
  params.set("select", "combination_key,combination_size,account_ids,player_names,matches,wins,losses,winrate,avg_duration,avg_kills,avg_deaths,avg_assists,avg_gpm,avg_xpm,last_match_at,updated_at");
  params.set("order", "combination_size.asc,winrate.desc,matches.desc");
  return request(`${SUPABASE_URL}/rest/v1/team_synergy_stats?${params}`, { headers: headers() });
}
