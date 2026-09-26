import { Link, NavLink, Routes, Route, useParams } from "react-router-dom";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";
import { Highlights, Admin } from "./Highlights";
import { listCupResults, createCupResult, deleteCupResult, listSynergyStats, supabaseConfigured } from "./supabase";

const API = "https://api.opendota.com/api";

const players = [
  {
    id: 1,
    name: "АРТЕМ",
    nickname: "Артем",
    role: "CARRY",
    position: "Pos 1 • Carry",
    accountId: 127394881,
    image: "/players/player-1.png",
    steam: "https://steamcommunity.com/profiles/76561198087660609",
    accent: "#e3222b"
  },
  {
    id: 2,
    name: "ИЛЬШАТ",
    nickname: "Ильшат",
    role: "MID",
    position: "Pos 2 • Mid",
    accountId: 1585608718,
    image: "/players/player-2.png",
    steam: "https://steamcommunity.com/id/Ma1ayFT",
    accent: "#ffb800"
  },
  {
    id: 3,
    name: "КОСТЯ",
    nickname: "Костя",
    role: "OFFLANE",
    position: "Pos 3 • Offlane",
    accountId: 129692343,
    image: "/players/player-3.png",
    steam: "https://steamcommunity.com/id/hunderson",
    accent: "#8b00ff"
  },
  {
    id: 4,
    name: "КИРИЛЛ",
    nickname: "Кирилл",
    role: "SUPPORT",
    position: "Pos 4 • Support",
    accountId: 421012634,
    image: "/players/player-4.png",
    steam: "https://steamcommunity.com/id/shzkd",
    accent: "#ef4444"
  },
  {
    id: 5,
    name: "ИНСАФ",
    nickname: "Инсаф",
    role: "SUPPORT",
    position: "Pos 5 • Support",
    accountId: 237813481,
    image: "/players/player-5.png",
    steam: "https://steamcommunity.com/id/237813481",
    accent: "#60a5fa",
    synergy: true
  },

];

const coach = {
  name: "ГРИША",
  role: "COACH",
  position: "Тренер команды",
  accountId: 198826325,
  image: "/players/coach-grisha.png"
};

const synergyPlayers = players;

const nav = [
  ["/", "ГЛАВНАЯ"],
  ["/roster", "СОСТАВ"],
  ["/matches", "МАТЧИ"],
  ["/news", "НОВОСТИ"],
  ["/media", "МЕДИА"],
  ["/highlights", "ХАЙЛАЙТЫ"],
  ["/synergy", "СИНЕРГИЯ"],
  ["/about", "О КОМАНДЕ"]
];

const number = new Intl.NumberFormat("ru-RU");

function fmt(value) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? "—" : number.format(Math.round(Number(value)));
}

function pct(value) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? "—" : `${Number(value).toFixed(1)}%`;
}

function duration(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function relDate(timestamp) {
  if (!timestamp) return "—";
  const diff = Date.now() - timestamp * 1000;
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн назад`;
  return new Date(timestamp * 1000).toLocaleDateString("ru-RU");
}

async function fetchJson(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API}${path}`, { cache: "no-store", signal: controller.signal, ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadPlayerStats(accountId) {
  const key = `4t1j:stats:${accountId}`;
  const now = Date.now();
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || "null");
    if (cached && now - cached.savedAt < 5 * 60 * 1000) return { ...cached.data, cached: true };
  } catch {
    // ignore malformed cache
  }

  const results = await Promise.allSettled([
    fetchJson(`/players/${accountId}`),
    fetchJson(`/players/${accountId}/wl`),
    fetchJson(`/players/${accountId}/heroes`),
    fetchJson(`/players/${accountId}/recentMatches`),
    fetchJson(`/players/${accountId}/totals`)
  ]);

  const [profile, wl, heroes, recentMatches, totals] = results.map((r) => r.status === "fulfilled" ? r.value : null);
  if (!profile && !wl && !heroes && !recentMatches && !totals) {
    throw new Error("OpenDota API недоступен");
  }

  let data;
  try {
    const heroMap = await fetchJson("/heroes");
    data = { profile, wl, heroes, recentMatches, totals, heroMap };
  } catch {
    data = { profile, wl, heroes, recentMatches, totals, heroMap: [] };
  }

  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: now, data }));
  } catch {
    // ignore storage errors
  }
  return data;
}

