import { useEffect, useMemo, useState } from "react";
import { createWorker } from "tesseract.js";
import { Link } from "react-router-dom";
import { createHighlight, deleteHighlight, getSession, listAllHighlights, listHighlights, signIn, signOut, supabaseConfigured, updateHighlight, uploadFile, listCupResults, createCupResult, deleteCupResult, isAdmin } from "./supabase";

const PLAYERS = ["АРТЕМ", "ИЛЬШАТ", "КОСТЯ", "КИРИЛЛ", "ИНСАФ"];
function normalizeCupDate(value) {
  const m = String(value || "").match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
}

function parseCupOcrText(text) {
  const rawLines = String(text || "").split(/\n+/).map(x => x.replace(/\s+/g," ").trim()).filter(Boolean);
  const lines = rawLines.filter(line => /побед|пораж|victory|defeat|win|loss/i.test(line));
  const source = lines.length ? lines : rawLines;
  const results = [];
  for (const line of source) {
    const win = /побед|\bwin\b|victory/i.test(line);
    const loss = /пораж|\bloss\b|defeat/i.test(line);
    if (!win && !loss) continue;
    const dateMatch = line.match(/(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/);
    const timeMatches = line.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g) || [];
    const timeMatch = timeMatches[0] || "";
    const durationMatch = timeMatches[1] || "";
    const stageMatch = line.match(/\b(1\s*\/\s*2|1\s*\/\s*4|финал|полуфинал|четвертьфинал|\bfinal\b|semi[- ]?final|quarter[- ]?final)\b/i);
    const heroMatch = line.match(/\b(Brewmaster|Beastmaster)\b/i);
    results.push({
      cup_date: normalizeCupDate(dateMatch?.[1]) || new Date().toISOString().slice(0,10),
      result: win ? "win" : "loss",
      score: "",
      opponent: "",
      note: [heroMatch?.[1] ? `Герой: ${heroMatch[1]}` : "", timeMatch?.[0] ? `Время: ${timeMatch}` : "", durationMatch?.[0] ? `Длительность: ${durationMatch}` : "", stageMatch?.[0] ? `Раунд: ${stageMatch[0]}` : ""].filter(Boolean).join(" · "),
      _source: line
    });
  }
  return results;
}

