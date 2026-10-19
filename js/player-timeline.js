(function(){
 const $=id=>document.getElementById(id);
 const esc2=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
 const n=v=>Number(v||0).toLocaleString('ru-RU');
 const tm=s=>`${Math.floor(Math.max(0,s||0)/60)}:${String(Math.floor(Math.max(0,s||0)%60)).padStart(2,'0')}`;
 let timelineState={match:null,players:[],duration:0,second:0,events:[],advantageSeries:[],experienceSeries:[]};
 function playerName(p){return p.personaname||`Игрок ${Number(p.idx||0)+1}`;}
 function heroName2(p){try{return heroName(p)}catch(e){return `Hero #${p.hero_id||'?'}`}}
 function heroImg2(p){try{return heroImg(p)}catch(e){return ''}}
 function translateEventKey(raw){
  const k=String(raw||'').toLowerCase();
  const side=k.includes('goodguys')?'Radiant':k.includes('badguys')?'Dire':'';
  const lane=k.includes('_top')?'верхняя линия':k.includes('_mid')?'центральная линия':k.includes('_bot')?'нижняя линия':'';
  if(k.includes('tower')){const level=(k.match(/tower(\d)/)||[])[1]||'';return `${side?side+' · ':''}Башня ${level?level+'-го уровня':''}${lane?' · '+lane:''}`.trim()}
  if(k.includes('range_rax'))return `${side?side+' · ':''}Дальний барак${lane?' · '+lane:''}`;
  if(k.includes('melee_rax'))return `${side?side+' · ':''}Ближний барак${lane?' · '+lane:''}`;
  if(k.includes('rax'))return `${side?side+' · ':''}Бараки${lane?' · '+lane:''}`;
  if(k.includes('roshan'))return 'Рошан';
  if(k.includes('aegis'))return 'Эгида бессмертия';
  if(k.includes('courier'))return 'Курьер потерян';
  if(k.includes('firstblood'))return 'Первая кровь';
  return String(raw||'Игровое событие').replace(/^npc_dota_/i,'').replace(/_/g,' ');
 }
 function eventList(m,players){
  const out=[]; const bySlot=Object.fromEntries(players.map(p=>[p.player_slot,p]));
  (m.kills_log||[]).forEach((e,i)=>{const p=bySlot[e.victim_slot];out.push({id:`kill-${i}`,t:Number(e.time||0),type:'death',title:p?`${playerName(p)} погиб`:'Гибель героя',detail:e.key?`Убийца: ${translateEventKey(e.key)}`:'Смерть из журнала матча',player:p||null,team:p?.team||null});});
  (m.objectives||[]).forEach((e,i)=>{const raw=[e.type,e.subtype,e.key].filter(Boolean).join(' '); const title=translateEventKey(raw); out.push({id:`obj-${i}`,t:Number(e.time||0),type:/roshan|aegis/i.test(raw)?'roshan':'objective',title,detail:[e.subtype?translateEventKey(e.subtype):'',e.key?translateEventKey(e.key):''].filter(Boolean).join(' · ')||'Объект из данных матча',player:bySlot[e.player_slot]||null,team:e.player_slot==null?null:(e.player_slot<128?'Radiant':'Dire')});});
  (m.purchases_log||[]).forEach((e,i)=>{const p=bySlot[e.player_slot];if(!p)return;out.push({id:`purchase-${i}`,t:Number(e.time||0),type:'item',title:`Покупка: ${e.key||'предмет'}`,detail:playerName(p),player:p,team:p.team});});
  return out.filter(e=>Number.isFinite(e.t)&&e.t>=0).sort((a,b)=>a.t-b.t);
 }
 function renderInteractiveTimeline(m,players,culprit){
  const root=$('interactiveTimeline'); if(!root)return;
  const duration=Math.max(1,Number(m.duration||0)); const events=eventList(m,players);
  timelineState={match:m,players,duration,second:0,events,advantageSeries:[],experienceSeries:[]};
  const maxLen=Math.max(0,...players.map(p=>Array.isArray(p.gold_t)?p.gold_t.length:0));
  let chart='';
  if(maxLen>1){
   const rad=players.filter(p=>p.team==='Radiant'),dire=players.filter(p=>p.team==='Dire');
   const values=Array.from({length:maxLen},(_,i)=>({t:duration*i/(maxLen-1),r:rad.reduce((s,p)=>s+Number(p.gold_t?.[i]||0),0),d:dire.reduce((s,p)=>s+Number(p.gold_t?.[i]||0),0),xr:rad.reduce((s,p)=>s+Number(p.xp_t?.[i]||0),0),xd:dire.reduce((s,p)=>s+Number(p.xp_t?.[i]||0),0)})); timelineState.advantageSeries=values.map(v=>({t:v.t,advantage:v.r-v.d})); timelineState.experienceSeries=values.map(v=>({t:v.t,advantage:v.xr-v.xd}));
   const max=Math.max(1,...values.map(v=>Math.abs(v.r-v.d)));const W=900,H=180,pad=22;
   const pts=values.map((v,i)=>`${pad+i*(W-2*pad)/(values.length-1)},${H/2-(v.r-v.d)/max*(H/2-pad)}`).join(' ');
   const playerColors=['#ff777d','#b78bf2','#7cdaa5','#67b7ff','#f3cc75','#ff9e6e','#e58bd5','#9edbff','#d5e36f','#f2a4b8'];
   const deathEvents=events.filter(e=>e.type==='death'&&e.player);
   const markers=events.filter(e=>e.type==='roshan'||e.type==='objective').map(e=>{const x=pad+Math.min(duration,e.t)/duration*(W-2*pad);return `<path class="timelineEventDot ${e.type}" data-event-id="${e.id}" d="M ${x} ${H/2-5} l 5 5 l -5 5 l -5 -5 z" tabindex="0" role="button" aria-label="${esc2(e.title)} ${tm(e.t)}"><title>${esc2(tm(e.t)+' · '+e.title)}</title></path>`}).join('');
   const deathMarkers=deathEvents.map(e=>{const x=pad+Math.min(duration,e.t)/duration*(W-2*pad);const idx=Math.max(0,players.findIndex(p=>p.player_slot===e.player.player_slot));const y=H-26-(idx%10)*11;const color=playerColors[idx%playerColors.length];return `<g class="playerDeathMarker" data-event-id="${e.id}" tabindex="0" role="button" aria-label="${esc2(e.title)} ${tm(e.t)}"><line x1="${x}" y1="${y-4}" x2="${x}" y2="${H/2+4}" stroke="${color}" stroke-opacity=".24" stroke-dasharray="2 3"/><circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="#140d1d" stroke-width="1.5"/><title>${esc2(tm(e.t)+' · '+playerName(e.player)+' погиб')}</title></g>`}).join('');
   chart=`<svg class="interactiveGoldSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Преимущество по золоту и смерти игроков"><line x1="${pad}" y1="${H/2}" x2="${W-pad}" y2="${H/2}" stroke="#59476e" stroke-dasharray="4 5"/><polyline points="${pts}" fill="none" stroke="#d7ae53" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${markers}${deathMarkers}<line id="timelineCursor" x1="${pad}" y1="8" x2="${pad}" y2="${H-12}" stroke="#c69cff" stroke-width="2"/><text x="${pad}" y="${H-2}" fill="#a99abb" font-size="11">0:00</text><text x="${W-pad}" y="${H-2}" fill="#a99abb" font-size="11" text-anchor="end">${tm(duration)}</text></svg>`;
  }else chart='<div class="empty">Временной ряд золота недоступен для этого матча. Лента событий ниже использует доступные журналы OpenDota.</div>';
  const swingsHtml=renderLargestSwings(timelineState.advantageSeries,'золоту')+renderLargestSwings(timelineState.experienceSeries,'опыту');
  const filters=`<div class="timelineFilters"><button type="button" class="active" data-filter="all">Все события</button><button type="button" data-filter="death">Смерти</button><button type="button" data-filter="objective">Объекты</button><button type="button" data-filter="item">Покупки</button><select id="timelinePlayerFilter" aria-label="Фильтр по игроку"><option value="all">Все игроки</option>${players.map(p=>`<option value="${p.player_slot}">${esc2(playerName(p))} · ${esc2(heroName2(p))}</option>`).join('')}</select></div>`;
  root.innerHTML=`<div class="timelineControls"><label for="timelineRange">Минута матча <strong id="timelineCurrentTime">00:00</strong></label><input id="timelineRange" type="range" min="0" max="${duration}" step="1" value="0"><div class="timelineQuick"><button type="button" data-jump="0">Начало</button><button type="button" data-jump="${Math.round(duration*.25)}">25%</button><button type="button" data-jump="${Math.round(duration*.5)}">50%</button><button type="button" data-jump="${Math.round(duration*.75)}">75%</button><button type="button" data-jump="${duration}">Конец</button></div></div><div class="timelineChartWrap"><div class="timelineChartLegend"><span><i></i> Преимущество Radiant − Dire</span><small>Цветные точки внизу — смерти игроков; наведите курсор для имени и времени</small></div>${chart}</div>${swingsHtml}${filters}<div id="timelineSelectedEvent" class="timelineSelectedEvent">Выбери событие или перемести ползунок, чтобы посмотреть события рядом с выбранным временем.</div><div id="timelineEventsList" class="timelineEventsList"></div>`;
  const range=$('timelineRange'); range.addEventListener('input',()=>selectTime(Number(range.value)));
  root.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{range.value=b.dataset.jump;selectTime(Number(range.value));}));
  root.querySelectorAll('[data-swing-time]').forEach(b=>b.addEventListener('click',()=>{range.value=b.dataset.swingTime;selectTime(Number(range.value));$('interactiveTimeline')?.scrollIntoView({behavior:'smooth',block:'start'});}));
  root.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderEventList(b.dataset.filter,$('timelinePlayerFilter')?.value||'all');}));
  $('timelinePlayerFilter').addEventListener('change',()=>renderEventList(root.querySelector('[data-filter].active')?.dataset.filter||'all',$('timelinePlayerFilter').value));
  root.querySelectorAll('[data-event-id]').forEach(el=>{const go=()=>{const e=events.find(x=>x.id===el.dataset.eventId);if(!e)return;range.value=e.t;selectTime(e.t,e.id)};el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})});
  selectTime(0);
 }

 function renderLargestSwings(series,metricLabel){
  series=series||[];
  if(series.length<3)return `<section class="largestSwings"><div class="largestSwingsHead"><h3>Крупнейшие изменения преимущества по ${metricLabel}</h3><p>Для этого матча недостаточно точек данных, чтобы найти переломные отрезки.</p></div></section>`;
  const windowSeconds=180;
  const at=sec=>series.reduce((best,v)=>Math.abs(v.t-sec)<Math.abs(best.t-sec)?v:best,series[0]);
  const candidates=[];
  for(const start of series){
   const endTime=Math.min(timelineState.duration,start.t+windowSeconds);
   if(endTime-start.t<60)continue;
   const end=at(endTime),delta=end.advantage-start.advantage;
   candidates.push({start:start.t,end:end.t,delta,from:start.advantage,to:end.advantage,magnitude:Math.abs(delta)});
  }
  candidates.sort((a,b)=>b.magnitude-a.magnitude);
  const chosen=[];
  for(const c of candidates){
   if(chosen.every(x=>c.end<=x.start||c.start>=x.end))chosen.push(c);
   if(chosen.length>=5)break;
  }
  if(!chosen.length)return '<section class="largestSwings"><div class="largestSwingsHead"><h3>Крупнейшие изменения преимущества</h3><p>Нет подходящих временных отрезков для сравнения.</p></div></section>';
  const fmt=v=>`${v>0?'+':''}${Math.round(v).toLocaleString('ru-RU')} ${metricLabel}`;
  const cards=chosen.map((c,i)=>{const side=Math.abs(c.delta)<1000?'Изменение небольшое':c.delta>0?'Поворот в пользу Radiant':'Поворот в пользу Dire';const cls=c.delta>0?'swingRadiant':c.delta<0?'swingDire':'swingNeutral';return `<button type="button" class="largestSwingCard ${cls}" data-swing-time="${Math.round((c.start+c.end)/2)}"><span class="swingRank">${i+1}</span><span class="swingMain"><b>${tm(c.start)}–${tm(c.end)}</b><small>${side}</small></span><strong>${fmt(c.delta)}</strong><span class="swingOpen">↗</span></button>`}).join('');
  return `<section class="largestSwings"><div class="largestSwingsHead"><div><h3>Крупнейшие изменения преимущества по ${metricLabel}</h3><p>Самые большие изменения разницы между командами на отрезках до 3 минут. Нажми, чтобы перейти к моменту на таймлайне.</p></div><span class="swingBadge">ТОП ${chosen.length}</span></div><div class="largestSwingsGrid">${cards}</div><p class="largestSwingsNote">Это статистические изменения по ${metricLabel}, а не доказательство, что одно событие вызвало перелом.</p></section>`;
 }
 function selectTime(second,eventId){timelineState.second=second;const label=$('timelineCurrentTime');if(label)label.textContent=tm(second);const cursor=$('timelineCursor');if(cursor){const x=22+second/Math.max(1,timelineState.duration)*(900-44);cursor.setAttribute('x1',x);cursor.setAttribute('x2',x)}
  const near=timelineState.events.filter(e=>Math.abs(e.t-second)<=90).sort((a,b)=>Math.abs(a.t-second)-Math.abs(b.t-second));const selected=eventId?timelineState.events.find(e=>e.id===eventId):near[0];const box=$('timelineSelectedEvent');if(box&&selected){const impact=eventImpact(selected);box.innerHTML=`<div class="timelineSelectedTime">${tm(selected.t)}</div><div class="timelineSelectedBody"><strong>${esc2(selected.title)}</strong><p>${esc2(selected.detail)}</p>${impact.html}${selected.player?`<button type="button" class="timelinePlayerLink" data-open-slot="${selected.player.player_slot}">Открыть игрока: ${esc2(playerName(selected.player))}</button>`:''}</div>`}else if(box)box.innerHTML=`<div class="timelineSelectedTime">${tm(second)}</div><div><strong>Нет события рядом с выбранным временем</strong><p>Это не означает, что в игре ничего не происходило: OpenDota может не предоставлять все игровые события.</p></div>`;
  box?.querySelector('[data-open-slot]')?.addEventListener('click',()=>openPlayer(Number(box.querySelector('[data-open-slot]').dataset.openSlot)));
  renderEventList(document.querySelector('#interactiveTimeline [data-filter].active')?.dataset.filter||'all',$('timelinePlayerFilter')?.value||'all');
 }

 function eventImpact(event){
  const series=timelineState.advantageSeries||[];
  if(series.length<2)return {html:'<div class="eventImpact muted">Нет временного ряда золота, чтобы оценить изменение преимущества.</div>'};
  const at=(sec)=>series.reduce((best,v)=>Math.abs(v.t-sec)<Math.abs(best.t-sec)?v:best,series[0]);
  const before=at(Math.max(0,event.t-60)),after=at(Math.min(timelineState.duration,event.t+60));
  const delta=after.advantage-before.advantage;
  const fmtGold=v=>`${v>0?'+':''}${Math.round(v).toLocaleString('ru-RU')} золота`;
  const side=v=>Math.abs(v)<1000?'почти без изменений':v>0?'в пользу Radiant':'в пользу Dire';
  const nearby=timelineState.events.filter(e=>e.id!==event.id&&Math.abs(e.t-event.t)<=75&&['objective','roshan'].includes(e.type)).slice(0,2);
  const nearbyHtml=nearby.length?`<div class="eventImpactRelated"><b>Связанные события рядом:</b> ${nearby.map(e=>`${tm(e.t)} — ${esc2(e.title)}`).join(' · ')}</div>`:'';
  return {html:`<div class="eventImpact"><span class="eventImpactLabel">Изменение преимущества за минуту до и после</span><b class="${delta>0?'impactRadiant':delta<0?'impactDire':'impactNeutral'}">${fmtGold(delta)}</b><small>${side(delta)}. Это временная связь, а не доказательство, что событие стало причиной изменения.</small>${nearbyHtml}</div>`};
 }
 function renderEventList(filter,slot){const root=$('timelineEventsList');if(!root)return;let arr=timelineState.events.filter(e=>(filter==='all'||e.type===filter)&&(slot==='all'||String(e.player?.player_slot)===String(slot)));if(!arr.length){root.innerHTML='<div class="empty">Нет событий этого типа в доступных данных матча.</div>';return;}root.innerHTML=arr.slice(0,180).map(e=>`<button type="button" class="timelineEventRow ${e.type}" data-event-id="${e.id}"><time>${tm(e.t)}</time><span class="timelineEventGlyph">${e.type==='death'?'✕':e.type==='roshan'?'♜':e.type==='item'?'◇':'◆'}</span><span class="timelineEventText"><b>${esc2(e.title)}</b><small>${esc2(e.detail)}</small></span><span class="timelineEventOpen">↗</span></button>`).join('');root.querySelectorAll('[data-event-id]').forEach(b=>b.addEventListener('click',()=>{const e=timelineState.events.find(x=>x.id===b.dataset.eventId);if(e){$('timelineRange').value=e.t;selectTime(e.t,e.id)}}));}
 function bindPlayerDetailCards(players){document.querySelectorAll('.playerCardClickable').forEach(card=>{const slot=Number(card.dataset.playerSlot);const open=()=>openPlayer(slot);card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})});document.querySelectorAll('.winnerPlayer').forEach(card=>{card.style.cursor='pointer';card.title='Нажмите, чтобы открыть статистику игрока';card.addEventListener('click',()=>{const text=card.querySelector('.winnerPlayerMain b')?.textContent;const p=players.find(x=>playerName(x)===text);if(p)openPlayer(p.player_slot)});});}
 function openPlayer(slot){const p=timelineState.players.find(x=>Number(x.player_slot)===Number(slot));if(!p)return;const modal=$('playerDetailModal'),content=$('playerDetailContent');if(!modal||!content)return;const dur=Math.max(1,timelineState.duration);const kd=`${p.kills||0}/${p.deaths||0}/${p.assists||0}`;const kda=((p.kills||0)+(p.assists||0))/Math.max(1,p.deaths||0);const logs=timelineState.events.filter(e=>e.player?.player_slot===p.player_slot);const items=[0,1,2,3,4,5].map(i=>p[`item_${i}`]).filter(Boolean);let itemsHtml='';try{itemsHtml=items.map(id=>{const d=itemData(id);const src=d.img?`https://cdn.cloudflare.steamstatic.com${d.img}`:'';return `<span class="detailItem" title="${esc2(d.dname||d.localized_name||'Предмет')}">${src?`<img src="${src}" alt="">`:''}<small>${esc2(d.dname||d.localized_name||'Предмет')}</small></span>`}).join('')}catch(e){}
  const metrics=[['K / D / A',kd],['KDA ratio',kda.toFixed(2)],['GPM',n(p.gold_per_min)],['XPM',n(p.xp_per_min)],['Добивания',n(p.last_hits)],['Денай',n(p.denies)],['Урон героям',n(p.hero_damage)],['Урон строениям',n(p.tower_damage)],['Лечение',n(p.hero_healing)],['Net worth',n(p.net_worth)],['Участие в убийствах',`${p.kp!=null?Number(p.kp).toFixed(0)+'%':'—'}`],['Доля урона',`${p.dmgShare!=null?Number(p.dmgShare).toFixed(1)+'%':'—'}`],['Время матча',tm(dur)],['События в ленте',logs.length]];
  const role=p.role||p.roleInfo?.role||'Роль не определена';
  const spark=(arr,label,color)=>{const vals=Array.isArray(arr)?arr.map(Number).filter(Number.isFinite):[];if(vals.length<2)return `<p class="muted">Нет временного ряда ${label} для этого игрока.</p>`;const max=Math.max(...vals,1),min=Math.min(...vals),span=Math.max(1,max-min),w=520,h=78,pad=5;const pts=vals.map((v,i)=>`${pad+i/(vals.length-1)*(w-2*pad)},${h-pad-(v-min)/span*(h-2*pad)}`).join(' ');return `<div class="playerSpark"><div><b>${label}</b><small>${n(vals[0])} → ${n(vals[vals.length-1])}</small></div><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label} игрока по времени"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="sparkAxis"><span>Начало</span><span>Конец матча</span></div></div>`};
  const playerCharts=spark(p.gold_t,'Золото игрока','#f3cc75')+spark(p.xp_t,'Опыт игрока','#b78bf2');
  const deaths=logs.filter(e=>e.type==='death').length,objectives=logs.filter(e=>['objective','roshan'].includes(e.type)).length,purchases=logs.filter(e=>e.type==='item').length;
  const eventSummary=`<div class="playerEventSummary"><div><b>${deaths}</b><span>смертей в ленте</span></div><div><b>${objectives}</b><span>событий объектов</span></div><div><b>${purchases}</b><span>покупок в ленте</span></div></div>`;
  content.innerHTML=`<div class="detailPlayerHero"><img src="${heroImg2(p)}" alt="" onerror="this.style.visibility='hidden'"><div><div class="detailEyebrow">${esc2(p.team||'')} · ${esc2(role)}</div><h3>${esc2(playerName(p))}</h3><p>${esc2(heroName2(p))}</p></div><div class="detailScore">${p.score!=null?esc2(p.score):'—'}<small>оценка</small></div></div><div class="detailMetrics">${metrics.map(([a,b])=>`<div><span>${esc2(a)}</span><b>${esc2(b)}</b></div>`).join('')}</div><div class="detailSection"><h4>Динамика игрока за матч</h4><div class="playerCharts">${playerCharts}</div></div><div class="detailSection"><h4>События игрока</h4>${eventSummary}</div><div class="detailSection"><h4>Предметы в инвентаре</h4><div class="detailItems">${itemsHtml||'<span class="muted">Нет данных о предметах.</span>'}</div></div><div class="detailSection"><h4>События, связанные с игроком</h4><div class="detailRecentEvents">${logs.length?logs.slice(0,12).map(e=>`<button type="button" data-detail-event="${e.id}"><time>${tm(e.t)}</time><span>${esc2(e.title)}</span></button>`).join(''):'<p class="muted">В доступной ленте нет событий, которые можно уверенно связать с этим игроком.</p>'}</div></div><p class="detailDisclaimer">Показатели рассчитаны по данным матча, предоставленным OpenDota. Они не доказывают намеренный троллинг и могут быть неполными.</p>`;
  content.querySelectorAll('[data-detail-event]').forEach(b=>b.addEventListener('click',()=>{const e=timelineState.events.find(x=>x.id===b.dataset.detailEvent);if(e){modal.classList.add('hidden');const r=$('timelineRange');if(r){r.value=e.t;selectTime(e.t,e.id);$('interactiveTimeline')?.scrollIntoView({behavior:'smooth',block:'start'})}}}));modal.classList.remove('hidden');}
 document.addEventListener('click',e=>{if(e.target?.dataset?.closePlayer) $('playerDetailModal')?.classList.add('hidden')});$('closePlayerDetail')?.addEventListener('click',()=>$('playerDetailModal')?.classList.add('hidden'));document.addEventListener('keydown',e=>{if(e.key==='Escape')$('playerDetailModal')?.classList.add('hidden')});
 window.renderInteractiveTimeline=renderInteractiveTimeline;window.bindPlayerDetailCards=bindPlayerDetailCards;
})();
