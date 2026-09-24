import { useParams, Link, NavLink, Routes, Route } from "react-router-dom";

const heroes = [
  { id: "invoker", name: "Invoker", role: "Маг", color: "violet", description: "Универсальный герой с большим количеством заклинаний." },
  { id: "juggernaut", name: "Juggernaut", role: "Керри", color: "red", description: "Мобильный герой ближнего боя с сильным потенциалом." },
  { id: "pudge", name: "Pudge", role: "Танк", color: "green", description: "Известный герой с крюком и большим запасом здоровья." },
  { id: "crystal-maiden", name: "Crystal Maiden", role: "Поддержка", color: "blue", description: "Маг поддержки с сильными способностями контроля." }
];

function Layout({ children }) {
  return (
    <div className="app">
      <header className="header">
        <Link className="logo" to="/">
          <span className="logo-icon">D</span>
          <span>DOTA HUB</span>
        </Link>

        <nav className="nav">
          <NavLink to="/" end>Главная</NavLink>
          <NavLink to="/heroes">Герои</NavLink>
          <NavLink to="/items">Предметы</NavLink>
          <NavLink to="/guides">Гайды</NavLink>
          <NavLink to="/news">Новости</NavLink>
          <NavLink to="/about">О проекте</NavLink>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <span>© 2026 Dota Hub</span>
        <span>React + Vite + GitHub Pages</span>
      </footer>
    </div>
  );
}

function Home() {
  return (
    <section className="home container">
      <div className="home-text">
        <div className="eyebrow">DOTA 2 DATABASE</div>
        <h1>Добро пожаловать<br /><span>в Dota Hub</span></h1>
        <p>
          Полноценный многостраничный сайт, который мы будем постепенно
          превращать в большую базу данных по Dota 2.
        </p>

        <div className="buttons">
          <Link className="button primary" to="/heroes">Исследовать героев</Link>
          <Link className="button secondary" to="/guides">Открыть гайды</Link>
        </div>
      </div>

      <div className="home-panel">
        <div className="orb" />
        <div className="panel-content">
          <small>PROJECT STATUS</small>
          <strong>ONLINE</strong>
          <span>GitHub Pages</span>
        </div>
      </div>
    </section>
  );
}

function Heroes() {
  return (
    <section className="container page">
      <div className="section-head">
        <div>
          <div className="eyebrow">DATABASE</div>
          <h1>Герои</h1>
        </div>
        <p>Нажми на героя — откроется отдельная страница.</p>
      </div>

      <div className="hero-grid">
        {heroes.map(hero => (
          <Link className="hero-card" to={`/heroes/${hero.id}`} key={hero.id}>
            <div className={`hero-icon ${hero.color}`}>{hero.name[0]}</div>
            <div className="hero-info">
              <h2>{hero.name}</h2>
              <span>{hero.role}</span>
            </div>
            <b>→</b>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroPage() {
  const { id } = useParams();
  const hero = heroes.find(item => item.id === id);

  if (!hero) {
    return (
      <section className="container page">
        <div className="placeholder">
          <div className="eyebrow">404</div>
          <h1>Герой не найден</h1>
          <Link className="button primary" to="/heroes">Вернуться к героям</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container page">
      <Link className="back" to="/heroes">← Все герои</Link>

      <div className={`hero-detail ${hero.color}`}>
        <div className="detail-icon">{hero.name[0]}</div>
        <div>
          <div className="eyebrow">HERO PROFILE</div>
          <h1>{hero.name}</h1>
          <div className="role">{hero.role}</div>
          <p>{hero.description}</p>
          <div className="coming">
            Здесь позже появятся характеристики, способности, предметы,
            таланты, билды и статистика.
          </div>
        </div>
      </div>
    </section>
  );
}

function Placeholder({ title, description }) {
  return (
    <section className="container page">
      <div className="placeholder">
        <div className="eyebrow">SECTION</div>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className="button primary" to="/">На главную</Link>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/heroes" element={<Heroes />} />
        <Route path="/heroes/:id" element={<HeroPage />} />
        <Route path="/items" element={<Placeholder title="Предметы" description="Раздел предметов готов к наполнению." />} />
        <Route path="/guides" element={<Placeholder title="Гайды" description="Здесь будут билды и руководства для игроков." />} />
        <Route path="/news" element={<Placeholder title="Новости" description="Здесь появится лента новостей и обновлений." />} />
        <Route path="/about" element={<Placeholder title="О проекте" description="Dota Hub — будущая большая база данных по Dota 2." />} />
        <Route path="*" element={<Placeholder title="404" description="Страница не найдена." />} />
      </Routes>
    </Layout>
  );
}