function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site">
      <header className={menuOpen ? "mobile-open" : ""}>
        <Link className="brand" to="/" aria-label="4T1J — главная" onClick={closeMenu}>
          <img src="/4t1j-logo.png" alt="4T1J" />
        </Link>
        <button className="menu-toggle" type="button" aria-label="Открыть меню" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
          <span></span><span></span><span></span>
        </button>
        <nav>
          {nav.map(([path, label]) => (
            <NavLink key={path} to={path} end={path === "/"} onClick={closeMenu}>{label}</NavLink>
          ))}
          <a className="mobile-support" href="#footer" onClick={closeMenu}>ПОДДЕРЖАТЬ</a>
        </nav>
        <a className="support-btn" href="#footer">ПОДДЕРЖАТЬ</a>
      </header>
      {children}
      <footer id="footer">
        <img className="footer-logo" src="/4t1j-logo.png" alt="4T1J" />
        <span>© 2026 4T1J ESPORTS</span>
      </footer>
    </div>
  );
}

function PlayerCard({ p, large = false }) {
  return (
    <Link to={`/roster/player/${p.accountId}`} className={large ? "roster-card" : "player"}>
      <div className="player-photo">
        <img src={p.image} alt={p.name} />
        <span className="player-number">{String(p.id).padStart(2, "0")}</span>
        <div className="photo-shade" />
      </div>
      <div className="player-info">
        <b>{p.name}</b>
        <small>{p.role}</small>
        <i />
      </div>
    </Link>
  );
}

function CoachCard({ large = false }) {
  return (
    <Link to={`/roster/player/${coach.accountId}`} className={large ? "roster-card coach-card" : "player coach-card"}>
      <div className="player-photo">
        <img src={coach.image} alt={coach.name} />
        <span className="player-number">COACH</span>
        <div className="photo-shade" />
      </div>
      <div className="player-info">
        <b>{coach.name}</b>
        <small>{coach.role} · {coach.position}</small>
        <span className="coach-id">ID {coach.accountId}</span>
        <i />
      </div>
    </Link>
  );
}

function nextBattleCupTarget() {
  const now = new Date();
  // Moscow is UTC+3 year-round. Work in a synthetic Moscow clock to avoid the user's local timezone.
  const moscowNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const day = moscowNow.getUTCDay(); // Sunday=0 ... Saturday=6
  let days = (6 - day + 7) % 7;
  const targetToday = new Date(Date.UTC(moscowNow.getUTCFullYear(), moscowNow.getUTCMonth(), moscowNow.getUTCDate(), 21, 0, 0));
  if (days === 0 && moscowNow.getTime() >= targetToday.getTime()) days = 7;
  const targetMoscow = new Date(Date.UTC(moscowNow.getUTCFullYear(), moscowNow.getUTCMonth(), moscowNow.getUTCDate() + days, 21, 0, 0));
  return new Date(targetMoscow.getTime() - 3 * 60 * 60 * 1000);
}

function BattleCup() {
  const [target, setTarget] = useState(nextBattleCupTarget);
  const [left, setLeft] = useState(target.getTime() - Date.now());
  const [results, setResults] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      let next = nextBattleCupTarget();
      setTarget(next);
      setLeft(next.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    listCupResults().then(setResults).catch(() => setResults([]));
  }, []);

  const total = results.length;
  const wins = results.filter(x => x.result === "win").length;
  const losses = results.filter(x => x.result === "loss").length;
  const days = Math.max(0, Math.floor(left / 86400000));
  const hours = Math.max(0, Math.floor((left % 86400000) / 3600000));
  const minutes = Math.max(0, Math.floor((left % 3600000) / 60000));
  const seconds = Math.max(0, Math.floor((left % 60000) / 1000));

  return <section className="battle-cup">
    <div className="battle-cup-main">
      <div className="battle-cup-kicker"><span className="live-dot" /> 4T1J / WEEKLY EVENT</div>
      <h2>БОЕВОЙ <span>КУБОК</span></h2>
      <p>Каждую субботу в <b>21:00 МСК</b>. Здесь будет текущий отсчёт до старта и история выступлений команды.</p>
      <div className="cup-countdown" aria-label="Отсчёт до боевого кубка">
        <div><b>{String(days).padStart(2, "0")}</b><small>ДНЕЙ</small></div><i>:</i>
        <div><b>{String(hours).padStart(2, "0")}</b><small>ЧАСОВ</small></div><i>:</i>
        <div><b>{String(minutes).padStart(2, "0")}</b><small>МИН</small></div><i>:</i>
        <div><b>{String(seconds).padStart(2, "0")}</b><small>СЕК</small></div>
      </div>
      <div className="cup-next">СЛЕДУЮЩИЙ СТАРТ · {target.toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", timeZone:"Europe/Moscow" })} · 21:00 МСК</div>
    </div>
    <div className="battle-cup-record">
      <small>РЕЗУЛЬТАТЫ</small>
      <div className="cup-score"><b>{wins}</b><span>ПОБЕД</span><em>:</em><b className="loss-num">{losses}</b><span>ПОРАЖЕНИЙ</span></div>
      <div className="cup-history">
        {results.slice(0, 6).map((r) => <span key={r.id} className={r.result === "win" ? "cup-win" : "cup-loss"} title={`${r.cup_date}${r.opponent ? ` · ${r.opponent}` : ""}`}>{r.result === "win" ? "W" : "L"}</span>)}
        {!results.length ? <p>Первые результаты появятся после подключения Supabase и добавления кубка.</p> : null}
      </div>
      
    </div>
  </section>;
}

