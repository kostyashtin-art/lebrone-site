import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Swords, Users, Copy, Plus, Eye, RotateCcw, Wifi, WifiOff, ShieldCheck } from "lucide-react";

const API = "https://api.opendota.com/api";
const URL = import.meta.env.VITE_SUPABASE_URL || "";
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const configured = Boolean(URL && KEY);

const ORDER = [
  ["ban","radiant"],["ban","dire"],["ban","radiant"],["ban","dire"],
  ["pick","radiant"],["pick","dire"],["pick","dire"],["pick","radiant"],
  ["pick","radiant"],["pick","dire"],["ban","dire"],["ban","radiant"],
  ["pick","dire"],["pick","radiant"],["pick","radiant"],["pick","dire"]
];
const demoHeroes = [
  ["npc_dota_hero_antimage","Anti-Mage"],["npc_dota_hero_axe","Axe"],["npc_dota_hero_bane","Bane"],
  ["npc_dota_hero_bloodseeker","Bloodseeker"],["npc_dota_hero_crystal_maiden","Crystal Maiden"],
  ["npc_dota_hero_drow_ranger","Drow Ranger"],["npc_dota_hero_earthshaker","Earthshaker"],
  ["npc_dota_hero_juggernaut","Juggernaut"],["npc_dota_hero_mirana","Mirana"],["npc_dota_hero_nevermore","Shadow Fiend"],
  ["npc_dota_hero_morphling","Morphling"],["npc_dota_hero_phantom_lancer","Phantom Lancer"],["npc_dota_hero_puck","Puck"],
  ["npc_dota_hero_pudge","Pudge"],["npc_dota_hero_razor","Razor"],["npc_dota_hero_sand_king","Sand King"],
  ["npc_dota_hero_storm_spirit","Storm Spirit"],["npc_dota_hero_sven","Sven"],["npc_dota_hero_tiny","Tiny"],
  ["npc_dota_hero_vengefulspirit","Vengeful Spirit"],["npc_dota_hero_windrunner","Windranger"],["npc_dota_hero_zuus","Zeus"],
  ["npc_dota_hero_kunkka","Kunkka"],["npc_dota_hero_lina","Lina"],["npc_dota_hero_lion","Lion"],
  ["npc_dota_hero_shadow_shaman","Shadow Shaman"],["npc_dota_hero_slardar","Slardar"],["npc_dota_hero_tidehunter","Tidehunter"],
  ["npc_dota_hero_witch_doctor","Witch Doctor"],["npc_dota_hero_lich","Lich"],["npc_dota_hero_riki","Riki"],
  ["npc_dota_hero_enigma","Enigma"],["npc_dota_hero_tinker","Tinker"],["npc_dota_hero_sniper","Sniper"],
  ["npc_dota_hero_necrolyte","Necrophos"],["npc_dota_hero_warlock","Warlock"],["npc_dota_hero_beastmaster","Beastmaster"],
  ["npc_dota_hero_queenofpain","Queen of Pain"],["npc_dota_hero_venomancer","Venomancer"],["npc_dota_hero_faceless_void","Faceless Void"],
  ["npc_dota_hero_skeleton_king","Wraith King"],["npc_dota_hero_death_prophet","Death Prophet"],
  ["npc_dota_hero_phantom_assassin","Phantom Assassin"],["npc_dota_hero_pugna","Pugna"],
  ["npc_dota_hero_templar_assassin","Templar Assassin"],["npc_dota_hero_viper","Viper"],["npc_dota_hero_luna","Luna"],
  ["npc_dota_hero_dragon_knight","Dragon Knight"],["npc_dota_hero_dazzle","Dazzle"],["npc_dota_hero_rattletrap","Clockwerk"],
  ["npc_dota_hero_leshrac","Leshrac"],["npc_dota_hero_furion","Nature's Prophet"],["npc_dota_hero_life_stealer","Lifestealer"],
  ["npc_dota_hero_dark_seer","Dark Seer"],["npc_dota_hero_clinkz","Clinkz"],["npc_dota_hero_omniknight","Omniknight"],
  ["npc_dota_hero_enchantress","Enchantress"],["npc_dota_hero_huskar","Huskar"],["npc_dota_hero_night_stalker","Night Stalker"],
  ["npc_dota_hero_broodmother","Broodmother"],["npc_dota_hero_bounty_hunter","Bounty Hunter"],["npc_dota_hero_weaver","Weaver"],
  ["npc_dota_hero_jakiro","Jakiro"],["npc_dota_hero_batrider","Batrider"],["npc_dota_hero_chen","Chen"],
  ["npc_dota_hero_spectre","Spectre"],["npc_dota_hero_ancient_apparition","Ancient Apparition"],["npc_dota_hero_doom_bringer","Doom"],
  ["npc_dota_hero_ursa","Ursa"],["npc_dota_hero_spirit_breaker","Spirit Breaker"],["npc_dota_hero_gyrocopter","Gyrocopter"],
  ["npc_dota_hero_alchemist","Alchemist"],["npc_dota_hero_invoker","Invoker"],["npc_dota_hero_silencer","Silencer"],
  ["npc_dota_hero_obsidian_destroyer","Outworld Destroyer"],["npc_dota_hero_lycan","Lycan"],["npc_dota_hero_brewmaster","Brewmaster"],
  ["npc_dota_hero_shadow_demon","Shadow Demon"],["npc_dota_hero_lone_druid","Lone Druid"],["npc_dota_hero_chaos_knight","Chaos Knight"],
  ["npc_dota_hero_meepo","Meepo"],["npc_dota_hero_treant","Treant Protector"],["npc_dota_hero_ogre_magi","Ogre Magi"],
  ["npc_dota_hero_undying","Undying"],["npc_dota_hero_rubick","Rubick"],["npc_dota_hero_disruptor","Disruptor"],
  ["npc_dota_hero_nyx_assassin","Nyx Assassin"],["npc_dota_hero_naga_siren","Naga Siren"],
  ["npc_dota_hero_keeper_of_the_light","Keeper of the Light"],["npc_dota_hero_wisp","Io"],["npc_dota_hero_slark","Slark"],
  ["npc_dota_hero_medusa","Medusa"],["npc_dota_hero_troll_warlord","Troll Warlord"],["npc_dota_hero_centaur","Centaur Warrunner"],
  ["npc_dota_hero_magnataur","Magnus"],["npc_dota_hero_shredder","Timbersaw"],["npc_dota_hero_bristleback","Bristleback"],
  ["npc_dota_hero_tusk","Tusk"],["npc_dota_hero_skywrath_mage","Skywrath Mage"],["npc_dota_hero_abaddon","Abaddon"],
  ["npc_dota_hero_elder_titan","Elder Titan"],["npc_dota_hero_legion_commander","Legion Commander"],
  ["npc_dota_hero_techies","Techies"],["npc_dota_hero_ember_spirit","Ember Spirit"],["npc_dota_hero_earth_spirit","Earth Spirit"],
  ["npc_dota_hero_abyssal_underlord","Underlord"],["npc_dota_hero_terrorblade","Terrorblade"],["npc_dota_hero_phoenix","Phoenix"],
  ["npc_dota_hero_oracle","Oracle"],["npc_dota_hero_winter_wyvern","Winter Wyvern"],["npc_dota_hero_arc_warden","Arc Warden"],
  ["npc_dota_hero_monkey_king","Monkey King"],["npc_dota_hero_dark_willow","Dark Willow"],["npc_dota_hero_pangolier","Pangolier"],
  ["npc_dota_hero_grimstroke","Grimstroke"],["npc_dota_hero_mars","Mars"],["npc_dota_hero_void_spirit","Void Spirit"],
  ["npc_dota_hero_snapfire","Snapfire"],["npc_dota_hero_hoodwink","Hoodwink"],["npc_dota_hero_dawnbreaker","Dawnbreaker"],
  ["npc_dota_hero_marci","Marci"],["npc_dota_hero_primal_beast","Primal Beast"],["npc_dota_hero_muerta","Muerta"],
  ["npc_dota_hero_ringmaster","Ringmaster"],["npc_dota_hero_kez","Kez"]
].map(([name, localized_name], i) => ({ id: i + 1, name, localized_name }));

