import { Link, NavLink, Routes, Route, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Highlights, Admin } from "./Highlights";
import { listCupResults, createCupResult, deleteCupResult, listHighlights, supabaseConfigured } from "./supabase";

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
  },

];

const coach = {
  name: "ГРИША",
  role: "COACH",
  position: "Тренер команды",
  accountId: 198826325,
  image: "/players/coach-grisha.png"
};

const nav = [
  ["/", "ГЛАВНАЯ"],
  ["/roster", "СОСТАВ"],
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

function PageTransitionLoader() {
  const location = useLocation();
  const firstRender = useRef(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const initial = firstRender.current;
    firstRender.current = false;
    setVisible(true);
    try {
      sessionStorage.setItem("4t1j:loader-seen", "1");
    } catch {}
    const timer = setTimeout(() => setVisible(false), initial ? 780 : 360);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!visible) return null;
  return (
    <div className="route-loader" role="status" aria-live="polite">
      <div className="route-loader-mark">
        <span>4T</span><b>1</b><span>J</span>
      </div>
      <div className="route-loader-line"><i /></div>
      <small>4T1J ESPORTS / LOADING</small>
    </div>
  );
}

function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site">
      <PageTransitionLoader />
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
        </nav>
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
      const next = nextBattleCupTarget();
      setTarget(next);
      setLeft(next.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    listCupResults().then(setResults).catch(() => setResults([]));
  }, []);

  const wins = results.filter(x => x.result === "win").length;
  const losses = results.filter(x => x.result === "loss").length;
  const days = Math.max(0, Math.floor(left / 86400000));
  const hours = Math.max(0, Math.floor((left % 86400000) / 3600000));
  const minutes = Math.max(0, Math.floor((left % 3600000) / 60000));
  const seconds = Math.max(0, Math.floor((left % 60000) / 1000));
  const form = results.slice(0, 6);

  return <section id="battle-cup-home" className="battle-cup compact-cup">
    <div className="compact-cup-head">
      <div>
        <div className="battle-cup-kicker"><span className="live-dot" /> 4T1J / WEEKLY EVENT</div>
        <h2>БОЕВОЙ <span>КУБОК</span></h2>
      </div>
      <div className="compact-cup-next"><small>СЛЕДУЮЩИЙ СТАРТ</small><b>{target.toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", timeZone:"Europe/Moscow" })} · 21:00 МСК</b></div>
    </div>
    <div className="compact-cup-body">
      <div className="compact-countdown" aria-label="Отсчёт до боевого кубка">
        <span><b>{String(days).padStart(2, "0")}</b><small>ДН</small></span>
        <i>:</i><span><b>{String(hours).padStart(2, "0")}</b><small>Ч</small></span>
        <i>:</i><span><b>{String(minutes).padStart(2, "0")}</b><small>МИН</small></span>
        <i>:</i><span><b>{String(seconds).padStart(2, "0")}</b><small>СЕК</small></span>
      </div>
      <div className="compact-cup-stats">
        <div><b className="win">{wins}</b><span>ПОБЕД</span></div>
        <em>:</em>
        <div><b className="loss">{losses}</b><span>ПОРАЖ.</span></div>
      </div>
      <div className="compact-cup-form">
        <small>ФОРМА</small>
        <div>{form.length ? form.map(r => <span key={r.id} className={r.result === "win" ? "cup-win" : "cup-loss"} title={`${r.cup_date}${r.opponent ? ` · ${r.opponent}` : ""}`}>{r.result === "win" ? "W" : "L"}</span>) : <span className="form-empty">—</span>}</div>
      </div>
    </div>
    <div className="compact-cup-foot">
      <span>РЕЗУЛЬТАТЫ ОБНОВЛЯЮТСЯ АВТОМАТИЧЕСКИ</span>
      <Link to="/roster" className="cup-link">СОСТАВ →</Link>
    </div>
  </section>;
}