function Home() {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">DOTA 2 ESPORTS TEAM</div>
        <div className="fire-logo">
          <img src="/4t1j-logo.png" alt="4T1J" className="real-logo" />
        </div>
        <div className="hero-message"><h2>БОЛЬШЕ ЧЕМ КОМАНДА</h2><p>ДРУЖБА. ИГРА. РАЗВИТИЕ.</p></div>
        <Link className="cta" to="/roster">СМОТРЕТЬ СОСТАВ <b>→</b></Link>
      </div>
      <div className="hero-side-text"><span>GOOD PEOPLE</span><span>GOOD DOTA</span><b>♛</b></div>
      <div className="scroll">SCROLL<i>↓</i></div>
    </section>

    <section className="grid roster-home">
      <div className="panel roster-panel">
        <label><span>СОСТАВ КОМАНДЫ</span><Link to="/roster">ВЕСЬ СОСТАВ →</Link></label>
        <div className="players">{players.map(p => <PlayerCard p={p} key={p.id} />)}<CoachCard /></div>
      </div>
      <BattleCup />
    </section>

    <section className="highlights-home"><div><small>MEDIA / 4T1J</small><h2>ПОСЛЕДНИЕ ХАЙЛАЙТЫ</h2><p>KILLS, CLUTCH И ЛУЧШИЕ МОМЕНТЫ НАШЕЙ КОМАНДЫ.</p></div><Link className="gold" to="/highlights">СМОТРЕТЬ ХАЙЛАЙТЫ →</Link></section>

    <section className="grid lower">
      <Link className="news" to="/news"><small>ПОСЛЕДНИЕ НОВОСТИ</small><h2>4T1J НА LAN-ТУРНИРЕ:<br/>ПЕРВЫЙ ШАГ К БОЛЬШИМ ПОБЕДАМ</h2><span>21 СЕН 2026</span><b>→</b></Link>
      <Link className="merch" to="/media"><small>НАШ МЕРЧ</small><div className="shirt">4T1J</div><h2>СТИЛЬ,<br/>КОТОРЫЙ ОБЪЕДИНЯЕТ</h2><span>СМОТРЕТЬ →</span></Link>
    </section>
    <div className="partners">DOTA 2　 STEAM　 LOGITECH G　 HYPERX　 ZOWIE　 MONSTER ENERGY</div>
  </>;
}

function Page({ title, sub, children }) {
  return <section className="page"><small>4T1J ESPORTS</small><h1>{title}</h1><p>{sub}</p>{children}</section>;
}

function Roster() {
  return <Page title="СОСТАВ" sub="ПЯТЬ ИГРОКОВ. ОДИН ТРЕНЕР. ОДНА КОМАНДА.">
    <div className="roster">{players.map(p => <PlayerCard p={p} large key={p.id} />)}</div>
    <section className="coach-section">
      <div className="coach-section-head"><small>4T1J / STAFF</small><h2>ТРЕНЕР</h2><p>ТРЕНЕРСКИЙ ШТАБ КОМАНДЫ</p></div>
      <CoachCard large />
    </section>
  </Page>;
}

