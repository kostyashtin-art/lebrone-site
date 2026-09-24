import{Link,NavLink,Routes,Route}from"react-router-dom";

const players=[
  {id:1,name:"АРТЕМ",role:"CARRY",image:"/lebrone-site/players/player-1.png"},
  {id:2,name:"ИЛЬШАТ",role:"MID",image:"/lebrone-site/players/player-2.png"},
  {id:3,name:"КОСТЯ",role:"OFFLANE",image:"/lebrone-site/players/player-3.png"},
  {id:4,name:"КИРИЛЛ",role:"SUPPORT",image:"/lebrone-site/players/player-4.png"},
  {id:5,name:"ИНСАФ",role:"SUPPORT",image:"/lebrone-site/players/player-5.png"}
];

function Layout({children}){return <div className="site"><header><Link className="brand" to="/"><b>4T<span>1</span>J</b><small>4 TATARS 1 JEW</small></Link><nav>{[['/','ГЛАВНАЯ'],['/roster','СОСТАВ'],['/matches','МАТЧИ'],['/news','НОВОСТИ'],['/media','МЕДИА'],['/about','О КОМАНДЕ']].map(x=><NavLink key={x[0]} to={x[0]} end={x[0]=='/'}>{x[1]}</NavLink>)}</nav><button>ПОДДЕРЖАТЬ</button></header>{children}<footer><b>4T<span>1</span>J</b><span>© 2026 4T1J ESPORTS</span><em>ДРУЖБА НАРОДОВ</em></footer></div>}

function PlayerCard({p,large=false}){return <Link to="/roster" className={large?"roster-card roster-card-large":"player"}><div className="player-photo"><img src={p.image} alt={p.name}/><span className="player-number">{String(p.id).padStart(2,"0")}</span><div className="photo-shade"/></div><div className="player-info"><b>{p.name}</b><small>{p.role}</small><i/></div></Link>}

function Home(){return <><section className="hero">
  <div className="hero-copy">
    <div className="eyebrow">DOTA 2 ESPORTS TEAM</div>
    <div className="fire-logo"><div className="logo-crown">♛</div><div className="logo-main"><span>4T</span><strong>1</strong><span>J</span></div><div className="logo-sub">4 TATARS 1 JEW</div></div>
    <div className="hero-message"><h2>БОЛЬШЕ ЧЕМ КОМАНДА</h2><p>ДРУЖБА. ИГРА. РАЗВИТИЕ.</p></div>
    <Link className="cta" to="/matches">СЛЕДИТЬ ЗА МАТЧАМИ <b>→</b></Link>
  </div>
  <div className="hero-side-text"><span>GOOD PEOPLE</span><span>GOOD DOTA</span><span>4 TATARS</span><span>1 JEW</span><b>♛</b></div>
  <div className="scroll">SCROLL<i>↓</i></div>
</section>

<section className="grid roster-home">
  <div className="panel roster-panel">
    <label><span>СОСТАВ КОМАНДЫ</span><Link to="/roster">ВЕСЬ СОСТАВ →</Link></label>
    <div className="players">{players.map(p=><PlayerCard p={p} key={p.id}/>)}</div>
  </div>
  <div className="panel match"><label>СЛЕДУЮЩИЙ МАТЧ</label><div className="versus"><strong>4T<span>1</span>J</strong><b>VS</b><strong>R</strong></div><small>LAN EVENT / GROUP STAGE</small><div className="timer"><b>02<small>ДНЯ</small></b><b>14<small>ЧАСОВ</small></b><b>35<small>МИНУТ</small></b></div><Link className="gold" to="/matches">ВСЕ МАТЧИ →</Link></div>
</section>

<section className="grid lower"><Link className="news" to="/news"><small>ПОСЛЕДНИЕ НОВОСТИ</small><h2>4T1J НА LAN-ТУРНИРЕ:<br/>ПЕРВЫЙ ШАГ К БОЛЬШИМ ПОБЕДАМ</h2><span>21 СЕН 2026</span><b>→</b></Link><Link className="merch" to="/media"><small>НАШ МЕРЧ</small><div className="shirt">4T1J</div><h2>СТИЛЬ,<br/>КОТОРЫЙ ОБЪЕДИНЯЕТ</h2><span>СМОТРЕТЬ →</span></Link></section>
<div className="partners">DOTA 2　 STEAM　 LOGITECH G　 HYPERX　 ZOWIE　 MONSTER ENERGY</div></>}

function Page({title,sub,children}){return <section className="page"><small>4T1J ESPORTS</small><h1>{title}</h1><p>{sub}</p>{children}</section>}

function Roster(){return <Page title="СОСТАВ" sub="ПЯТЬ ИГРОКОВ. ОДНА КОМАНДА."><div className="roster">{players.map(p=><PlayerCard p={p} large key={p.id}/>)}</div></Page>}

function Matches(){return <Page title="МАТЧИ" sub="РАСПИСАНИЕ И РЕЗУЛЬТАТЫ 4T1J"><div className="rows"><div>LAN EVENT　 <b>4T1J</b>　 VS　 RIVAL TEAM　 <em>02 ДНЯ</em></div><div>ONLINE　 <b>4T1J</b>　 VS　 TEAM NORTH　 <em>28 СЕН</em></div><div>ONLINE　 <b>4T1J</b>　 2 : 1　 RED FOX　 <em>ПОБЕДА</em></div></div></Page>}

function News(){return <Page title="НОВОСТИ" sub="ПОСЛЕДНИЕ СОБЫТИЯ КОМАНДЫ"><div className="rows"><div>21.09.2026　 <b>4T1J НА LAN-ТУРНИРЕ: ПЕРВЫЙ ШАГ К БОЛЬШИМ ПОБЕДАМ</b>　→</div><div>18.09.2026　 <b>НОВЫЙ СОСТАВ 4T1J ГОТОВ К СЕЗОНУ</b>　→</div><div>12.09.2026　 <b>ЗА КУЛИСАМИ: ТРЕНИРОВКИ И ПОДГОТОВКА</b>　→</div></div></Page>}

function Media(){return <Page title="МЕДИА" sub="ФОТО, ВИДЕО И МЕРЧ 4T1J"><div className="media"><div>TEAM<br/>SPIRIT</div><div>4T1J<br/>MEDIA</div><div>MATCH<br/>DAY</div><div>MERCH<br/>DROP</div></div></Page>}

function About(){return <Page title="О КОМАНДЕ" sub="GOOD PEOPLE. GOOD DOTA."><div className="about"><b>4T1J</b><p>4 TATARS 1 JEW — команда, построенная вокруг игры, дружбы и развития. Здесь будут история состава, матчи, новости, медиа и мерч.</p></div></Page>}

export default function App(){return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/roster" element={<Roster/>}/><Route path="/matches" element={<Matches/>}/><Route path="/news" element={<News/>}/><Route path="/media" element={<Media/>}/><Route path="/about" element={<About/>}/></Routes></Layout>}
