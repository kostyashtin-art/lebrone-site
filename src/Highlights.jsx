import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createHighlight, deleteHighlight, getSession, listAllHighlights, listHighlights, signIn, signOut, supabaseConfigured, updateHighlight, uploadFile, listCupResults, createCupResult, deleteCupResult, isAdmin } from "./supabase";

const PLAYERS = ["АРТЕМ", "ИЛЬШАТ", "КОСТЯ", "КИРИЛЛ", "ИНСАФ"];
const DEMO = [
  { id:"demo-1", title:"ИЛЬШАТ — SOLO KILL НА MID", player:"ИЛЬШАТ", hero:"Storm Spirit", description:"Демо-карточка. Подключи Supabase, чтобы публиковать реальные хайлайты.", video_url:"", thumbnail_url:"", created_at:"2026-09-24T18:00:00Z", is_featured:true },
  { id:"demo-2", title:"АРТЕМ — ТРОЙНОЙ KILL", player:"АРТЕМ", hero:"Phantom Assassin", description:"Место для первого хайлайта команды.", video_url:"", thumbnail_url:"", created_at:"2026-09-23T18:00:00Z", is_featured:false }
];

function HighlightCard({ item, onOpen }) {
  return <article className="highlight-card" onClick={() => onOpen(item)}>
    <div className="highlight-thumb">
      {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" /> : <div className="highlight-placeholder"><b>4T1J</b><span>{item.hero || "DOTA 2"}</span></div>}
      <div className="highlight-overlay"><span>▶</span></div>
      {item.is_featured ? <em>FEATURED</em> : null}
    </div>
    <div className="highlight-body"><small>{item.player} · {item.hero || "DOTA 2"}</small><h3>{item.title}</h3><p>{item.description || ""}</p><time>{new Date(item.created_at).toLocaleDateString("ru-RU")}</time></div>
  </article>;
}

export function Highlights() {
  const [items, setItems] = useState([]);
  const [player, setPlayer] = useState("ALL");
  const [hero, setHero] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { try { setItems(supabaseConfigured ? await listHighlights() : DEMO); } catch { setItems([]); } finally { setLoading(false); } })(); }, []);
  const heroes = useMemo(() => ["ALL", ...Array.from(new Set(items.map(x => x.hero).filter(Boolean)))], [items]);
  const filtered = items.filter(x => (player === "ALL" || x.player === player) && (hero === "ALL" || x.hero === hero));

  return <PageShell title="ХАЙЛАЙТЫ" sub="ЛУЧШИЕ МОМЕНТЫ 4T1J — KILLS, CLUTCH И КРАСИВЫЕ ИГРЫ">
    {!supabaseConfigured ? <div className="setup-banner"><b>DEMO MODE</b><span>Сейчас показаны демо-карточки. После подключения Supabase здесь будут реальные видео.</span></div> : null}
    <div className="highlight-filters"><select value={player} onChange={e => setPlayer(e.target.value)}><option value="ALL">ВСЕ ИГРОКИ</option>{PLAYERS.map(x => <option key={x}>{x}</option>)}</select><select value={hero} onChange={e => setHero(e.target.value)}>{heroes.map(x => <option key={x} value={x}>{x === "ALL" ? "ВСЕ ГЕРОИ" : x}</option>)}</select></div>
    {loading ? <div className="highlight-loading">ЗАГРУЗКА ХАЙЛАЙТОВ…</div> : <div className="highlights-grid">{filtered.map(item => <HighlightCard key={item.id} item={item} onOpen={setSelected} />)}{!filtered.length ? <div className="empty">Пока нет опубликованных хайлайтов.</div> : null}</div>}
    {selected ? <div className="video-modal" onClick={() => setSelected(null)}><div className="video-dialog" onClick={e => e.stopPropagation()}><button onClick={() => setSelected(null)}>×</button><div className="video-player">{selected.video_url ? <video controls autoPlay playsInline poster={selected.thumbnail_url || undefined} src={selected.video_url} /> : <div className="video-demo">4T1J<br/><span>Здесь будет видео</span></div>}</div><h2>{selected.title}</h2><p>{selected.player} · {selected.hero}</p></div></div> : null}
  </PageShell>;
}

function PageShell({ title, sub, children }) { return <section className="page highlights-page"><small>4T1J ESPORTS / MEDIA</small><h1>{title}</h1><p>{sub}</p>{children}</section>; }