function LiveDota({ compact = false }) {
  const [state, setState] = useState({ loading: true, error: "", players: [], updatedAt: null });
  const byId = useMemo(() => new Map(players.map(p => [Number(p.accountId), p])), []);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const games = await fetchJson("/live");
        const detected = new Map();
        for (const game of Array.isArray(games) ? games : []) {
          for (const item of Array.isArray(game?.players) ? game.players : []) {
            const p = byId.get(Number(item?.account_id));
            if (!p) continue;
            detected.set(p.accountId, {
              ...p,
              matchId: game?.match_id || null,
              heroId: item?.hero_id || null
            });
          }
        }
        if (alive) setState({ loading: false, error: "", players: [...detected.values()], updatedAt: Date.now() });
      } catch (e) {
        if (alive) setState(prev => ({ ...prev, loading: false, error: e.message || "LIVE недоступен", updatedAt: Date.now() }));
      }
    }
    refresh();
    const timer = setInterval(refresh, 45000);
    return () => { alive = false; clearInterval(timer); };
  }, [byId]);

  const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—";

  if (compact) {
    return (
      <section className="live-dota hero-live-dota" aria-label="Статус игроков 4T1J в Dota 2">
        <div className="hero-live-head">
          <div><span className="hero-live-dot" /> <b>LIVE DOTA</b></div>
          <span>{state.players.length ? `${state.players.length} ИГРОКА В ИГРЕ` : "КОМАНДА НЕ В ИГРЕ"}</span>
        </div>
        {state.error ? (
          <div className="hero-live-empty">OpenDota временно недоступен</div>
        ) : state.loading ? (
          <div className="hero-live-skeleton"><i /><i /><i /><i /><i /></div>
        ) : state.players.length ? (
          <div className="hero-live-list">
            {state.players.map(p => (
              <Link className="hero-live-player" key={p.accountId} to={`/roster/player/${p.accountId}`} title={`${p.name} · ${p.role}`}>
                <span className="hero-live-avatar"><img src={p.image} alt="" /></span>
                <span className="hero-live-copy"><b>{p.name}</b><small>{p.role}</small></span>
                <i />
              </Link>
            ))}
            {Array.from({ length: Math.max(0, 5 - state.players.length) }).map((_, i) => <span className="hero-live-placeholder" key={`empty-${i}`} />)}
          </div>
        ) : (
          <div className="hero-live-empty">Сейчас никто из состава не играет</div>
        )}
        <div className="hero-live-foot"><span>ОБНОВЛЕНО {updated}</span><a href="https://steamcommunity.com/app/570" target="_blank" rel="noreferrer">STEAM ↗</a></div>
      </section>
    );
  }

  return (
    <section className="live-dota" aria-label="Статус игроков 4T1J в Dota 2">
      <div className="live-dota-head">
        <div>
          <small><i /> LIVE DOTA</small>
          <h2>СЕЙЧАС В ИГРЕ</h2>
        </div>
        <span>ОБНОВЛЕНО {updated}</span>
      </div>
      {state.error ? (
        <div className="live-dota-empty"><b>СТАТУС НЕДОСТУПЕН</b><span>OpenDota временно не ответил. Обновим автоматически.</span></div>
      ) : state.loading ? (
        <div className="live-dota-skeleton"><i /><i /><i /></div>
      ) : state.players.length ? (
        <div className="live-dota-list">
          {state.players.map(p => (
            <Link className="live-player" key={p.accountId} to={`/roster/player/${p.accountId}`}>
              <span className="live-avatar"><img src={p.image} alt="" /></span>
              <span className="live-player-main"><b>{p.name}</b><small>{p.role} · В ИГРЕ</small></span>
              <span className="live-player-status"><i /> LIVE{p.matchId ? ` · ${p.matchId}` : ""}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="live-dota-empty"><b>СЕЙЧАС НИКТО НЕ ИГРАЕТ</b><span>Когда игрок 4T1J появится в live-матче, он отобразится здесь автоматически.</span></div>
      )}
    </section>
  );
}

function HomeInsights() {
  const [results, setResults] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!supabaseConfigured) return undefined;
    listCupResults()
      .then(data => { if (alive) setResults(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setResults([]); });
    return () => { alive = false; };
  }, []);

  const latest = results[0] || null;
  const wins = results.filter(x => x.result === "win").length;
  const losses = results.filter(x => x.result === "loss").length;
  const total = wins + losses;
  const winrate = total ? (wins / total) * 100 : null;
  const form = results.slice(0, 10);
  const latestDate = latest?.cup_date ? new Date(`${latest.cup_date}T12:00:00`) : null;
  const latestLabel = latestDate ? latestDate.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "ПОКА НЕТ ДАННЫХ";

  return (
    <section className="home-insights">
      <article className="home-last-game home-surface">
        <div className="home-section-head"><small>RECENT / BATTLE CUP</small><span>ПОСЛЕДНИЙ РЕЗУЛЬТАТ</span></div>
        <h3>ПОСЛЕДНЯЯ ИГРА</h3>
        {latest ? (
          <>
            <div className="home-match-line">
              <strong>4T1J</strong>
              <b>{latest.score || "— : —"}</b>
              <span>{latest.opponent || "СОПЕРНИК"}</span>
            </div>
            <div className={`home-result ${latest.result === "win" ? "is-win" : "is-loss"}`}>
              {latest.result === "win" ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}
            </div>
            <div className="home-match-meta"><span>{latestLabel}</span><span>BATTLE CUP</span><span>{latest.note || "РЕЗУЛЬТАТ СОХРАНЁН"}</span></div>
          </>
        ) : (
          <div className="home-empty-card"><b>ПОКА НЕТ РЕЗУЛЬТАТОВ</b><span>Добавь первый результат через админку Battle Cup.</span></div>
        )}
        <a className="home-outline-link" href="#battle-cup-home">ВСЕ РЕЗУЛЬТАТЫ →</a>
      </article>

      <article className="home-team-stats home-surface">
        <div className="home-section-head"><small>TEAM PERFORMANCE</small><span>ПО BATTLE CUP</span></div>
        <h3>СТАТИСТИКА КОМАНДЫ</h3>
        <div className="home-stat-grid">
          <div><small>МАТЧИ</small><b>{fmt(total)}</b></div>
          <div><small>ПОБЕДЫ</small><b>{fmt(wins)}</b></div>
          <div><small>WINRATE</small><b>{pct(winrate)}</b></div>
        </div>
        <div className="home-form-block"><small>ТЕКУЩАЯ ФОРМА</small><div>{form.length ? form.map(r => <span key={r.id} className={r.result === "win" ? "is-win" : "is-loss"}>{r.result === "win" ? "W" : "L"}</span>) : <em>—</em>}</div></div>
      </article>

      <article className="home-achievements home-surface">
        <div className="home-section-head"><small>4T1J / MILESTONES</small><span>КОМАНДА</span></div>
        <h3>ДОСТИЖЕНИЯ</h3>
        <div className="trophy-art" aria-hidden="true">♛</div>
        <strong className="achievement-title">BATTLE CUP</strong>
        <span className="achievement-sub">УЧАСТИЕ И ОПЫТ</span>
        <div className="achievement-meta"><span>РЕЗУЛЬТАТОВ</span><b>{fmt(results.length)}</b></div>
      </article>
    </section>
  );
}