async function recognizeCupScreenshot(file, onProgress) {
  const worker = await createWorker(["eng", "rus"], 1, { logger: m => onProgress?.(Math.round((m.progress || 0) * 100)) });
  try {
    const { data } = await worker.recognize(file, {}, { tsv: true });
    return { text: data.text || "", tsv: data.tsv || "" };
  } finally {
    await worker.terminate();
  }
}

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
  const [cupResults, setCupResults] = useState([]); const [cupSaving, setCupSaving] = useState(false); const [cupScreenshot, setCupScreenshot] = useState(null); const [cupOcrRows, setCupOcrRows] = useState([]); const [cupOcrBusy, setCupOcrBusy] = useState(false); const [cupOcrProgress, setCupOcrProgress] = useState(0);
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
  async function scanCupScreenshot() {
    if (!cupScreenshot) return setMessage("Выбери скриншот результатов.");
    setCupOcrBusy(true); setCupOcrProgress(0); setMessage("");
    try {
      const ocr = await recognizeCupScreenshot(cupScreenshot, setCupOcrProgress);
      const rows = parseCupOcrText(ocr.text);
      if (!rows.length) throw new Error("Не удалось уверенно распознать результаты. Попробуй скриншот крупнее или обрежь только таблицу.");
      setCupOcrRows(rows);
      setMessage(`Распознано результатов: ${rows.length}. Проверь данные перед сохранением.`);
    } catch (e) { setMessage(e.message); } finally { setCupOcrBusy(false); }
  }

  async function saveOcrRows() {
    if (!session || !cupOcrRows.length) return;
    setCupSaving(true); setMessage("");
    try {
      for (const row of cupOcrRows) {
        const payload = { cup_date: row.cup_date, result: row.result, score: row.score || "", opponent: row.opponent || "", note: row.note || "Распознано со скриншота" };
        await createCupResult(session, payload);
      }
      setCupOcrRows([]); setCupScreenshot(null);
      const input = document.getElementById("cup-screenshot"); if (input) input.value = "";
      setMessage("Результаты со скриншота сохранены."); await refresh();
    } catch (e) { setMessage(e.message); } finally { setCupSaving(false); }
  }

  async function removeCup(id) { if (!confirm("Удалить результат кубка?")) return; try { await deleteCupResult(session,id); await refresh(); } catch(e) { setMessage(e.message); } }

  if (!supabaseConfigured) return <PageShell title="ADMIN" sub="ЗАКРЫТАЯ ПАНЕЛЬ 4T1J"><div className="admin-setup"><h2>Нужно подключить Supabase</h2><p>В проект добавлены готовые загрузка MP4, авторизация, база хайлайтов и Storage. Осталось указать два публичных параметра проекта в .env.</p><code>VITE_SUPABASE_URL=…<br/>VITE_SUPABASE_PUBLISHABLE_KEY=…</code><p>Секретный service-role key на сайт не добавляем.</p></div></PageShell>;
  if (!session) return <PageShell title="ADMIN" sub="ЗАКРЫТАЯ ПАНЕЛЬ 4T1J"><form className="admin-login" onSubmit={login}><label>EMAIL<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>ПАРОЛЬ<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button className="gold" type="submit">ВОЙТИ</button>{message ? <p className="form-message">{message}</p>:null}</form></PageShell>;
  if (!adminChecked) return <PageShell title="ADMIN" sub="ПРОВЕРКА ДОСТУПА"><div className="admin-setup"><h2>Проверяем доступ…</h2></div></PageShell>;
  if (!adminAllowed) return <PageShell title="403" sub="ДОСТУП ЗАПРЕЩЁН"><div className="admin-setup"><h2>Нет прав администратора</h2><p>Эта учётная запись не добавлена в список администраторов 4T1J.</p><button className="gold" onClick={()=>{signOut();setSession(null)}}>ВЫЙТИ</button></div></PageShell>;
  return <PageShell title="ADMIN" sub="ЗАКРЫТЫЙ MEDIA CONTROL"><div className="admin-head"><b>4T1J MEDIA CONTROL</b><button onClick={()=>{signOut();setSession(null)}}>ВЫЙТИ</button></div><form className="admin-form" onSubmit={add}><input placeholder="Название хайлайта" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required /><div className="admin-row"><select value={form.player} onChange={e=>setForm({...form,player:e.target.value})}>{PLAYERS.map(x=><option key={x}>{x}</option>)}</select><input placeholder="Герой, например Invoker" value={form.hero} onChange={e=>setForm({...form,hero:e.target.value})} /></div><textarea placeholder="Описание" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><label className="file-input">MP4 видео<input id="highlight-video" type="file" accept="video/mp4,video/webm" onChange={e=>setVideo(e.target.files?.[0]||null)} required/></label><label className="file-input">Превью JPG/PNG<input id="highlight-thumb" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setThumb(e.target.files?.[0]||null)}/></label><div className="checks"><label><input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form,is_featured:e.target.checked})}/> FEATURED</label><label><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})}/> ОПУБЛИКОВАТЬ</label></div><button className="gold" disabled={saving}>{saving ? "ЗАГРУЗКА…" : "ЗАГРУЗИТЬ ХАЙЛАЙТ"}</button>{message?<p className="form-message">{message}</p>:null}</form><div className="admin-list"><h2>БОЕВОЙ КУБОК</h2><p className="admin-help">Можно добавить результат вручную или загрузить скриншот таблицы. OCR распознает победы/поражения, дату, время, длительность, героя и раунд. Перед записью данные можно проверить.</p><div className="cup-ocr-box"><label className="file-input">СКРИНШОТ РЕЗУЛЬТАТОВ<input id="cup-screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setCupScreenshot(e.target.files?.[0]||null)}/></label><button className="gold" type="button" disabled={!cupScreenshot || cupOcrBusy} onClick={scanCupScreenshot}>{cupOcrBusy ? `РАСПОЗНАВАНИЕ ${cupOcrProgress}%…` : "РАСПОЗНАТЬ СКРИНШОТ"}</button>{cupOcrRows.length ? <div className="cup-ocr-preview"><div className="cup-ocr-preview-head"><b>ПРОВЕРКА ПЕРЕД СОХРАНЕНИЕМ</b><span>{cupOcrRows.length} результатов</span></div>{cupOcrRows.map((row,i)=><div className="cup-ocr-row" key={`${row.cup_date}-${i}`}><input type="date" value={row.cup_date} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,cup_date:e.target.value}:x))}/><select value={row.result} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,result:e.target.value}:x))}><option value="win">ПОБЕДА</option><option value="loss">ПОРАЖЕНИЕ</option></select><input placeholder="Счёт" value={row.score} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,score:e.target.value}:x))}/><input placeholder="Соперник" value={row.opponent} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,opponent:e.target.value}:x))}/><input className="cup-ocr-note" placeholder="Детали" value={row.note} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,note:e.target.value}:x))}/><button type="button" className="danger" onClick={()=>setCupOcrRows(rows=>rows.filter((_,j)=>j!==i))}>×</button></div>)}<button className="gold" type="button" disabled={cupSaving} onClick={saveOcrRows}>{cupSaving?"СОХРАНЕНИЕ…":"СОХРАНИТЬ РАСПОЗНАННЫЕ РЕЗУЛЬТАТЫ"}</button></div> : null}</div><form className="admin-form cup-admin-form" onSubmit={addCup}><div className="admin-row"><label>ДАТА КУБКА<input type="date" value={cupForm.cup_date} onChange={e=>setCupForm({...cupForm,cup_date:e.target.value})} required/></label><label>РЕЗУЛЬТАТ<select value={cupForm.result} onChange={e=>setCupForm({...cupForm,result:e.target.value})}><option value="win">ПОБЕДА</option><option value="loss">ПОРАЖЕНИЕ</option></select></label></div><div className="admin-row"><input placeholder="Счёт, например 2:1" value={cupForm.score} onChange={e=>setCupForm({...cupForm,score:e.target.value})}/><input placeholder="Соперник / команда" value={cupForm.opponent} onChange={e=>setCupForm({...cupForm,opponent:e.target.value})}/></div><textarea placeholder="Короткая заметка" value={cupForm.note} onChange={e=>setCupForm({...cupForm,note:e.target.value})}/><button className="gold" disabled={cupSaving}>{cupSaving?"СОХРАНЕНИЕ…":"ДОБАВИТЬ ВРУЧНУЮ"}</button></form><div className="admin-cup-list">{cupResults.map(item=><div className="admin-item" key={item.id}><div><b className={item.result === "win" ? "cup-admin-win" : "cup-admin-loss"}>{item.result === "win" ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</b><span>{item.cup_date} · {item.score || "без счёта"}{item.opponent ? ` · ${item.opponent}` : ""}</span></div><button className="danger" onClick={()=>removeCup(item.id)}>УДАЛИТЬ</button></div>)}</div></div><div className="admin-list"><h2>ХАЙЛАЙТЫ ({items.length})</h2>{items.map(item=><div className="admin-item" key={item.id}><div><b>{item.title}</b><span>{item.player} · {item.hero || "—"} · {item.is_published ? "Опубликован" : "Скрыт"}</span></div><button onClick={()=>toggle(item)}>{item.is_published?"СКРЫТЬ":"ОПУБЛИКОВАТЬ"}</button><button className="danger" onClick={()=>remove(item.id)}>УДАЛИТЬ</button></div>)}</div></PageShell>;
}