function Matches() {
  return <Page title="МАТЧИ" sub="РАСПИСАНИЕ И РЕЗУЛЬТАТЫ 4T1J">
    <div className="rows"><div>LAN EVENT　 <b>4T1J</b>　 VS　 RIVAL TEAM　 <em>СЛЕДУЮЩИЙ</em></div><div>ONLINE　 <b>4T1J</b>　 VS　 TEAM NORTH　 <em>28 СЕН</em></div><div>ONLINE　 <b>4T1J</b>　 2 : 1　 RED FOX　 <em>ПОБЕДА</em></div></div>
  </Page>;
}

function News() {
  return <Page title="НОВОСТИ" sub="ПОСЛЕДНИЕ СОБЫТИЯ КОМАНДЫ"><div className="rows"><div>21.09.2026　 <b>4T1J НА LAN-ТУРНИРЕ: ПЕРВЫЙ ШАГ К БОЛЬШИМ ПОБЕДАМ</b>　→</div><div>18.09.2026　 <b>НОВЫЙ СОСТАВ 4T1J ГОТОВ К СЕЗОНУ</b>　→</div><div>12.09.2026　 <b>ЗА КУЛИСАМИ: ТРЕНИРОВКИ И ПОДГОТОВКА</b>　→</div></div></Page>;
}

function Media() {
  return <Page title="МЕДИА" sub="ФОТО, ВИДЕО И МЕРЧ 4T1J"><div className="media"><Link to="/highlights"><div>HIGHLIGHTS<br/><span>СМОТРЕТЬ →</span></div></Link><div>4T1J<br/>MEDIA</div><div>MATCH<br/>DAY</div><div>MERCH<br/>DROP</div></div></Page>;
}

function About() {
  return <Page title="О КОМАНДЕ" sub="GOOD PEOPLE. GOOD DOTA."><div className="about"><b>4T1J</b><p>Команда 4T1J, построенная вокруг игры, дружбы и развития. На сайте собраны состав, статистика игроков, матчи, новости и медиа.</p></div></Page>;
}

function StatCard({ label, value, sub }) {
  return <div className="stat-card"><small>{label}</small><strong>{value}</strong>{sub ? <span>{sub}</span> : null}</div>;
}

