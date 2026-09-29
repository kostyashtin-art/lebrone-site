import { useEffect, useMemo, useState } from "react";
import { createWorker } from "tesseract.js";
import { createMediaItem, deleteMediaItem, deleteStorageFile, getSession, listAllMedia, listHighlights, signIn, signOut, supabaseConfigured, updateMediaItem, uploadFile, listCupResults, createCupResult, deleteCupResult, isAdmin } from "./supabase";

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
      note: [heroMatch?.[1] ? `Герой: ${heroMatch[1]}` : "", timeMatch ? `Время: ${timeMatch}` : "", durationMatch ? `Длительность: ${durationMatch}` : "", stageMatch?.[0] ? `Раунд: ${stageMatch[0]}` : ""].filter(Boolean).join(" · "),
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

function PageShell({ title, sub, children }) {
  return <section className="page highlights-page"><small>4T1J ESPORTS / ADMIN</small><h1>{title}</h1><p>{sub}</p>{children}</section>;
}

export function Highlights() {
  const [items, setItems] = useState([]);
  const [player, setPlayer] = useState("ALL");
  const [hero, setHero] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { try { setItems(supabaseConfigured ? await listHighlights() : []); } catch { setItems([]); } finally { setLoading(false); } })(); }, []);
  const heroes = useMemo(() => ["ALL", ...Array.from(new Set(items.map(x => x.hero).filter(Boolean)))], [items]);
  const filtered = items.filter(x => (player === "ALL" || x.player === player) && (hero === "ALL" || x.hero === hero));

  return <PageShell title="ХАЙЛАЙТЫ" sub="ЛУЧШИЕ МОМЕНТЫ 4T1J — KILLS, CLUTCH И КРАСИВЫЕ ИГРЫ">
    <div className="highlight-filters"><select value={player} onChange={e => setPlayer(e.target.value)}><option value="ALL">ВСЕ ИГРОКИ</option>{PLAYERS.map(x => <option key={x}>{x}</option>)}</select><select value={hero} onChange={e => setHero(e.target.value)}>{heroes.map(x => <option key={x} value={x}>{x === "ALL" ? "ВСЕ ГЕРОИ" : x}</option>)}</select></div>
    {loading ? <div className="highlight-loading">ЗАГРУЗКА ХАЙЛАЙТОВ…</div> : <div className="highlights-grid">{filtered.map(item => <article className="highlight-card" key={item.id} onClick={() => setSelected(item)}><div className="highlight-thumb">{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" /> : <div className="highlight-placeholder"><b>4T1J</b><span>{item.hero || "DOTA 2"}</span></div>}<div className="highlight-overlay"><span>▶</span></div>{item.is_featured ? <em>FEATURED</em> : null}</div><div className="highlight-body"><small>{item.player} · {item.hero || "DOTA 2"}</small><h3>{item.title}</h3><p>{item.description || ""}</p><time>{new Date(item.created_at).toLocaleDateString("ru-RU")}</time></div></article>)}{!filtered.length ? <div className="empty">Пока нет опубликованных хайлайтов.</div> : null}</div>}
    {selected ? <div className="video-modal" onClick={() => setSelected(null)}><div className="video-dialog" onClick={e => e.stopPropagation()}><button type="button" onClick={() => setSelected(null)} aria-label="Закрыть">×</button><div className="video-player">{selected.video_url ? <video controls autoPlay playsInline poster={selected.thumbnail_url || undefined} src={selected.video_url} /> : <div className="video-demo">4T1J<br/><span>Здесь будет видео</span></div>}</div><h2>{selected.title}</h2><p>{selected.player} · {selected.hero}</p></div></div> : null}
  </PageShell>;
}

const emptyMediaForm = () => ({ media_type:"highlight", title:"", player:PLAYERS[0], hero:"", description:"", is_featured:false, is_published:true, sort_order:0 });

export function Admin() {
  const [session, setSession] = useState(getSession());
  const [adminChecked, setAdminChecked] = useState(false);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("media");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cupResults, setCupResults] = useState([]);
  const [cupSaving, setCupSaving] = useState(false);
  const [cupScreenshot, setCupScreenshot] = useState(null);
  const [cupOcrRows, setCupOcrRows] = useState([]);
  const [cupOcrBusy, setCupOcrBusy] = useState(false);
  const [cupOcrProgress, setCupOcrProgress] = useState(0);
  const [cupForm, setCupForm] = useState({ cup_date:new Date().toISOString().slice(0,10), result:"win", score:"", opponent:"", note:"" });
  const [form, setForm] = useState(emptyMediaForm());
  const [video, setVideo] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [editingId, setEditingId] = useState(null);

  async function refresh() {
    if (!session || !adminAllowed) return;
    try {
      const [media, cups] = await Promise.all([listAllMedia(session), listCupResults()]);
      setItems(media);
      setCupResults(cups);
    } catch(e) { setMessage(e.message); }
  }

  useEffect(() => {
    let cancelled = false;
    if (!session) { setAdminAllowed(false); setAdminChecked(true); return; }
    setAdminChecked(false);
    isAdmin(session).then(ok => { if (!cancelled) { setAdminAllowed(ok); setAdminChecked(true); } }).catch(() => { if (!cancelled) { setAdminAllowed(false); setAdminChecked(true); } });
    return () => { cancelled = true; };
  }, [session]);
  useEffect(() => { if (adminAllowed) refresh(); }, [adminAllowed]);

  async function login(e) { e.preventDefault(); setMessage(""); try { const s = await signIn(email, password); setSession(s); } catch(e) { setMessage(e.message); } }

  function resetMediaForm() {
    setForm(emptyMediaForm());
    setVideo(null);
    setThumb(null);
    setEditingId(null);
    const v = document.getElementById("media-video"); if (v) v.value = "";
    const t = document.getElementById("media-thumb"); if (t) t.value = "";
  }

  async function addMedia(e) {
    e.preventDefault();
    if (!session) return;
    if (!form.title.trim()) return setMessage("Укажи название материала.");
    const isPhoto = form.media_type === "photo";
    if (!editingId && isPhoto && !thumb) return setMessage("Выбери изображение.");
    if (!editingId && !isPhoto && !video) return setMessage("Выбери видео.");
    setSaving(true); setMessage("");
    try {
      let videoUrl = form.video_url || "";
      let thumbUrl = form.thumbnail_url || "";
      if (video) videoUrl = await uploadFile(session, video, "videos");
      if (thumb) thumbUrl = await uploadFile(session, thumb, isPhoto ? "photos" : "thumbnails");
      const payload = { media_type:form.media_type, title:form.title.trim(), player:form.player, hero:form.hero.trim(), description:form.description.trim(), video_url:isPhoto ? "" : videoUrl, thumbnail_url:thumbUrl, is_featured:Boolean(form.is_featured), is_published:Boolean(form.is_published), sort_order:Number(form.sort_order)||0 };
      if (editingId) {
        const previous = items.find(item => item.id === editingId);
        await updateMediaItem(session, editingId, payload);
        if (previous?.video_url && previous.video_url !== payload.video_url) {
          await deleteStorageFile(session, previous.video_url);
        }
        if (previous?.thumbnail_url && previous.thumbnail_url !== payload.thumbnail_url) {
          await deleteStorageFile(session, previous.thumbnail_url);
        }
      } else {
        await createMediaItem(session, payload);
      }
      setMessage(editingId ? "Материал обновлён." : "Материал добавлен.");
      resetMediaForm();
      await refresh();
    } catch(e) { setMessage(e.message); } finally { setSaving(false); }
  }

  function editMedia(item) {
    setTab("media");
    setEditingId(item.id);
    setForm({ media_type:item.media_type || "highlight", title:item.title || "", player:item.player || PLAYERS[0], hero:item.hero || "", description:item.description || "", is_featured:Boolean(item.is_featured), is_published:Boolean(item.is_published), sort_order:Number(item.sort_order)||0, video_url:item.video_url || "", thumbnail_url:item.thumbnail_url || "" });
    setVideo(null); setThumb(null);
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  async function removeMedia(item) {
    if (!confirm(`Удалить материал «${item.title}»? Файлы этого материала тоже будут удалены.`)) return;
    try { await deleteMediaItem(session, item); setMessage("Материал и связанные файлы удалены."); await refresh(); } catch(e) { setMessage(e.message); }
  }

  async function toggleMedia(item) {
    try { await updateMediaItem(session, item.id, { is_published:!item.is_published }); await refresh(); } catch(e) { setMessage(e.message); }
  }

  async function addCup(e) {
    e.preventDefault(); if (!session) return; setCupSaving(true); setMessage("");
    try { await createCupResult(session, cupForm); setCupForm({...cupForm, result:"win", score:"", opponent:"", note:""}); setMessage("Результат Боевого кубка сохранён."); await refresh(); } catch(e) { setMessage(e.message); } finally { setCupSaving(false); }
  }

  async function scanCupScreenshot() {
    if (!cupScreenshot) return setMessage("Выбери скриншот результатов.");
    setCupOcrBusy(true); setCupOcrProgress(0); setMessage("");
    try { const ocr = await recognizeCupScreenshot(cupScreenshot, setCupOcrProgress); const rows = parseCupOcrText(ocr.text); if (!rows.length) throw new Error("Не удалось уверенно распознать результаты. Попробуй скриншот крупнее или обрежь только таблицу."); setCupOcrRows(rows); setMessage(`Распознано результатов: ${rows.length}. Проверь данные перед сохранением.`); }
    catch(e) { setMessage(e.message); } finally { setCupOcrBusy(false); }
  }

  async function saveOcrRows() {
    if (!session || !cupOcrRows.length) return; setCupSaving(true); setMessage("");
    try { for (const row of cupOcrRows) await createCupResult(session, { cup_date:row.cup_date, result:row.result, score:row.score || "", opponent:row.opponent || "", note:row.note || "Распознано со скриншота" }); setCupOcrRows([]); setCupScreenshot(null); const input=document.getElementById("cup-screenshot"); if (input) input.value=""; setMessage("Результаты со скриншота сохранены."); await refresh(); }
    catch(e) { setMessage(e.message); } finally { setCupSaving(false); }
  }

  async function removeCup(id) { if (!confirm("Удалить результат Боевого кубка?")) return; try { await deleteCupResult(session,id); await refresh(); } catch(e) { setMessage(e.message); } }

  if (!supabaseConfigured) return <PageShell title="ADMIN" sub="ЗАКРЫТАЯ ПАНЕЛЬ 4T1J"><div className="admin-setup"><h2>Нужно подключить Supabase</h2><p>В проекте используются Supabase Auth, база контента и Storage.</p><code>VITE_SUPABASE_URL=…<br/>VITE_SUPABASE_PUBLISHABLE_KEY=…</code></div></PageShell>;
  if (!session) return <PageShell title="ADMIN" sub="ЗАКРЫТАЯ ПАНЕЛЬ 4T1J"><form className="admin-login" onSubmit={login}><label>EMAIL<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>ПАРОЛЬ<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button className="gold" type="submit">ВОЙТИ</button>{message ? <p className="form-message">{message}</p> : null}</form></PageShell>;
  if (!adminChecked) return <PageShell title="ADMIN" sub="ПРОВЕРКА ДОСТУПА"><div className="admin-setup"><h2>Проверяем доступ…</h2></div></PageShell>;
  if (!adminAllowed) return <PageShell title="403" sub="ДОСТУП ЗАПРЕЩЁН"><div className="admin-setup"><h2>Нет прав администратора</h2><p>Эта учётная запись не добавлена в список администраторов 4T1J.</p><button className="gold" onClick={()=>{signOut();setSession(null)}}>ВЫЙТИ</button></div></PageShell>;

  const mediaCount = items.length;
  const photosCount = items.filter(x=>x.media_type === "photo").length;
  const videosCount = items.filter(x=>x.media_type === "video").length;
  const highlightsCount = items.filter(x=>x.media_type === "highlight").length;

  return <PageShell title="ADMIN" sub="ЕДИНАЯ ПАНЕЛЬ МЕДИА И БОЕВОГО КУБКА">
    <div className="admin-dashboard-head">
      <div><b>4T1J CONTROL</b><span>Контент и результаты в одном месте</span></div>
      <button type="button" onClick={()=>{signOut();setSession(null)}}>ВЫЙТИ</button>
    </div>

    <div className="admin-dashboard-tabs">
      <button type="button" className={tab === "media" ? "active" : ""} onClick={()=>setTab("media")}>МЕДИА <span>{mediaCount}</span></button>
      <button type="button" className={tab === "cup" ? "active" : ""} onClick={()=>setTab("cup")}>БОЕВОЙ КУБОК <span>{cupResults.length}</span></button>
    </div>

    {message ? <div className="admin-status">{message}</div> : null}

    {tab === "media" ? <>
      <div className="admin-media-stats"><div><b>{mediaCount}</b><span>ВСЕГО</span></div><div><b>{photosCount}</b><span>ФОТО</span></div><div><b>{videosCount}</b><span>ВИДЕО</span></div><div><b>{highlightsCount}</b><span>ХАЙЛАЙТЫ</span></div></div>

      <form className="admin-form admin-media-form" onSubmit={addMedia}>
        <div className="admin-form-heading"><div><small>{editingId ? "РЕДАКТИРОВАНИЕ" : "НОВЫЙ МАТЕРИАЛ"}</small><h2>{editingId ? "ИЗМЕНИТЬ МЕДИА" : "ДОБАВИТЬ МЕДИА"}</h2></div>{editingId ? <button type="button" className="admin-secondary" onClick={resetMediaForm}>ОТМЕНА</button> : null}</div>
        <div className="admin-type-switch">
          {[['photo','ФОТО'],['video','ВИДЕО'],['highlight','ХАЙЛАЙТ']].map(([value,label])=><button type="button" key={value} className={form.media_type === value ? "active" : ""} onClick={()=>setForm({...form,media_type:value})}>{label}</button>)}
        </div>
        <input placeholder="Название материала" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
        <div className="admin-row"><select value={form.player} onChange={e=>setForm({...form,player:e.target.value})}><option value="">4T1J / КОМАНДА</option>{PLAYERS.map(x=><option key={x}>{x}</option>)}</select><input placeholder="Герой (для видео / хайлайта)" value={form.hero} onChange={e=>setForm({...form,hero:e.target.value})} /></div>
        <textarea placeholder="Описание" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
        <div className="admin-upload-grid">
          {form.media_type !== "photo" ? <label className="file-input"><span>ВИДЕО MP4 / WEBM</span><input id="media-video" type="file" accept="video/mp4,video/webm" onChange={e=>setVideo(e.target.files?.[0]||null)} required={!editingId}/>{video ? <small>{video.name}</small> : null}{editingId && form.video_url ? <small>Текущее видео сохранится, если новое не выбрать.</small> : null}</label> : null}
          <label className="file-input"><span>{form.media_type === "photo" ? "ФОТО JPG / PNG / WEBP" : "ПРЕВЬЮ JPG / PNG / WEBP"}</span><input id="media-thumb" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setThumb(e.target.files?.[0]||null)} required={!editingId && form.media_type === "photo"}/>{thumb ? <small>{thumb.name}</small> : null}{editingId && form.thumbnail_url ? <small>Текущее изображение сохранится, если новое не выбрать.</small> : null}</label>
        </div>
        <div className="checks"><label><input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form,is_featured:e.target.checked})}/> FEATURED</label><label><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})}/> ОПУБЛИКОВАТЬ</label></div>
        <div className="admin-row"><input type="number" min="0" step="1" placeholder="Порядок" value={form.sort_order} onChange={e=>setForm({...form,sort_order:e.target.value})}/><div className="admin-form-actions"><button className="gold" disabled={saving}>{saving ? "СОХРАНЕНИЕ…" : editingId ? "СОХРАНИТЬ ИЗМЕНЕНИЯ" : `ДОБАВИТЬ ${form.media_type === "photo" ? "ФОТО" : form.media_type === "video" ? "ВИДЕО" : "ХАЙЛАЙТ"}`}</button></div></div>
      </form>

      <div className="admin-list admin-media-list"><div className="admin-list-heading"><h2>КОНТЕНТ ({mediaCount})</h2><span>Публичная страница «Медиа» собирается отсюда.</span></div>
        {items.map(item => <div className="admin-item admin-media-item" key={item.id}>
          <div className="admin-media-item-preview">{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" /> : <span>4T1J</span>}</div>
          <div className="admin-media-item-main"><div className="admin-media-badges"><b>{item.media_type === "photo" ? "ФОТО" : item.media_type === "video" ? "ВИДЕО" : "ХАЙЛАЙТ"}</b>{item.is_featured ? <em>FEATURED</em> : null}<small>{item.is_published ? "ОПУБЛИКОВАН" : "СКРЫТ"}</small></div><h3>{item.title}</h3><p>{item.player || "4T1J / КОМАНДА"}{item.hero ? ` · ${item.hero}` : ""}</p></div>
          <div className="admin-media-item-actions"><button onClick={()=>editMedia(item)}>ИЗМЕНИТЬ</button><button onClick={()=>toggleMedia(item)}>{item.is_published ? "СКРЫТЬ" : "ОПУБЛИКОВАТЬ"}</button><button className="danger" onClick={()=>removeMedia(item)}>УДАЛИТЬ</button></div>
        </div>)}
        {!items.length ? <div className="empty">Медиа пока нет. Добавь первый материал выше.</div> : null}
      </div>
    </> : <>
      <div className="admin-list"><div className="admin-list-heading"><h2>БОЕВОЙ КУБОК</h2><span>Ручной ввод + распознавание скриншотов OCR</span></div>
        <div className="cup-ocr-box">
          <label className="file-input"><span>СКРИНШОТ РЕЗУЛЬТАТОВ</span><input id="cup-screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setCupScreenshot(e.target.files?.[0]||null)}/>{cupScreenshot ? <small>{cupScreenshot.name}</small> : null}</label>
          <button className="gold" type="button" disabled={!cupScreenshot || cupOcrBusy} onClick={scanCupScreenshot}>{cupOcrBusy ? `РАСПОЗНАВАНИЕ ${cupOcrProgress}%…` : "РАСПОЗНАТЬ СКРИНШОТ"}</button>
          {cupOcrRows.length ? <div className="cup-ocr-preview"><div className="cup-ocr-preview-head"><b>ПРОВЕРКА ПЕРЕД СОХРАНЕНИЕМ</b><span>{cupOcrRows.length} результатов</span></div>{cupOcrRows.map((row,i)=><div className="cup-ocr-row" key={`${row.cup_date}-${i}`}><input type="date" value={row.cup_date} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,cup_date:e.target.value}:x))}/><select value={row.result} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,result:e.target.value}:x))}><option value="win">ПОБЕДА</option><option value="loss">ПОРАЖЕНИЕ</option></select><input placeholder="Счёт" value={row.score} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,score:e.target.value}:x))}/><input placeholder="Соперник" value={row.opponent} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,opponent:e.target.value}:x))}/><input className="cup-ocr-note" placeholder="Детали" value={row.note} onChange={e=>setCupOcrRows(rows=>rows.map((x,j)=>j===i?{...x,note:e.target.value}:x))}/><button type="button" className="danger" onClick={()=>setCupOcrRows(rows=>rows.filter((_,j)=>j!==i))}>×</button></div>)}<button className="gold" type="button" disabled={cupSaving} onClick={saveOcrRows}>{cupSaving?"СОХРАНЕНИЕ…":"СОХРАНИТЬ РАСПОЗНАННЫЕ РЕЗУЛЬТАТЫ"}</button></div> : null}
        </div>
        <form className="admin-form cup-admin-form" onSubmit={addCup}><div className="admin-row"><label>ДАТА КУБКА<input type="date" value={cupForm.cup_date} onChange={e=>setCupForm({...cupForm,cup_date:e.target.value})} required/></label><label>РЕЗУЛЬТАТ<select value={cupForm.result} onChange={e=>setCupForm({...cupForm,result:e.target.value})}><option value="win">ПОБЕДА</option><option value="loss">ПОРАЖЕНИЕ</option></select></label></div><div className="admin-row"><input placeholder="Счёт, например 2:1" value={cupForm.score} onChange={e=>setCupForm({...cupForm,score:e.target.value})}/><input placeholder="Соперник / команда" value={cupForm.opponent} onChange={e=>setCupForm({...cupForm,opponent:e.target.value})}/></div><textarea placeholder="Короткая заметка" value={cupForm.note} onChange={e=>setCupForm({...cupForm,note:e.target.value})}/><button className="gold" disabled={cupSaving}>{cupSaving?"СОХРАНЕНИЕ…":"ДОБАВИТЬ РЕЗУЛЬТАТ"}</button></form>
        <div className="admin-cup-list">{cupResults.map(item=><div className="admin-item" key={item.id}><div><b className={item.result === "win" ? "cup-admin-win" : "cup-admin-loss"}>{item.result === "win" ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</b><span>{item.cup_date} · {item.score || "без счёта"}{item.opponent ? ` · ${item.opponent}` : ""}</span></div><button className="danger" onClick={()=>removeCup(item.id)}>УДАЛИТЬ</button></div>)}{!cupResults.length ? <div className="empty">Результатов Боевого кубка пока нет.</div> : null}</div>
      </div>
    </>}
  </PageShell>;
}