export function Admin() {
  const [session, setSession] = useState(getSession());
  const [adminChecked, setAdminChecked] = useState(false);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState("");
  const [items, setItems] = useState([]); const [saving, setSaving] = useState(false);
  const [cupResults, setCupResults] = useState([]); const [cupSaving, setCupSaving] = useState(false);
  const [cupForm, setCupForm] = useState({ cup_date: new Date().toISOString().slice(0,10), result:"win", score:"", opponent:"", note:"" });
  const [form, setForm] = useState({ title:"", player:PLAYERS[0], hero:"", description:"", is_featured:false, is_published:true, sort_order:0 });
  const [video, setVideo] = useState(null); const [thumb, setThumb] = useState(null);

  async function refresh() { if (!session || !adminAllowed) return; try { const [highlights, cups] = await Promise.all([listAllHighlights(session), listCupResults()]); setItems(highlights); setCupResults(cups); } catch(e) { setMessage(e.message); } }
  useEffect(() => {
    let cancelled = false;
    if (!session) { setAdminAllowed(false); setAdminChecked(true); return; }
    setAdminChecked(false);
    isAdmin(session).then(ok => { if (!cancelled) { setAdminAllowed(ok); setAdminChecked(true); } }).catch(() => { if (!cancelled) { setAdminAllowed(false); setAdminChecked(true); } });
    return () => { cancelled = true; };
  }, [session]);
  useEffect(() => { if (adminAllowed) refresh(); }, [adminAllowed]);
  async function login(e) { e.preventDefault(); setMessage(""); try { const s = await signIn(email, password); setSession(s); } catch(e) { setMessage(e.message); } }
  async function add(e) { e.preventDefault(); if (!video) return setMessage("Выбери MP4-видео."); if (!session) return; setSaving(true); setMessage(""); try { const videoUrl = await uploadFile(session, video, "videos"); const thumbUrl = thumb ? await uploadFile(session, thumb, "thumbnails") : ""; await createHighlight(session, {...form, video_url:videoUrl, thumbnail_url:thumbUrl, sort_order:Number(form.sort_order)||0}); setForm({title:"",player:PLAYERS[0],hero:"",description:"",is_featured:false,is_published:true,sort_order:0}); setVideo(null); setThumb(null); document.getElementById("highlight-video").value=""; document.getElementById("highlight-thumb").value=""; setMessage("Хайлайт опубликован."); await refresh(); } catch(e) { setMessage(e.message); } finally { setSaving(false); } }
  async function remove(id) { if (!confirm("Удалить хайлайт?")) return; try { await deleteHighlight(session,id); await refresh(); } catch(e) { setMessage(e.message); } }
  async function toggle(item) { try { await updateHighlight(session,item.id,{is_published:!item.is_published}); await refresh(); } catch(e) { setMessage(e.message); } }
  async function addCup(e) { e.preventDefault(); if (!session) return; setCupSaving(true); setMessage(""); try { await createCupResult(session, cupForm); setCupForm({...cupForm, result:"win", score:"", opponent:"", note:""}); setMessage("Результат боевого кубка сохранён."); await refresh(); } catch(e) { setMessage(e.message); } finally { setCupSaving(false); } }
  async function removeCup(id) { if (!confirm("Удалить результат кубка?")) return; try { await deleteCupResult(session,id); await refresh(); } catch(e) { setMessage(e.message); } }

  if (!supabaseConfigured) return <PageShell title="ADMIN" sub="ЗАКРЫТАЯ ПАНЕЛЬ 4T1J"><div className="admin-setup"><h2>Нужно подключить Supabase</h2><p>В проект добавлены готовые загрузка MP4, авторизация, база хайлайтов и Storage. Осталось указать два публичных параметра проекта в .env.</p><code>VITE_SUPABASE_URL=…<br/>VITE_SUPABASE_PUBLISHABLE_KEY=…</code><p>Секретный service-role key на сайт не добавляем.</p></div></PageShell>;
  if (!session) return <PageShell title="ADMIN" sub="ЗАКРЫТАЯ ПАНЕЛЬ 4T1J"><form className="admin-login" onSubmit={login}><label>EMAIL<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>ПАРОЛЬ<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button className="gold" type="submit">ВОЙТИ</button>{message ? <p className="form-message">{message}</p>:null}</form></PageShell>;
  if (!adminChecked) return <PageShell title="ADMIN" sub="ПРОВЕРКА ДОСТУПА"><div className="admin-setup"><h2>Проверяем доступ…</h2></div></PageShell>;
  if (!adminAllowed) return <PageShell title="403" sub="ДОСТУП ЗАПРЕЩЁН"><div className="admin-setup"><h2>Нет прав администратора</h2><p>Эта учётная запись не добавлена в список администраторов 4T1J.</p><button className="gold" onClick={()=>{signOut();setSession(null)}}>ВЫЙТИ</button></div></PageShell>;
  return <PageShell title="ADMIN" sub="ЗАКРЫТЫЙ MEDIA CONTROL"><div className="admin-head"><b>4T1J MEDIA CONTROL</b><button onClick={()=>{signOut();setSession(null)}}>ВЫЙТИ</button></div><form className="admin-form" onSubmit={add}><input placeholder="Название хайлайта" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required /><div className="admin-row"><select value={form.player} onChange={e=>setForm({...form,player:e.target.value})}>{PLAYERS.map(x=><option key={x}>{x}</option>)}</select><input placeholder="Герой, например Invoker" value={form.hero} onChange={e=>setForm({...form,hero:e.target.value})} /></div><textarea placeholder="Описание" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><label className="file-input">MP4 видео<input id="highlight-video" type="file" accept="video/mp4,video/webm" onChange={e=>setVideo(e.target.files?.[0]||null)} required/></label><label className="file-input">Превью JPG/PNG<input id="highlight-thumb" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setThumb(e.target.files?.[0]||null)}/></label><div className="checks"><label><input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form,is_featured:e.target.checked})}/> FEATURED</label><label><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})}/> ОПУБЛИКОВАТЬ</label></div><button className="gold" disabled={saving}>{saving ? "ЗАГРУЗКА…" : "ЗАГРУЗИТЬ ХАЙЛАЙТ"}</button>{message?<p className="form-message">{message}</p>:null}</form><div className="admin-list"><h2>БОЕВОЙ КУБОК</h2><p className="admin-help">Добавляй один результат после каждого субботнего кубка. На главной автоматически считаются победы и поражения, а последние результаты показываются как W / L.</p><form className="admin-form cup-admin-form" onSubmit={addCup}><div className="admin-row"><label>ДАТА КУБКА<input type="date" value={cupForm.cup_date} onChange={e=>setCupForm({...cupForm,cup_date:e.target.value})} required/></label><label>РЕЗУЛЬТАТ<select value={cupForm.result} onChange={e=>setCupForm({...cupForm,result:e.target.value})}><option value="win">ПОБЕДА</option><option value="loss">ПОРАЖЕНИЕ</option></select></label></div><div className="admin-row"><input placeholder="Счёт, например 2:1" value={cupForm.score} onChange={e=>setCupForm({...cupForm,score:e.target.value})}/><input placeholder="Соперник / команда" value={cupForm.opponent} onChange={e=>setCupForm({...cupForm,opponent:e.target.value})}/></div><textarea placeholder="Короткая заметка: кто стал MVP, важный момент и т.п." value={cupForm.note} onChange={e=>setCupForm({...cupForm,note:e.target.value})}/><button className="gold" disabled={cupSaving}>{cupSaving?"СОХРАНЕНИЕ…":"ДОБАВИТЬ РЕЗУЛЬТАТ"}</button></form><div className="admin-cup-list">{cupResults.map(item=><div className="admin-item" key={item.id}><div><b className={item.result === "win" ? "cup-admin-win" : "cup-admin-loss"}>{item.result === "win" ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</b><span>{item.cup_date} · {item.score || "без счёта"}{item.opponent ? ` · ${item.opponent}` : ""}</span></div><button className="danger" onClick={()=>removeCup(item.id)}>УДАЛИТЬ</button></div>)}</div></div><div className="admin-list"><h2>ХАЙЛАЙТЫ ({items.length})</h2>{items.map(item=><div className="admin-item" key={item.id}><div><b>{item.title}</b><span>{item.player} · {item.hero || "—"} · {item.is_published ? "Опубликован" : "Скрыт"}</span></div><button onClick={()=>toggle(item)}>{item.is_published?"СКРЫТЬ":"ОПУБЛИКОВАТЬ"}</button><button className="danger" onClick={()=>remove(item.id)}>УДАЛИТЬ</button></div>)}</div></PageShell>;
}