function HeroIcon({ heroId, heroMap }) {
  const hero = heroMap?.find(h => h.id === heroId);
  const slug = hero?.name?.replace("npc_dota_hero_", "");
  if (!slug) return <span className="hero-fallback">?</span>;
  return <img className="hero-icon" src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`} alt={hero.localized_name || slug} loading="lazy" />;
}

function totalsMap(totals) {
  return Object.fromEntries((totals || []).map(t => [t.field, t]));
}

function kdaAvg(totals) {
  const tm = totalsMap(totals);
  const k = tm.kills?.avg;
  const d = tm.deaths?.avg;
  const a = tm.assists?.avg;
  if ([k, d, a].some(v => v === undefined || v === null)) return "—";
  return `${Number(k).toFixed(1)} / ${Number(d).toFixed(1)} / ${Number(a).toFixed(1)}`;
}

function PlayerProfile() {
  const { accountId } = useParams();
  const player = useMemo(() => {
    const id = String(accountId);
    return players.find(p => String(p.accountId) === id) || (String(coach.accountId) === id ? coach : null);
  }, [accountId]);
  const isCoach = player?.accountId === coach.accountId;
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const load = async (force = false) => {
    if (!player) return;
    if (force) {
      try { sessionStorage.removeItem(`4t1j:stats:${player.accountId}`); } catch {}
    }
    setState({ loading: true, error: "", data: null });
    try {
      const data = await loadPlayerStats(player.accountId);
      setState({ loading: false, error: "", data });
    } catch (e) {
      setState({ loading: false, error: e.message || "Не удалось загрузить статистику", data: null });
    }
  };

  useEffect(() => { load(); }, [player?.accountId]);

  if (!player) return <Page title="ИГРОК НЕ НАЙДЕН" sub="Проверь ссылку на профиль"><Link className="gold inline-gold" to="/roster">← ВЕРНУТЬСЯ В СОСТАВ</Link></Page>;

  const data = state.data;
  const profile = data?.profile || {};
  const wins = data?.wl?.win ?? 0;
  const losses = data?.wl?.lose ?? 0;
  const totalMatches = wins + losses;
  const winrate = totalMatches ? (wins / totalMatches) * 100 : null;
  const totals = data?.totals || [];
  const tm = totalsMap(totals);
  const heroMap = data?.heroMap || [];
  const heroes = [...(data?.heroes || [])].sort((a,b) => (b.games || 0) - (a.games || 0));
  const recent = data?.recentMatches || [];
  const topHeroes = heroes.slice(0, 5);
  const recent10 = recent.slice(0, 10);
  const recentWins = recent10.filter(m => (Number(m.player_slot) < 128 ? m.radiant_win : !m.radiant_win)).length;
  const recentLosses = recent10.length - recentWins;
  const recentWinrate = recent10.length ? (recentWins / recent10.length) * 100 : null;
  const avgRecentDuration = recent10.length ? recent10.reduce((sum, m) => sum + Number(m.duration || 0), 0) / recent10.length : null;
  const avgRecentGpm = recent10.length ? recent10.reduce((sum, m) => sum + Number(m.gold_per_min || 0), 0) / recent10.length : null;
  const avgRecentXpm = recent10.length ? recent10.reduce((sum, m) => sum + Number(m.xp_per_min || 0), 0) / recent10.length : null;
  const recentK = recent10.length ? recent10.reduce((sum, m) => sum + Number(m.kills || 0), 0) / recent10.length : null;
  const recentD = recent10.length ? recent10.reduce((sum, m) => sum + Number(m.deaths || 0), 0) / recent10.length : null;
  const recentA = recent10.length ? recent10.reduce((sum, m) => sum + Number(m.assists || 0), 0) / recent10.length : null;
  const topHero = topHeroes[0] ? heroMap.find(x => x.id === topHeroes[0].hero_id) : null;
  const streak = recent10.reduce((acc, m) => {
    if (acc.done) return acc;
    const win = Number(m.player_slot) < 128 ? m.radiant_win : !m.radiant_win;
    if (acc.result === null) { acc.result = win; acc.count = 1; }
    else if (acc.result === win) acc.count += 1;
    else acc.done = true;
    return acc;
  }, { result: null, count: 0, done: false });

  return <section className="profile-page">
    <div className="profile-back"><Link to="/roster">← СОСТАВ</Link><span>{isCoach ? "LIVE COACH PROFILE" : "LIVE PLAYER PROFILE"}</span></div>
    <div className="profile-head">
      <div className="profile-art"><img src={player.image} alt={player.name} /></div>
      <div className="profile-title">
        <div className="eyebrow">4T1J / {isCoach ? "COACH DOSSIER" : "PLAYER DOSSIER"}</div>
        <h1>{player.name}</h1>
        <p>{player.position}</p>
        <div className="profile-links">
          {player.steam ? <a href={player.steam} target="_blank" rel="noreferrer">STEAM ↗</a> : null}
          <a href={`https://www.dotabuff.com/players/${player.accountId}`} target="_blank" rel="noreferrer">DOTABUFF ↗</a>
          <a href={`https://dota2protracker.com/player/${player.accountId}`} target="_blank" rel="noreferrer">D2PT ↗</a>
          <a href={`https://www.opendota.com/players/${player.accountId}`} target="_blank" rel="noreferrer">OPENDOTA ↗</a>
        </div>
      </div>
      <div className="profile-id"><small>ACCOUNT ID</small><b>{player.accountId}</b>{profile.rank_tier ? <span>RANK TIER {profile.rank_tier}</span> : null}</div>
    </div>

    {state.loading ? <div className="profile-loading"><div/><div/><div/><div/></div> : null}
    {state.error ? <div className="api-error"><b>OPEN DOTA API</b><span>{state.error}</span><button onClick={() => load(true)}>ПОВТОРИТЬ</button></div> : null}

    {data ? <>
      <div className="stats-grid">
        <StatCard label="МАТЧИ" value={fmt(totalMatches)} />
        <StatCard label="ПОБЕДЫ" value={fmt(wins)} />
        <StatCard label="ПОРАЖЕНИЯ" value={fmt(losses)} />
        <StatCard label="WINRATE" value={pct(winrate)} />
        <StatCard label="K / D / A" value={kdaAvg(totals)} />
        <StatCard label="GPM" value={fmt(tm.gpm?.avg ?? tm.gold_per_min?.avg)} />
        <StatCard label="XPM" value={fmt(tm.xpm?.avg ?? tm.experience_per_min?.avg)} />
        <StatCard label="CS / MATCH" value={fmt(tm.last_hits?.avg)} />
      </div>

      <section className="profile-overview">
        <div className="overview-main">
          <div className="overview-kicker">ФОРМА · ПОСЛЕДНИЕ {recent10.length || 0}</div>
          <div className="overview-form">
            {recent10.map((m, i) => {
              const win = Number(m.player_slot) < 128 ? m.radiant_win : !m.radiant_win;
              return <span key={`${m.match_id}-${i}`} className={win ? "form-win" : "form-loss"}>{win ? "W" : "L"}</span>;
            })}
            {!recent10.length ? <span className="form-empty">НЕТ ДАННЫХ</span> : null}
          </div>
          <div className="overview-meta"><b>{pct(recentWinrate)}</b><span>WINRATE ЗА ПОСЛЕДНИЕ {recent10.length || 0} ИГР</span><em>{streak.count ? `${streak.count} ${streak.result ? "ПОБЕД" : "ПОРАЖЕНИЙ"} ПОДРЯД` : "—"}</em></div>
        </div>
        <div className="overview-card">
          <small>СИГНАТУРНЫЙ ГЕРОЙ</small>
          <div className="overview-hero">
            {topHero ? <HeroIcon heroId={topHeroes[0].hero_id} heroMap={heroMap} /> : null}
            <div><b>{topHero?.localized_name || "—"}</b><span>{topHeroes[0] ? `${fmt(topHeroes[0].games)} матчей · ${pct(topHeroes[0].games ? (topHeroes[0].win / topHeroes[0].games) * 100 : null)}` : "Нет данных"}</span></div>
          </div>
        </div>
        <div className="overview-card">
          <small>СРЕДНИЕ · ПОСЛЕДНИЕ ИГРЫ</small>
          <div className="overview-mini-grid">
            <div><b>{fmt(avgRecentGpm)}</b><span>GPM</span></div>
            <div><b>{fmt(avgRecentXpm)}</b><span>XPM</span></div>
            <div><b>{recentK === null ? "—" : `${recentK.toFixed(1)} / ${recentD.toFixed(1)} / ${recentA.toFixed(1)}`}</b><span>K / D / A</span></div>
            <div><b>{duration(avgRecentDuration)}</b><span>СР. ДЛИТ.</span></div>
          </div>
        </div>
      </section>

      <div className="profile-columns">
        <section className="profile-box">
          <div className="box-heading"><h2>ЛЮБИМЫЕ ГЕРОИ</h2><span>ALL TRACKED MATCHES</span></div>
          <div className="hero-list">
            {topHeroes.map(h => {
              const hero = heroMap.find(x => x.id === h.hero_id);
              const wr = h.games ? (h.win / h.games) * 100 : 0;
              return <div className="hero-row" key={h.hero_id}>
                <HeroIcon heroId={h.hero_id} heroMap={heroMap} />
                <div className="hero-name"><b>{hero?.localized_name || `Hero #${h.hero_id}`}</b><small>{fmt(h.games)} матчей</small></div>
                <strong>{pct(wr)}</strong>
                <span>{fmt(h.win)}W / {fmt((h.games || 0) - (h.win || 0))}L</span>
              </div>;
            })}
            {!topHeroes.length ? <div className="empty">Нет данных по героям.</div> : null}
          </div>
        </section>

        <section className="profile-box">
          <div className="box-heading"><h2>ПРОФИЛЬ</h2><span>OPENDOTA</span></div>
          <div className="mini-details">
            <div><small>НИК</small><b>{profile.personaname || player.nickname}</b></div>
            <div><small>MMR ОЦЕНКА</small><b>{fmt(profile.mmr_estimate?.estimate)}</b></div>
            <div><small>РЕГИОН</small><b>{profile.loccountrycode || "—"}</b></div>
            <div><small>ОБНОВЛЕНИЕ</small><b>{data.cached ? "из кэша браузера" : "только что"}</b></div>
          </div>
          <button className="refresh-btn" onClick={() => load(true)}>ОБНОВИТЬ ДАННЫЕ</button>
        </section>
      </div>

      <section className="profile-box recent-box">
        <div className="box-heading"><h2>ПОСЛЕДНИЕ МАТЧИ</h2><span>{recent.length} ИГР</span></div>
        <div className="matches-table">
          <div className="match-head"><span>РЕЗУЛЬТАТ</span><span>ГЕРОЙ</span><span>K / D / A</span><span>GPM / XPM</span><span>ДЛИТ.</span><span>КОГДА</span></div>
          {recent.slice(0, 20).map((m) => {
            const radiant = Number(m.player_slot) < 128;
            const win = radiant ? m.radiant_win : !m.radiant_win;
            return <div className="match-row" key={m.match_id}>
              <span className={win ? "win" : "loss"}>{win ? "WIN" : "LOSS"}</span>
              <span className="match-hero"><HeroIcon heroId={m.hero_id} heroMap={heroMap} /> {heroMap.find(x => x.id === m.hero_id)?.localized_name || `Hero #${m.hero_id}`}</span>
              <span>{m.kills}/{m.deaths}/{m.assists}</span>
              <span>{fmt(m.gold_per_min)} / {fmt(m.xp_per_min)}</span>
              <span>{duration(m.duration)}</span>
              <span>{relDate(m.start_time)}</span>
            </div>;
          })}
          {!recent.length ? <div className="empty">Нет последних матчей.</div> : null}
        </div>
      </section>
    </> : null}

    <div className="data-note">Статистика загружается из OpenDota API по Account ID {isCoach ? "тренера" : "игрока"}. Данные обновляются при открытии профиля; браузер кэширует результат на 5 минут.</div>
  </section>;
}


