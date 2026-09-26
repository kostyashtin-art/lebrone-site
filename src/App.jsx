import { Link, NavLink, Routes, Route, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Highlights, Admin } from "./Highlights";
import { listCupResults, createCupResult, deleteCupResult, supabaseConfigured } from "./supabase";

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
    accent: "#60a5fa"
  }
];

const nav = [
  ["/", "ГЛАВНАЯ"],
  ["/roster", "СОСТАВ"],
  ["/matches", "МАТЧИ"],
  ["/news", "НОВОСТИ"],
  ["/media", "МЕДИА"],
  ["/highlights", "ХАЙЛАЙТЫ"],
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
          <span className="brand-caption">4 TATARS 1 JEW</span>
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
        <em>ДРУЖБА НАРОДОВ</em>
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
          <div className="logo-sub">4 TATARS 1 JEW</div>
        </div>
        <div className="hero-message"><h2>БОЛЬШЕ ЧЕМ КОМАНДА</h2><p>ДРУЖБА. ИГРА. РАЗВИТИЕ.</p></div>
        <Link className="cta" to="/roster">СМОТРЕТЬ СОСТАВ <b>→</b></Link>
      </div>
      <div className="hero-side-text"><span>GOOD PEOPLE</span><span>GOOD DOTA</span><span>4 TATARS</span><span>1 JEW</span><b>♛</b></div>
      <div className="scroll">SCROLL<i>↓</i></div>
    </section>

    <section className="grid roster-home">
      <div className="panel roster-panel">
        <label><span>СОСТАВ КОМАНДЫ</span><Link to="/roster">ВЕСЬ СОСТАВ →</Link></label>
        <div className="players">{players.map(p => <PlayerCard p={p} key={p.id} />)}</div>
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
  return <Page title="СОСТАВ" sub="ПЯТЬ ИГРОКОВ. ОДНА КОМАНДА. КЛИКНИ ПО КАРТОЧКЕ.">
    <div className="roster">{players.map(p => <PlayerCard p={p} large key={p.id} />)}</div>
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
  return <Page title="О КОМАНДЕ" sub="GOOD PEOPLE. GOOD DOTA."><div className="about"><b>4T1J</b><p>4 TATARS 1 JEW — команда, построенная вокруг игры, дружбы и развития. На сайте собраны состав, статистика игроков, матчи, новости и медиа.</p></div></Page>;
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
  const player = useMemo(() => players.find(p => String(p.accountId) === String(accountId)), [accountId]);
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

  return <section className="profile-page">
    <div className="profile-back"><Link to="/roster">← СОСТАВ</Link><span>LIVE PLAYER PROFILE</span></div>
    <div className="profile-head">
      <div className="profile-art"><img src={player.image} alt={player.name} /></div>
      <div className="profile-title">
        <div className="eyebrow">4T1J / PLAYER DOSSIER</div>
        <h1>{player.name}</h1>
        <p>{player.position}</p>
        <div className="profile-links">
          <a href={player.steam} target="_blank" rel="noreferrer">STEAM ↗</a>
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

    <div className="data-note">Статистика загружается из OpenDota API по Account ID игрока. Данные обновляются при открытии профиля; браузер кэширует результат на 5 минут.</div>
  </section>;
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
    <Route path="/4t1j-media-control-7f3m9k" element={<Admin />} />
    <Route path="/admin" element={<NotFound />} />
    <Route path="/about" element={<About />} />
  </Routes></Layout>;
}