const headers = (prefer = "") => ({
  apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json",
  ...(prefer ? { Prefer: prefer } : {})
});
const imageFor = (hero) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hero.name.replace("npc_dota_hero_", "")}.png`;
const newCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const roomUrl = code => `${window.location.origin}${window.location.pathname}?draft=${code}`;

async function api(path, options = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const bodyText = await res.text();
  let body = null; try { body = bodyText ? JSON.parse(bodyText) : null; } catch {}
  if (!res.ok) throw new Error(body?.message || body?.details || `Supabase HTTP ${res.status}`);
  return body;
}

function nextAction(roomState) { return ORDER[roomState.actions?.length || 0] || null; }

export default function DraftSimulator() {
  const [heroes, setHeroes] = useState(demoHeroes);
  const [name, setName] = useState("");
  const [code, setCode] = useState(new URLSearchParams(window.location.search).get("draft") || "");
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState("spectator");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/heroes`).then(r => r.ok ? r.json() : Promise.reject()).then(rows => {
      if (Array.isArray(rows) && rows.length) setHeroes(rows);
    }).catch(() => {});
  }, []);

  const fetchRoom = async (roomCode) => {
    const rows = await api(`draft_rooms?select=*&code=eq.${encodeURIComponent(roomCode)}&limit=1`);
    if (!rows?.length) throw new Error("Комната не найдена. Проверь код.");
    setRoom(rows[0]); setOnline(true);
    return rows[0];
  };

  useEffect(() => {
    if (!room?.code || !configured) return;
    let alive = true;
    const tick = async () => {
      try {
        const rows = await api(`draft_rooms?select=*&code=eq.${encodeURIComponent(room.code)}&limit=1`);
        if (alive && rows?.[0]) { setRoom(rows[0]); setOnline(true); }
      } catch { if (alive) setOnline(false); }
    };
    const timer = window.setInterval(tick, 1800);
    return () => { alive = false; window.clearInterval(timer); };
  }, [room?.code]);

  const create = async () => {
    setError("");
    if (!configured) return setError("Supabase пока не подключён. Проверь Secrets в GitHub Actions: VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.");
    if (!name.trim()) return setError("Введи своё имя.");
    setLoading(true);
    try {
      const code = newCode();
      const state = { actions: [], status: "draft" };
      const rows = await api("draft_rooms", { method: "POST", headers: { ...headers("return=representation"), Prefer: "return=representation" }, body: JSON.stringify({ code, host_name: name.trim(), state, status: "draft" }) });
      const created = Array.isArray(rows) ? rows[0] : rows;
      setRoom(created); setRole("radiant");
      window.history.replaceState({}, "", roomUrl(code));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const join = async (requestedRole) => {
    setError("");
    if (!configured) return setError("Supabase пока не подключён. Сначала настрой его.");
    if (!name.trim()) return setError("Введи своё имя.");
    if (!code.trim()) return setError("Введи код комнаты.");
    setLoading(true);
    try {
      const found = await fetchRoom(code.trim().toUpperCase());
      setRoom(found); setRole(requestedRole);
      window.history.replaceState({}, "", roomUrl(found.code));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const takeAction = async (hero) => {
    if (!room || role === "spectator") return;
    const state = room.state || { actions: [], status: "draft" };
    const next = nextAction(state);
    if (!next) return;
    if (next[1] !== role) return setError(`Сейчас ход ${next[1] === "radiant" ? "Radiant" : "Dire"}.`);
    if (state.actions.some(a => Number(a.hero_id) === Number(hero.id))) return;
    const actions = [...state.actions, {
      hero_id: hero.id, hero_name: hero.localized_name, hero_internal_name: hero.name,
      type: next[0], team: next[1], player_name: name.trim(), at: new Date().toISOString()
    }];
    const newState = { ...state, actions, status: actions.length >= ORDER.length ? "complete" : "draft" };
    try {
      const updated = await api(`draft_rooms?id=eq.${room.id}`, {
        method: "PATCH",
        headers: { ...headers("return=representation"), Prefer: "return=representation" },
        body: JSON.stringify({ state: newState, status: newState.status })
      });
      setRoom(Array.isArray(updated) && updated[0] ? updated[0] : { ...room, state: newState, status: newState.status });
      setError("");
    } catch (e) { setError(`Не удалось сохранить ход: ${e.message}`); }
  };

  const reset = async () => {
    if (role !== "radiant" || !room || !window.confirm("Сбросить драфт?")) return;
    try {
      const blank = { actions: [], status: "draft" };
      await api(`draft_rooms?id=eq.${room.id}`, { method: "PATCH", headers: { ...headers("return=minimal") }, body: JSON.stringify({ state: blank, status: "draft" }) });
      setRoom({ ...room, state: blank, status: "draft" });
    } catch (e) { setError(e.message); }
  };

  const state = room?.state || { actions: [], status: "draft" };
  const next = nextAction(state);
  const used = new Set(state.actions.map(a => Number(a.hero_id)));
  const filtered = useMemo(() => heroes.filter(h => h.localized_name?.toLowerCase().includes(search.toLowerCase())).sort((a,b) => a.localized_name.localeCompare(b.localized_name, "ru")), [heroes, search]);
  const radiantPicks = state.actions.filter(a => a.team === "radiant" && a.type === "pick");
  const direPicks = state.actions.filter(a => a.team === "dire" && a.type === "pick");
  const radiantBans = state.actions.filter(a => a.team === "radiant" && a.type === "ban");
  const direBans = state.actions.filter(a => a.team === "dire" && a.type === "ban");
  const myTurn = role !== "spectator" && next?.[1] === role;

  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(roomUrl(room.code)); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setError(`Ссылка для друзей: ${roomUrl(room.code)}`); }
  };

  return <section className="draft-page">
    <div className="draft-intro">
      <div className="draft-eyebrow">DOTA 2 / DRAFT TRAINING</div>
      <h1>DRAFT <span>SIMULATOR</span></h1>
      <p>Тренируйте пики с друзьями. Выбирайте героев по очереди, баньте опасных соперников и собирайте состав до начала настоящей игры.</p>
      <div className="draft-features"><span><Users size={15}/> Комнаты по ссылке</span><span><Wifi size={15}/> Синхронизация</span><span><ShieldCheck size={15}/> Пики и баны</span></div>
    </div>

    {!room ? <div className="draft-lobby">
      <div className="draft-card">
        <div className="draft-card-kicker"><Plus size={16}/> НОВАЯ КОМНАТА</div>
        <h2>Создать драфт</h2><p>Ты станешь капитаном Radiant.</p>
        <label>Твоё имя</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Например, Костя" maxLength={24}/>
        <button className="draft-primary" onClick={create} disabled={loading}>{loading ? "Создаём..." : "Создать комнату"} <Swords size={16}/></button>
      </div>
      <div className="draft-card">
        <div className="draft-card-kicker"><Users size={16}/> ПРИСОЕДИНИТЬСЯ</div>
        <h2>Войти в комнату</h2><p>Введи имя и код, который прислал друг.</p>
        <label>Твоё имя</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Как тебя называть?" maxLength={24}/>
        <label>Код комнаты</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABCDE" maxLength={5}/>
        <div className="draft-button-row"><button onClick={()=>join("dire")} disabled={loading}>Капитан Dire</button><button onClick={()=>join("spectator")} disabled={loading}><Eye size={15}/> Наблюдать</button></div>
      </div>
      {!configured && <div className="draft-notice">Перед игрой подключи Supabase. Добавь настройки Supabase в GitHub Actions, чтобы комнаты работали онлайн.</div>}
    </div> : <>
      <div className="draft-room-head">
        <div><div className="draft-eyebrow">CAPTAINS MODE · FRIEND MATCH</div><h2>КОМНАТА <span>{room.code}</span></h2><p>Ты вошёл как <b>{name}</b> · {role === "radiant" ? "капитан Radiant" : role === "dire" ? "капитан Dire" : "наблюдатель"}</p></div>
        <div className="draft-room-tools"><span className={online ? "draft-online" : "draft-offline"}>{online ? <Wifi size={14}/> : <WifiOff size={14}/>} {online ? "В сети" : "Нет связи"}</span><button onClick={copyInvite}><Copy size={15}/>{copied ? "Скопировано" : "Пригласить"}</button><Link to="/draft" onClick={()=>{setRoom(null);setRole("spectator");window.history.replaceState({}, "", window.location.pathname);}}>Выйти</Link></div>
      </div>
      <div className="draft-turn">
        <div><small>ТЕКУЩИЙ ХОД</small><h3>{next ? `${next[0] === "pick" ? "ПИК" : "БАН"} · ${next[1] === "radiant" ? "RADIANT" : "DIRE"}` : "ДРАФТ ЗАВЕРШЁН"}</h3><p>{!next ? "Оба состава готовы." : role === "spectator" ? "Ты наблюдаешь за драфтом." : myTurn ? `Твой ход, ${name}. Выбери героя.` : "Ожидай ход соперника."}</p></div>
        <div className="draft-progress"><b>{state.actions.length}</b><span>/ {ORDER.length} ходов</span></div>
      </div>
      <div className="draft-teams">
        <Team title="RADIANT" color="green" picks={radiantPicks} bans={radiantBans}/>
        <Team title="DIRE" color="red" picks={direPicks} bans={direBans}/>
      </div>
      <div className="draft-card draft-hero-picker">
        <div className="draft-picker-head"><div><h2>ГЕРОИ</h2><p>{role === "spectator" ? "Режим наблюдателя" : myTurn ? "Выбери героя для текущего хода" : "Выбор доступен в ход твоей команды"}</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск героя..."/></div>
        <div className="draft-hero-grid">{filtered.map(hero => <button key={hero.id} className={`draft-hero ${used.has(Number(hero.id)) ? "is-used" : ""}`} disabled={used.has(Number(hero.id)) || !myTurn || !next} onClick={()=>takeAction(hero)} title={hero.localized_name}><img src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hero.name.replace("npc_dota_hero_","")}.png`} alt="" loading="lazy"/><span>{hero.localized_name}</span>{used.has(Number(hero.id)) && <i>{state.actions.find(a=>Number(a.hero_id)===Number(hero.id))?.type === "ban" ? "БАН" : "ПИК"}</i>}</button>)}</div>
      </div>
      <div className="draft-card draft-history"><div className="draft-card-kicker"><ShieldCheck size={16}/> ИСТОРИЯ ДРАФТА</div>
        {!state.actions.length ? <p>Пока никто не сделал выбор.</p> : state.actions.map((a,i)=><div className="draft-history-row" key={`${a.hero_id}-${i}`}><span>{String(i+1).padStart(2,"0")}</span><b className={a.team}>{a.team.toUpperCase()}</b><em>{a.type === "pick" ? "ПИК" : "БАН"}</em><strong>{a.hero_name}</strong><small>{a.player_name}</small></div>)}
        {role === "radiant" && <button className="draft-reset" onClick={reset}><RotateCcw size={14}/> Сбросить драфт</button>}
      </div>
      {state.status === "complete" && <div className="draft-complete"><Swords/><div><b>Драфт завершён</b><p>В следующем обновлении добавим аналитику контрпиков и оценку винрейта на основе реальных матчей. Сейчас проценты победы не выдумываем.</p></div></div>}
    </>}
    {error && <div className="draft-error">{error}<button onClick={()=>setError("")}>×</button></div>}
    <div className="draft-disclaimer">DOTA DRAFT TRAINING · Неофициальный фанатский инструмент. Прогноз победы появится после подключения проверенной статистики матчей.</div>
  </section>;
}

function Team({title,color,picks,bans}) {
  return <div className={`draft-team ${color}`}><div className="draft-team-title"><i/>{title}<span>{picks.length}/5</span></div>
    <div className="draft-pick-slots">{Array.from({length:5},(_,i)=>{const p=picks[i];return <div className={p ? "picked" : ""} key={i}>{p ? <><img src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${p.hero_internal_name.replace("npc_dota_hero_","")}.png`} alt=""/><b>{p.hero_name}</b></> : <><i>{i+1}</i><span>Ожидает пика</span></>}</div>})}</div>
    <div className="draft-bans"><small>БАНЫ</small>{bans.length ? bans.map(b=><span key={b.hero_id}>{b.hero_name}</span>) : <em>Пока нет</em>}</div>
  </div>;
}