function SynergyStat({ stat, compact = false }) {
  const winrate = Number(stat.winrate || 0);
  const names = stat.player_names || [];
  return <div className={compact ? "synergy-stat compact" : "synergy-stat"}>
    <div className="synergy-stat-top">
      <div className="synergy-players">{names.map((name, i) => <span key={`${name}-${i}`}>{name}</span>)}</div>
      <strong className={winrate >= 50 ? "positive" : "negative"}>{pct(winrate)}</strong>
    </div>
    <div className="synergy-stat-meta">
      <span>{stat.matches} ИГР</span><span>{stat.wins}W / {stat.losses}L</span>
      {!compact ? <span>{duration(Number(stat.avg_duration || 0))} ср. длит.</span> : null}
    </div>
    {!compact ? <div className="synergy-bar"><i style={{width:`${Math.max(0, Math.min(100, winrate))}%`}} /></div> : null}
  </div>;
}

function Synergy() {
  const [state, setState] = useState({ loading: true, error: "", stats: [] });
  const [tab, setTab] = useState(2);

  useEffect(() => {
    let alive = true;
    if (!supabaseConfigured) {
      setState({ loading: false, error: "Supabase не настроен", stats: [] });
      return () => { alive = false; };
    }
    listSynergyStats()
      .then(stats => alive && setState({ loading: false, error: "", stats: Array.isArray(stats) ? stats : [] }))
      .catch(e => alive && setState({ loading: false, error: e.message || "Не удалось загрузить аналитику", stats: [] }));
    return () => { alive = false; };
  }, []);

  const stats = state.stats;
  const pairs = stats.filter(x => Number(x.combination_size) === 2);
  const triples = stats.filter(x => Number(x.combination_size) === 3);
  const quads = stats.filter(x => Number(x.combination_size) === 4);
  const five = stats.filter(x => Number(x.combination_size) === 5);
  const shown = tab === 2 ? pairs : tab === 3 ? triples : tab === 4 ? quads : five;
  const playerById = new Map(synergyPlayers.map(p => [p.accountId, p]));

  const matrix = synergyPlayers.map(a => synergyPlayers.map(b => {
    if (a.accountId === b.accountId) return null;
    return pairs.find(x => {
      const ids = (x.account_ids || []).map(Number);
      return ids.includes(a.accountId) && ids.includes(b.accountId);
    }) || null;
  }));

  return <Page title="СИНЕРГИЯ СОСТАВА" sub="ВИНРЕЙТ КОМБИНАЦИЙ 4T1J ПО РЕАЛЬНЫМ МАТЧАМ">
    <div className="synergy-hero">
      <div><small>OPENDOTA → SUPABASE → ANALYTICS</small><h2>КАК ИГРАЕТ СОСТАВ ВМЕСТЕ</h2><p>Матчи собираются отдельно, сохраняются в Supabase и не пересчитываются в браузере при каждом открытии страницы.</p></div>
      <div className="synergy-status"><span className="live-dot" /> {state.loading ? "ЗАГРУЗКА" : state.error ? "ОШИБКА" : `${stats.length} КОМБИНАЦИЙ`}</div>
    </div>

    {state.loading ? <div className="synergy-loading"><div/><div/><div/></div> : null}
    {state.error ? <div className="api-error"><b>SYNERGY ANALYTICS</b><span>{state.error}</span><p>После первого запуска синхронизации данные появятся здесь автоматически.</p></div> : null}

    {!state.loading && !state.error ? <>
      <section className="synergy-box synergy-matrix-box">
        <div className="box-heading"><h2>ПАРЫ ИГРОКОВ</h2><span>WINRATE / MATCHES</span></div>
        <div className="synergy-matrix-wrap">
          <div className="synergy-matrix">
            <div className="matrix-corner">4T1J</div>
            {synergyPlayers.map(p => <div className="matrix-head" key={`h-${p.accountId}`}>{p.name}</div>)}
            {synergyPlayers.map((a, ri) => <Fragment key={a.accountId}>
              <div className="matrix-head matrix-side">{a.name}</div>
              {synergyPlayers.map((b, ci) => {
                const stat = matrix[ri][ci];
                return <div className={stat ? `matrix-cell ${Number(stat.winrate) >= 50 ? "is-positive" : "is-negative"}` : "matrix-cell empty"} key={`${a.accountId}-${b.accountId}`}>
                  {a.accountId === b.accountId ? <span>—</span> : stat ? <><b>{pct(stat.winrate)}</b><small>{stat.matches} игр</small></> : <span>—</span>}
                </div>;
              })}
            </Fragment>)}
          </div>
        </div>
        <div className="synergy-note">Ячейка учитывает только матчи, где оба игрока были на одной стороне. Это именно командный winrate, а не просто наличие обоих игроков в одной игре.</div>
      </section>

      <section className="synergy-box">
        <div className="box-heading"><h2>КОМБИНАЦИИ</h2><span>2 → 5 ИГРОКОВ</span></div>
        <div className="synergy-tabs">
          {[2,3,4,5].map(size => <button key={size} className={tab === size ? "active" : ""} onClick={() => setTab(size)}>{size === 5 ? "ПЯТЁРКА" : `${size} ИГРОКА`}</button>)}
        </div>
        {shown.length ? <div className={`synergy-grid size-${tab}`}>{shown.map(stat => <SynergyStat key={stat.combination_key} stat={stat} />)}</div> : <div className="empty synergy-empty">Пока нет сохранённых матчей для этой комбинации.</div>}
      </section>

      <section className="synergy-box synergy-explain">
        <div className="box-heading"><h2>ЧТО СЧИТАЕМ</h2><span>АВТОМАТИЧЕСКИ</span></div>
        <div className="synergy-explain-grid">
          <div><b>2 / 3 / 4 / 5</b><span>Размер комбинации</span></div>
          <div><b>W / L / WR</b><span>Победы, поражения и винрейт</span></div>
          <div><b>K / D / A</b><span>Средние показатели выбранной группы</span></div>
          <div><b>GPM / XPM</b><span>Средние показатели фарма</span></div>
        </div>
        <p className="synergy-note">Источник матчей — OpenDota. Синхронизатор периодически забирает новые матчи, сохраняет их в Supabase и заново строит агрегаты. Ключи API на сайт не попадают.</p>
      </section>
    </> : null}
  </Page>;
}

function NotFound() {
  return <PageShell title="404" sub="СТРАНИЦА НЕ НАЙДЕНА"><div className="admin-setup"><h2>Страница не найдена</h2><p>Запрошенный адрес не существует.</p><Link className="cta" to="/">НА ГЛАВНУЮ →</Link></div></PageShell>;
}

export default function App() {
  return <Layout><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/roster" element={<Roster />} />
    <Route path="/roster/player/:accountId" element={<PlayerProfile />} />
    <Route path="/matches" element={<Matches />} />
    <Route path="/news" element={<News />} />
    <Route path="/media" element={<Media />} />
    <Route path="/highlights" element={<Highlights />} />
    <Route path="/synergy" element={<Synergy />} />
    <Route path="/4t1j-media-control-7f3m9k" element={<Admin />} />
    <Route path="/admin" element={<NotFound />} />
    <Route path="/about" element={<About />} />
  </Routes></Layout>;
}