function HomeMedia() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    if (!supabaseConfigured) return undefined;
    listHighlights().then(data => { if (alive) setItems(Array.isArray(data) ? data : []); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);
  const media = items.slice(0, 4);
  return (
    <section className="home-media">
      <div className="home-block-title">
        <div><small>MEDIA / 4T1J</small><h2>МЕДИА</h2><p>ФОТО, ВИДЕО И КОНТЕНТ КОМАНДЫ.</p></div>
        <div className="home-media-tabs"><span className="active">ВСЕ</span><span>ФОТО</span><span>ВИДЕО</span><Link to="/highlights">ХАЙЛАЙТЫ →</Link></div>
      </div>
      <div className="home-media-grid">
        {media.length ? (
          <>
            {media.map((item, index) => (
              <Link to="/highlights" className={index === 0 ? "home-media-card is-featured" : "home-media-card"} key={item.id}>
                <div className="home-media-thumb">
                  {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" /> : <div className="home-media-placeholder"><b>4T1J</b><span>{item.hero || "DOTA 2"}</span></div>}
                  <em>{index === 0 ? "ГЛАВНЫЙ" : "ХАЙЛАЙТ"}</em><strong>▶</strong>
                </div>
                <div><small>{item.player || "4T1J"}</small><h3>{item.title}</h3><p>{item.description || "Лучшие моменты команды."}</p></div>
              </Link>
            ))}
            <div className="home-media-card home-media-static">
              <div className="home-media-thumb home-media-art"><span>♛</span></div>
              <div><small>4T1J / TEAM LIFE</small><h3>КОМАНДНАЯ ЖИЗНЬ</h3><p>Тренировки, будни и атмосфера команды.</p></div>
            </div>
          </>
        ) : (
          <>
            <Link to="/highlights" className="home-media-empty"><b>4T1J</b><span>ОТКРОЙ ХАЙЛАЙТЫ</span><em>ПОСМОТРЕТЬ КОНТЕНТ →</em></Link>
            <div className="home-media-card home-media-static">
              <div className="home-media-thumb home-media-art"><span>♛</span></div>
              <div><small>4T1J / TEAM LIFE</small><h3>КОМАНДНАЯ ЖИЗНЬ</h3><p>Тренировки, будни и атмосфера команды.</p></div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Home() {
  return <>
    <section className="hero home-hero">
      <div className="home-hero-logo-main">
        <img src="/4t1j-logo.png" alt="4T1J" />
      </div>
      <LiveDota compact />
    </section>

    <section className="home-roster-section">
      <div className="home-block-title">
        <div><small>4T1J ESPORTS</small><h2>НАШ СОСТАВ</h2><p>ПЯТЬ ИГРОКОВ. ОДНА КОМАНДА.</p></div>
        <Link to="/roster" className="home-outline-link">ВСЕ ИГРОКИ →</Link>
      </div>
      <div className="home-roster-grid">{players.map(p => <PlayerCard p={p} key={p.id} />)}</div>
    </section>

    <HomeInsights />
    <BattleCup />
    <HomeMedia />
  </>;
}

function Page({ title, sub, children, className = "" }) {
  return <section className={`page ${className}`.trim()}><small>4T1J ESPORTS</small><h1>{title}</h1><p>{sub}</p>{children}</section>;
}

function Roster() {
  return <Page className="roster-page" title="СОСТАВ" sub="ПЯТЬ ИГРОКОВ. ОДИН ТРЕНЕР. ОДНА КОМАНДА.">
    <div className="roster">{players.map(p => <PlayerCard p={p} large key={p.id} />)}</div>
    <section className="coach-section">
      <div className="coach-section-head"><small>4T1J / STAFF</small><h2>ТРЕНЕР</h2><p>ТРЕНЕРСКИЙ ШТАБ КОМАНДЫ</p></div>
      <CoachCard large />
    </section>
  </Page>;
}

function Media() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = supabaseConfigured ? await listHighlights() : [];
        if (alive) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const featured = items.find(item => item.is_featured) || items[0];
  const secondary = items.filter(item => item.id !== featured?.id).slice(0, 5);

  return <Page className="media-page" title="МЕДИА" sub="ФОТО, ВИДЕО И КОНТЕНТ 4T1J">
    <div className="media-toolbar">
      <div className="media-tabs">
        <span className="active">ВСЕ</span>
        <span>ФОТО</span>
        <span>ВИДЕО</span>
        <Link to="/highlights">ХАЙЛАЙТЫ</Link>
        <span>ЗА КАДРОМ</span>
        <span>КОМАНДНАЯ ЖИЗНЬ</span>
      </div>
      <div className="media-actions">
        <span className="media-search">⌕ <span>ПОИСК КОНТЕНТА</span></span>
        <span className="media-sort">СНАЧАЛА НОВЫЕ⌄</span>
      </div>
    </div>

    <div className="media-showcase">
      <Link to="/highlights" className="media-featured">
        <div className="media-featured-thumb">
          {featured?.thumbnail_url ? <img src={featured.thumbnail_url} alt="" /> : <div className="media-placeholder"><b>4T1J</b><span>TEAM CONTENT</span></div>}
          <em>★ ГЛАВНЫЙ</em><strong>▶</strong>
        </div>
        <div className="media-featured-copy">
          <small>{featured?.player ? `${featured.player} · ${featured.hero || "DOTA 2"}` : "4T1J · TEAM CONTENT"}</small>
          <h2>{featured?.title || "4T1J — TEAM MOMENTS"}</h2>
          <p>{featured?.description || "Лучшие командные моменты, тренировки и контент 4T1J."}</p>
          <span>СМОТРЕТЬ ХАЙЛАЙТЫ →</span>
        </div>
      </Link>

      <div className="media-grid">
        {secondary.map((item, index) => (
          <Link to="/highlights" className="media-card" key={item.id}>
            <div className="media-card-thumb">
              {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" /> : <div className="media-placeholder"><b>4T1J</b><span>{item.hero || "DOTA 2"}</span></div>}
              <em>{index % 2 === 0 ? "ХАЙЛАЙТ" : "ВИДЕО"}</em>
            </div>
            <div className="media-card-copy"><small>{item.player || "4T1J"}</small><h3>{item.title}</h3><p>{item.description || "Лучшие моменты команды."}</p></div>
          </Link>
        ))}
        {!loading && !secondary.length ? (
          <Link to="/highlights" className="media-card media-card-static"><div className="media-card-thumb"><div className="media-placeholder"><b>4T1J</b><span>HIGHLIGHTS</span></div><em>ХАЙЛАЙТЫ</em></div><div className="media-card-copy"><small>4T1J MEDIA</small><h3>ЛУЧШИЕ МОМЕНТЫ НАШИХ ИГР</h3><p>Открыть раздел с хайлайтами команды.</p></div></Link>
        ) : null}
        <div className="media-card media-card-static"><div className="media-card-thumb media-card-art"><span>♛</span></div><div className="media-card-copy"><small>4T1J</small><h3>КОМАНДНАЯ ЖИЗНЬ</h3><p>Тренировки, будни и атмосфера команды.</p></div></div>
      </div>
    </div>

    <section className="media-bottom">
      <div><small>4T1J ESPORTS</small><h2>GOOD PEOPLE.<br/><b>GOOD DOTA.</b></h2></div>
      <div className="media-values">
        <span>◈ <b>ИГРАЕМ<br/>ДЛЯ ДУШИ</b></span>
        <span>◎ <b>РАЗВИВАЕМСЯ<br/>ВМЕСТЕ</b></span>
        <span>♜ <b>СТРЕМИМСЯ<br/>К ПОБЕДАМ</b></span>
        <span>↗ <b>СОЗДАЁМ<br/>КОНТЕНТ</b></span>
      </div>
    </section>
  </Page>;
}

function About() {
  return <section className="page about-page"><div className="about-hero"><div className="about-copy"><small>4T1J ESPORTS</small><h1>О КОМАНДЕ</h1><p className="about-sub">GOOD PEOPLE. GOOD DOTA.</p><div className="about-text"><p><strong>4T1J</strong> — команда друзей, которая играет для души.</p><p>Собираемся ради игры, хорошего настроения и красивой Dota. Иногда не проигрываем, а чаще всего — выигрываем.</p><p>Без лишнего пафоса. Просто играем вместе, развиваемся и получаем удовольствие от каждого матча.</p></div></div></div></section>;
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


function NotFound() {
  return <PageShell title="404" sub="СТРАНИЦА НЕ НАЙДЕНА"><div className="admin-setup"><h2>Страница не найдена</h2><p>Запрошенный адрес не существует.</p><Link className="cta" to="/">НА ГЛАВНУЮ →</Link></div></PageShell>;
}

export default function App() {
  return <Layout><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/roster" element={<Roster />} />
    <Route path="/roster/player/:accountId" element={<PlayerProfile />} />
    <Route path="/media" element={<Media />} />
    <Route path="/highlights" element={<Highlights />} />
    <Route path="/4t1j-media-control-7f3m9k" element={<Admin />} />
    <Route path="/admin" element={<NotFound />} />
    <Route path="/about" element={<About />} />
    <Route path="*" element={<NotFound />} />
  </Routes></Layout>;
}
