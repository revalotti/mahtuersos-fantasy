import { icon, hydrateIcons } from './icons.mjs?v=mvqxwhgi';
import { mountField } from './lineup-field.mjs?v=mvqxwhgi';
import { normalize, IDS, META, CHAMPIONS_PHASES, ENTRY_FEE, PREMIUM_COST, FULL_LEAGUE, BASE_PRIZES, prizeTable, championsPrize, standings, standingsWithMovement, records, roundWins, podiums, form, bestStreaks, biggestMargins, hallOfFame, chronological, roundKey, roundOrder, roundLabel, championsProgress, phaseStandings } from './domain.mjs?v=mvqxwhgi';
const $ = (s,root=document) => root.querySelector(s);
const $$ = (s,root=document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(n);
const euro = n => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n);
const date = d => new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short'}).format(new Date(d+'T12:00:00'));
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const initials = name => name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
// Publicación estática (GitHub Pages): export.mjs añade <meta name="static-base"> con la subcarpeta del sitio y los datos como archivos.
const STATIC_BASE=document.querySelector('meta[name=static-base]'),BASE=(STATIC_BASE?.content||'').replace(/\/$/,'');
// En la copia estática, cada publicación lleva su versión (`?v=`) en los datos y los módulos: el navegador nunca enseña una mezcla de versiones ni una caché antigua.
const STATIC_VERSION=document.querySelector('meta[name=static-version]')?.content||'';
const vq=u=>STATIC_VERSION?`${u}${u.includes('?')?'&':'?'}v=${STATIC_VERSION}`:u;
const withBase=u=>BASE&&u.startsWith('/')&&!(u===BASE||u.startsWith(BASE+'/')||u.startsWith(BASE+'?'))?BASE+u:u;
const unbase=u=>BASE&&(u===BASE||u.startsWith(BASE+'/')||u.startsWith(BASE+'?'))?u.slice(BASE.length)||'/':u;
const assetUrl=u=>STATIC_BASE&&u.startsWith('/api/lineups/')?`${BASE}/data/lineups/${u.slice('/api/lineups/'.length)}.webp`:withBase(u);
const lineupDataUrl=u=>STATIC_BASE?vq(`${BASE}/data/lineups/${u.slice('/api/lineups/'.length)}.json`):withBase(`${u}.json`);
const rebase=root=>{if(BASE)$$('a[data-route]',root).forEach(a=>a.setAttribute('href',withBase(a.getAttribute('href'))));};
let gallery={title:'',items:[]};   // alineaciones de la jornada abierta, para el visor de imágenes
let preferredView='list';   // última vista elegida en Jornadas (Tabla o Alineaciones)
let photos={};   // nombre normalizado → foto de perfil de Biwenger (public/avatares.json)
const avatar = name => photos[normalize(name)]?`<img class="avatar photo" src="${withBase(photos[normalize(name)])}" alt="" loading="lazy">`:`<span class="avatar" aria-hidden="true">${esc(initials(name))}</span>`;
const CRESTS = {mahtuliga:withBase('/assets/mahtuliga.png'),mahtwoliga:withBase('/assets/mahtwoliga.png'),mahtuchampions:withBase('/assets/mahtuchampions.png')};
const CREST_SIZE = {sm:28,md:40,lg:56,xl:80};
const crest = (id,size='md') => `<span class="crest ${size} ${id==='mahtuchampions'?'cup':'league'}" style="background-image:url(${CRESTS[id]})" aria-hidden="true"></span>`;
const empty = (title,text,iconName='info') => `<div class="empty"><div class="empty-symbol">${icon(iconName,26)}</div><strong>${title}</strong><p>${text}</p></div>`;
let state, rules, currentId=null, currentTab='resumen', currentRound=null, currentPlayer=null, currentView='list', toastTimer;
const main = $('#main');
async function api(path,options={}) {
  const res = await fetch(STATIC_BASE?vq(path==='/api/state'?`${BASE}/data/state.json`:withBase(path)):path,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data = await res.json();
  if (!res.ok) { throw Error(data.error || 'No se ha podido completar la acción.'); }
  return data;
}
function notify(text) { clearTimeout(toastTimer); $('#toast').textContent=text; $('#toast').hidden=false; toastTimer=setTimeout(()=>$('#toast').hidden=true,4500); }
function getRoute() {
  const path=unbase(location.pathname).replace(/\/$/,'').slice(1);
  currentId=IDS.includes(path)?path:null;
  const tab=new URLSearchParams(location.search).get('tab');
  currentTab=['resumen','clasificacion','clasificados','fase1','fase2','cuadro','jornadas','records','ultimos','reglas','palmares'].includes(tab)?tab:'resumen';
  currentRound=new URLSearchParams(location.search).get('jornada')||null;
  currentPlayer=new URLSearchParams(location.search).get('jugador');
  currentView=new URLSearchParams(location.search).get('vista')==='alineacion'?'lineup':'list';
}
function navigate(url,noScroll=false) {
  const previous=currentId;rulesQuery='';rulesActive=null;url=unbase(url);history.pushState({},'',withBase(url));getRoute();render();
  const bar=$('.tabs-bar'),smooth=matchMedia('(prefers-reduced-motion: no-preference)').matches?'smooth':'instant';
  if(noScroll){/* teclado: la posición no cambia */}
  else if(previous&&previous===currentId&&bar) {
    // Misma competición. Móvil: al inicio del contenido nuevo, justo bajo las pestañas. Escritorio: el encabezado (con el logo) se ve siempre, así que
    // la página no se mueve al cambiar de pestaña; solo si se había bajado más allá del inicio del contenido, se vuelve a él.
    const top=$('.tabs-anchor').getBoundingClientRect().top+scrollY-$('.topbar').offsetHeight;
    if(matchMedia('(max-width:760px)').matches||scrollY>top)window.scrollTo({top,behavior:smooth});
  }
  else window.scrollTo({top:0});
  main.focus({preventScroll:true});
}
function roundCoverage(c) { return c.baseline?.throughRound || 0; }
// Fecha de la última jornada jugada (la más alta que no sea aplazada); vacío si no hay ninguna.
function lastRoundDate(c) { const r=[...c.rounds].filter(x=>!x.postponed&&x.date).sort((a,b)=>roundOrder(b)-roundOrder(a))[0]; return r?date(r.date):''; }
function maxRound(c) { return Math.max(roundCoverage(c),0,...c.rounds.map(r=>r.number)); }
function stat({label,value,suffix='',player=false,iconName,tone,sub='',aside=''}) { return `<div class="stat t-${tone}"><span class="stat-icon">${icon(iconName,22)}</span><div class="stat-body"><small>${label}</small>${aside?'<span class="stat-fig">':''}<strong class="${player?'player-stat':''}">${value}</strong>${suffix?`<em>${suffix}</em>`:''}${aside}${aside?'</span>':''}${sub?`<span class="stat-sub">${sub}</span>`:''}</div></div>`; }
// ---- Componentes compartidos -------------------------------------------------
const panelHead = (title,{iconName,action}={}) => `<div class="panel-head"><h2>${iconName?icon(iconName,18):''}${title}</h2>${action||''}</div>`;
const moreLink = (href,label='Ver todo') => `<a href="${href}" data-route class="text-link">${label}${icon('chevron-right',16)}</a>`;
const sectionHeading = (title,extra='') => `<div class="section-heading"><h2>${title}</h2>${extra}</div>`;
// Fila estándar: posición, avatar, nombre (+detalle), valor. Se usa en todas las clasificaciones y listas.
function rankRows(rows,{meta,qualify=0,unit='',href,activeId,mark,outFrom=0}={}) {
  return `<div class="rank-list">${rows.map(r=>{
    const link=href?.(r),flag=mark?.(r),cls=`rank-row ${qualify&&r.rank<=qualify?'qualifying':''} ${link?'link':''} ${activeId&&r.id===activeId?'active':''} ${flag?'is-'+flag:''} ${outFrom&&r.rank>outFrom?'out':''}`;
    const inner=`<span class="pos">${r.rank}</span>${avatar(r.name)}<span class="name">${esc(r.name)}${meta?`<small>${meta(r)}</small>`:''}</span>${flag?`<span class="mark ${flag}" title="${flag==='first'?'Mejor de la jornada':'Último de la jornada'}">${icon(flag==='first'?'crown':'thumbs-down',14)}<span class="sr-only">${flag==='first'?'Mejor de la jornada':'Último de la jornada'}</span></span>`:''}<span class="pts">${num(r.points)}${unit?`<small>${unit}</small>`:''}</span>${link?icon('chevron-right',16,'chev'):''}`;
    return link?`<a class="${cls}" href="${link}" data-route data-keep>${inner}</a>`:`<div class="${cls}">${inner}</div>`;
  }).join('')}</div>`;
}
// Portada: tres puertas de entrada, sin datos de las ligas (para verlos hay que entrar).
function home() {
  const portal=id=>{const m=META[id];return `<a class="portal portal-${id}" href="/${id}" data-route style="--accent:${m.color}"><strong class="portal-name">${m.name}</strong><span class="portal-go" aria-hidden="true">${icon('arrow-right',20)}</span></a>`;};
  const when=state.updatedAt?new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(state.updatedAt)):'';
  return `<div class="home-page"><section class="home-hero"><div class="home-hero-in"><h1 class="home-title"><span>Aquí no hay</span><em>amigos.</em></h1></div></section><div class="home"><div class="portals">${IDS.map(portal).join('')}</div>${when?`<p class="home-updated">${icon('refresh-cw',14)}Actualizado el ${when.replace(',',' ·')}</p>`:''}</div></div>`;
}
function table(c,rows=standings(c),options={}) {
  if(!rows.length)return empty('Plazas por decidir','Los participantes aparecerán cuando se confirmen los clasificados.');
  return rankRows(rows,{qualify:!options.round&&currentId!=='mahtuchampions'?4:0,unit:''});
}
function podium(c,maxRank=3,meta=r=>rchips([rchip(jr(r.number))])) {
  const data=records(c,maxRank);
  if(!data.length)return empty('Sin récords todavía','Se calcula con las puntuaciones de las jornadas publicadas.','star');
  return rankRows(data,{meta});
}
function lastList(c,full=false) {
  const realRounds=c.rounds.filter(r=>!r.postponed&&!r.incomplete).length;
  if(!c.rounds.length)return empty('Contador pendiente','Se actualizará al publicar los resultados de cada jornada.','arrow-down-to-line');
  const rows=standings(c).sort((a,b)=>b.last-a.last||a.name.localeCompare(b.name,'es'));
  return `${rows.filter(r=>full||r.last>0).map(r=>`<div class="list-row"><span class="player">${avatar(r.name)}<span>${esc(r.name)}</span></span><span class="value">${full&&currentId!=='mahtuchampions'?rchips([rchip('Devolución',euro(Math.max(0,10-r.last*.5)),{plain:true})]):''}<b>${r.last}</b></span></div>`).join('')}${full?`<p class="hint">${realRounds} jornadas registradas.${currentId!=='mahtuchampions'?' Cada última posición descuenta 0,50 € de la fianza de 10 €.':''} En caso de empate se usa el último puesto confirmado de Biwenger. Las jornadas con partidos pendientes cuentan cuando terminan.</p>`:''}`;
}
function qualificationPanel() {
  return `<div class="qualifiers">${IDS.slice(0,2).map(id=>{
    const c=state.competitions[id],max=maxRound(c);
    // A final cut needs every score through J19, either from the baseline or individual rounds.
    const base=c.baseline, canUseBase=base?.throughRound!==null&&base?.throughRound<=19;
    const start=canUseBase?base.throughRound+1:1;
    const complete=Array.from({length:20-start},(_,i)=>i+start).every(n=>c.rounds.some(r=>!r.postponed&&r.number===n));
    const cut={...c,baseline:canUseBase?base:null,rounds:c.rounds.filter(r=>r.number<=19)};
    const rows=standings(complete?cut:c),boundaryTie=rows.length>4&&rows[3].points===rows[4].points;
    return `<section class="panel" style="--accent:${META[id].color}"><div class="league-head static">${crest(id,'md')}<span><h2>${META[id].name}</h2><small>${complete?'Corte J19':'Clasificación provisional'}</small></span></div>${rows.length?rankRows(rows.slice(0,4)):empty('Sin participantes','Añade los participantes de esta liga.')}${boundaryTie?'<p class="hint">Empate en el corte: la última plaza requiere confirmación.</p>':''}</section>`;
  }).join('')}</div>`;
}
// ---- Récords y últimos puestos: lista principal + panel de apoyo ------------------------------
const realRoundsOf=c=>c.rounds.filter(r=>!r.postponed&&!r.incomplete);
// Chips de las jornadas. La etiqueta lleva dos textos ({s: «J7», l: «Jornada 7»}): se enseña el largo cuando hay sitio (fitChips).
const jr=n=>({s:`J${n}`,l:`Jornada ${n}`});
const PLACE_NAME={1:'1.º puesto',2:'2.º puesto',3:'3.º puesto'};
const placeIcon=(place,size)=>place?icon(place===1?'crown':'medal',size):'';
const rchip=(label,value,{place=0,plain=false}={})=>{const t=typeof label==='string'?{s:label,l:label}:label;return `<span class="rchip${place?` place-${place}`:''}${plain?' plain':''}"${place?` title="${PLACE_NAME[place]}"`:''}>${placeIcon(place,11)}<i data-s="${esc(t.s)}" data-l="${esc(t.l)}">${esc(t.l)}</i>${value===undefined?'':`<b>${typeof value==='number'?num(value):esc(value)}</b>`}</span>`;};
// more: {title, rounds:[{number,place}]} → si no caben en una línea, se ocultan los últimos y aparece «+N», que abre la lista completa.
const rchips=(items,more)=>`<span class="rchips"${more?' data-fit="more"':' data-fit'}>${items.join('')}${more?`<button type="button" class="rchip more" data-more-title="${esc(more.title)}" data-more-rounds="${more.rounds.map(r=>r.place?`${r.number}:${r.place}`:r.number).join(',')}" hidden></button>`:''}</span>`;
const RECORD_TABS=[['mejores','Mejores','medal'],['forma','Forma','flame'],['ganadas','Ganadas','trophy'],['holgadas','Holgadas','chevrons-up'],['podios','Podios','award'],['rachas','Rachas','trending-up'],['peores','Peores','arrow-down-to-line']];
function recordsView(c,isChamp) {
  const real=realRoundsOf(c),lows=records(c,5,true),wins=roundWins(c),pods=podiums(c),fm=form(c,3),streaks=bestStreaks(c,3,3),margins=biggestMargins(c,3);
  const none=icon_=>empty('Sin datos todavía','Se calcula con las jornadas publicadas.',icon_);
  const jchip=r=>rchips([rchip(jr(r.number))]);
  const panel=(id,title,iconName,body)=>`<section class="panel rec-panel" id="rec-${id}">${panelHead(title,{iconName})}${body}</section>`;
  const panels={
    mejores:panel('mejores','Mejores jornadas','medal',podium(c,5,jchip)),
    forma:panel('forma',`Estado de forma · últimas ${fm.numbers.length||3} jornadas`,'flame',fm.rows.length?`${rankRows(fm.rows,{meta:r=>rchips(r.rounds.map(x=>rchip(jr(x.number),x.points)))})}<p class="hint">Suma de los puntos de ${fm.numbers.length===1?'la última jornada':`las últimas ${fm.numbers.length} jornadas (${fm.numbers.map(n=>'J'+n).join(', ')})`}.${fm.provisional.length?` ${fm.provisional.map(n=>'J'+n).join(' y ')} ${fm.provisional.length===1?'tiene':'tienen'} partidos pendientes: los puntos pueden variar.`:''}</p>`:none('flame')),
    ganadas:panel('ganadas','Jornadas ganadas','trophy',wins.length?rankRows(wins.slice(0,5),{meta:r=>rchips(r.rounds.map(n=>rchip(jr(n))),{title:`${r.name} · Jornadas ganadas`,rounds:r.rounds.map(number=>({number}))})}):none('trophy')),
    holgadas:panel('holgadas','Victorias más holgadas','chevrons-up',margins.length?rankRows(margins,{meta:r=>rchips([rchip(jr(r.number)),rchip('Gana con',r.top,{plain:true})])}):none('chevrons-up')),
    podios:panel('podios','Más veces en el podio','award',pods.length?`${rankRows(pods.slice(0,5),{meta:r=>rchips(r.rounds.map(x=>rchip(jr(x.number),undefined,{place:x.place})),{title:`${r.name} · Jornadas en el podio`,rounds:r.rounds})})}<p class="hint">Veces que ha quedado entre los tres mejores de una jornada. Oro, plata y bronce indican si fue 1.º, 2.º o 3.º de esa jornada.</p>`:none('award')),
    rachas:panel('rachas','Mejor racha de 3 jornadas','trending-up',streaks.length?rankRows(streaks,{meta:r=>rchips([rchip({s:`J${r.from}–${r.to}`,l:`Jornadas ${r.from}–${r.to}`})])}):none('trending-up')),
    peores:panel('peores','Peores jornadas','arrow-down-to-line',lows.length?rankRows(lows,{meta:jchip}):none('arrow-down-to-line')),
  };
  const nav=`<nav class="rec-nav" aria-label="Ir a un récord">${RECORD_TABS.map(([id,label,ic])=>`<button type="button" class="rec-jump" data-jump="rec-${id}">${icon(ic,15)}${label}</button>`).join('')}</nav>`;
  return `${sectionHeading('Récords',`<span class="subtle">${real.length} jornadas registradas</span>`)}${nav}<div class="rec-cols">${RECORD_TABS.map(([id])=>panels[id]).join('')}</div>`;
}
// «Último de cada jornada»: lista paginada de 10 en 10 (la más reciente primero). La página se conserva mientras se está en la pestaña.
const HISTORY_PAGE=10;
let historyPage=1,historyOwner=null;
function historyHtml(c) {
  const real=realRoundsOf(c),pending=c.rounds.filter(r=>!r.postponed&&r.incomplete);
  const rows=[...real,...pending].sort((a,b)=>roundOrder(b)-roundOrder(a)).map(r=>{
    const chip=`<span class="value">${rchips([rchip(jr(r.number))])}</span>`;
    if(r.incomplete)return `<div class="list-row"><span class="player muted-row"><span class="avatar ghost" aria-hidden="true">?</span><span>Pendiente de partidos aplazados</span></span>${chip}</div>`;
    const p=c.players.find(x=>x.id===r.lastPlayerId);
    return p?`<div class="list-row"><span class="player">${avatar(p.name)}<span>${esc(p.name)}</span></span>${chip}</div>`:'';
  }).filter(Boolean);
  if(!rows.length)return empty('Sin datos todavía','Se actualizará al publicar las jornadas.','calendar');
  const pages=Math.ceil(rows.length/HISTORY_PAGE);historyPage=Math.min(Math.max(historyPage,1),pages);
  const from=(historyPage-1)*HISTORY_PAGE;
  const pager=pages>1?`<nav class="pager" aria-label="Páginas de últimos por jornada"><button type="button" class="icon-btn" data-history-page="${historyPage-1}" aria-label="Página anterior" ${historyPage===1?'disabled':''}>${icon('chevron-left',18)}</button><span class="pager-label"><b>${from+1}–${Math.min(from+HISTORY_PAGE,rows.length)}</b> de ${rows.length} · Página ${historyPage} de ${pages}</span><button type="button" class="icon-btn" data-history-page="${historyPage+1}" aria-label="Página siguiente" ${historyPage===pages?'disabled':''}>${icon('chevron-right',18)}</button></nav>`:'';
  return `${rows.slice(from,from+HISTORY_PAGE).join('')}${pager}`;
}
function lastView(c,isChamp) {
  const real=realRoundsOf(c);
  if(historyOwner!==currentId){historyOwner=currentId;historyPage=1;}
  return `${sectionHeading('Últimos puestos',`<span class="subtle">${real.length} jornadas registradas</span>`)}<div class="two-col"><section class="panel">${panelHead('Por participante',{iconName:'users'})}${lastList(c,true)}</section><div class="stack"><section class="panel" id="history-panel">${panelHead('Último de cada jornada',{iconName:'calendar'})}<div id="history-body">${historyHtml(c)}</div></section></div></div>`;
}

// ---- Clasificación general con movimiento y diferencias, como la tabla de Biwenger ----------------
function standingsView(c) {
  const {rows,last,shown,hasPrevious}=standingsWithMovement(c);
  if(!rows.length)return `<div class="panel">${empty('Sin participantes','Aparecerán cuando se confirmen.')}</div>`;
  const move=r=>{
    if(!hasPrevious)return '';
    if(r.change>0)return `<i class="move up" title="Ha subido ${r.change} ${r.change===1?'puesto':'puestos'}">${icon('arrow-up',11)}${r.change}</i>`;
    if(r.change<0)return `<i class="move down" title="Ha bajado ${-r.change} ${r.change===-1?'puesto':'puestos'}">${icon('arrow-down',11)}${-r.change}</i>`;
    return `<i class="move same" title="Mantiene el puesto">${icon('minus',11)}</i>`;
  };
  const gap=r=>r.gap===null?'<small class="gap leader">Líder</small>':r.gap===0?'<small class="gap">Empate</small>':`<small class="gap">−${num(r.gap)}</small>`;
  // Columnas de apoyo: puntos de la última jornada, mejor jornada de cada uno y veces que ha sido último.
  const lastScores=Object.fromEntries((shown?.scores||[]).map(x=>[x.playerId,x.points]));
  const top=Math.max(...Object.values(lastScores),-Infinity);
  const best=Object.fromEntries(c.players.map(p=>{
    let found=null;
    for(const rd of c.rounds.filter(x=>!x.postponed))for(const sc of rd.scores)if(sc.playerId===p.id&&(!found||sc.points>found.points))found={points:sc.points,number:rd.number};
    return [p.id,found];
  }));
  const lastCell=r=>{
    if(!(r.id in lastScores))return '<span class="cell muted">–</span>';
    const tag=shown.incomplete?'':r.id===shown.lastPlayerId?`<span class="mark last" title="Último de la jornada">${icon('thumbs-down',12)}</span>`:lastScores[r.id]===top?`<span class="mark first" title="Mejor de la jornada">${icon('crown',12)}</span>`:'';
    return `<span class="cell"><b>${num(lastScores[r.id])}</b>${tag}</span>`;
  };
  const head=`<div class="rank-row standing standing-head" aria-hidden="true"><span class="pos-cell">#</span><span class="who">Participante</span><span class="cell" ${shown?`title="${roundLabel(shown)}"`:''}><span class="lbl-long">Última jornada</span><span class="lbl-short">Última</span></span><span class="cell c-best">Mejor jornada</span><span class="cell c-lost">Veces último</span><span class="pts-col">Puntos</span></div>`;
  return `<section class="panel standings-panel">${panelHead('Clasificación general',{iconName:'list-ordered',action:hasPrevious&&last?`<span class="subtle">Cambios desde la ${roundLabel(last).toLowerCase()}</span>`:''})}<div class="rank-list">${head}${rows.map(r=>`<div class="rank-row standing ${r.rank<=4?'qualifying':''}"><span class="pos pos-cell"><b>${r.rank}</b>${move(r)}</span><span class="who">${avatar(r.name)}<span class="name">${esc(r.name)}</span></span>${lastCell(r)}<span class="cell c-best">${best[r.id]?`<b>${num(best[r.id].points)}</b><small>J${best[r.id].number}</small>`:'–'}</span><span class="cell c-lost ${r.last?'':'muted'}"><b>${r.last}</b></span><span class="pts-col"><b>${num(r.points)}</b>${gap(r)}</span></div>`).join('')}</div><div class="table-note legend-note"><span><i class="move up">${icon('arrow-up',11)}</i><i class="move down">${icon('arrow-down',11)}</i> Puestos que ha subido o bajado</span><span><small class="gap">−N</small> Puntos hasta el puesto de arriba</span><span><i class="dot champ"></i>Top 4: acceso a MahtuChampions</span></div></section>`;
}

// ---- Reglas: grupos plegables con buscador ----------------------------------------------------
let rulesQuery='',rulesActive=null;
const DESKTOP=matchMedia('(min-width:901px)');
const fold=text=>String(text).split('').map(u=>u.normalize('NFD').replace(/[\u0300-\u036f]/g,'')[0]||u).join('').toLowerCase();
// Los textos de las reglas admiten {{n}}, {{collected}}, {{pot}}, {{p1}}, {{p2}}, {{p3}}, {{cc}}, {{cp}} y {{contrib}}: importes calculados según los participantes actuales.
const fillRules=(html,ctx)=>String(html).replace(/\{\{(\w+)\}\}/g,(m,k)=>ctx[k]??m);
const ruleCard=(cd,ctx={})=>`<article class="card searchable" data-keywords="${esc(cd.keywords||'')}"><h3>${icon(cd.icon||'info',18)}<span>${fillRules(cd.title,ctx)}</span></h3><div class="card-body">${fillRules(cd.html,ctx)}</div></article>`;
const ruleGroup=(g,i,all,after='',ctx={})=>`<details class="accordion rule-group ${all.length===1?'flat':''}" id="rules-${g.id}" data-default="${all.length===1?'1':'0'}" ${all.length===1?'open':''}><summary><span class="accordion-summary-text"><span class="sum-tag">${g.tag}</span><span class="sum-text-block"><h2>${g.title}</h2><p class="sum-desc">${g.desc}</p></span></span></summary><div class="accordion-body">${g.cards.map(cd=>ruleCard(cd,ctx)).join('')}${after}</div></details>`;
// En escritorio el índice lateral hace de selector de sección (se ve una sección a la vez, sin acordeones);
// en móvil se usan acordeones. La búsqueda recorre todas las secciones en ambos casos.
function rulesView(c,isChamp) {
  const groups=isChamp?rules.champions:rules.liga,withIndex=groups.length>2;
  // Importes según los participantes actuales: con menos de 10, la diferencia no se cubre y los premios se reajustan en proporción.
  const pt=prizeTable(c.players.length||10),cp=championsPrize(state);
  const lig=IDS.slice(0,2).map(id=>({name:META[id].name,t:prizeTable(state.competitions[id].players.length||10)}));
  const contrib=lig[0].t.champions===lig[1].t.champions?`Cada liga aporta <strong>${lig[0].t.champions} €</strong>`:`${lig[0].name} aporta <strong>${lig[0].t.champions} €</strong> y ${lig[1].name} <strong>${lig[1].t.champions} €</strong>`;
  // Participantes de cada liga (las reglas se adaptan solas si un año hay más o menos gente): {{total}} y {{split}}, p. ej. «dos ligas de 9».
  const counts=IDS.slice(0,2).map(id=>state.competitions[id].players.length),total=counts[0]+counts[1];
  const split=counts[0]===counts[1]?`dos ligas de ${counts[0]}`:`dos ligas: ${META[IDS[0]].name} (${counts[0]}) y ${META[IDS[1]].name} (${counts[1]})`;
  const ctx={n:pt.n,total,n1:counts[0],n2:counts[1],split,collected:pt.collected,pot:pt.pot,p1:pt.first,p2:pt.second,p3:pt.third,cc:pt.champions,cp,contrib};
  const cuentas=!isChamp&&pt.shortfall!==0?ruleCard({title:`Cuentas con los ${pt.n} participantes actuales`,icon:'calculator',keywords:`participantes actuales ${pt.n} cuentas recaudación inscripciones premium diferencia reparto reajuste premios previstos ${FULL_LEAGUE} proporción`,html:`<div class="rows"><div class="row"><span>Inscripciones (${pt.n} × ${ENTRY_FEE} €)</span><strong>${euro(pt.collected)}</strong></div><div class="row"><span>Premium de Biwenger</span><strong>−${euro(PREMIUM_COST)}</strong></div><div class="row total"><span>Disponible para premios</span><strong>${euro(pt.pot)}</strong></div><div class="row"><span>Previsto con ${FULL_LEAGUE} participantes</span><strong>${euro(pt.expected)}</strong></div><div class="row"><span>${pt.shortfall<0?'Diferencia (no se cubre)':'Diferencia (sobra)'}</span><strong class="neg">${pt.shortfall<0?'−':'+'}${euro(Math.abs(pt.shortfall))}</strong></div></div><p class="tip">Con ${FULL_LEAGUE} participantes eran ${BASE_PRIZES.first} / ${BASE_PRIZES.second} / ${BASE_PRIZES.third} € y ${BASE_PRIZES.champions} € para la copa. Con ${pt.n}: <strong>${pt.first} / ${pt.second} / ${pt.third} €</strong> y <strong>${pt.champions} €</strong> para la copa. La fianza (10 € por participante) va aparte y no cuenta en este reparto.</p>`}):'';
  const index=withIndex?`<nav class="rules-index" aria-label="Secciones de las reglas">${groups.map(g=>`<a href="#rules-${g.id}" data-group="rules-${g.id}"><span class="idx-tag">${g.tag}</span><span class="idx-title">${g.title}</span><span class="idx-count"></span></a>`).join('')}</nav>`:'';
  const search=`<div class="rules-search"><label class="search">${icon('search',18)}<input id="rules-search" type="search" placeholder="Busca: ${isChamp?'fases, sorteo…':'capitán, premios…'}" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Buscar en las reglas" value="${esc(rulesQuery)}"><button type="button" class="clear" id="rules-clear" aria-label="Borrar búsqueda" hidden>${icon('x',16)}</button></label><div class="rules-chips" role="group" aria-label="Temas frecuentes">${(rules.quick?.[isChamp?'champions':'liga']||[]).map(([label,q])=>`<button type="button" class="rules-chip" data-q="${esc(q)}" aria-pressed="false">${esc(label)}</button>`).join('')}</div><p class="search-status" id="rules-status" role="status" aria-live="polite"></p></div>`;
  return `<div class="rules-layout"><div class="rules-grid ${withIndex?'with-index':''}"><aside class="rules-side">${search}${index}</aside><div class="rules-content"><div id="rules-groups">${groups.map((g,i,all)=>ruleGroup(g,i,all,g.id==='dinero'?cuentas:'',ctx)).join('')}</div><div id="rules-empty" hidden>${empty('Sin resultados','Prueba con otra palabra o con menos palabras.','search')}</div>${c.customRules?`<section class="panel spaced"><div class="panel-head"><h3>Notas de la competición</h3></div><div class="custom-rules">${esc(c.customRules)}</div></section>`:''}<p class="help-note">${esc(rules.help.text)}</p></div></div></div>`;
}
function highlight(el,tokens) {
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes) {
    const text=node.nodeValue,folded=fold(text),ranges=[];
    for(const t of tokens){let i=folded.indexOf(t);while(i>=0){ranges.push([i,i+t.length]);i=folded.indexOf(t,i+t.length);}}
    if(!ranges.length)continue;
    ranges.sort((a,b)=>a[0]-b[0]);
    const merged=[];for(const r of ranges){const last=merged.at(-1);if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push([...r]);}
    const frag=document.createDocumentFragment();let pos=0;
    for(const [a,b] of merged){if(a>pos)frag.append(text.slice(pos,a));const mark=document.createElement('mark');mark.className='hit';mark.textContent=text.slice(a,b);frag.append(mark);pos=b;}
    if(pos<text.length)frag.append(text.slice(pos));
    node.replaceWith(frag);
  }
}
function applyRulesSearch() {
  const root=$('#rules-groups');if(!root)return;
  // Se busca por la raíz de cada palabra (pagar → «pag»): así «pagar», «pago» y «pagan» encuentran lo mismo, y da igual escribir con o sin tildes o mayúsculas.
  const stem=t=>t.length>=5?t.slice(0,-2):t,tokens=fold(rulesQuery).trim().split(/\s+/).filter(Boolean).map(stem),desktop=DESKTOP.matches;
  $$('mark.hit',root).forEach(m=>m.replaceWith(document.createTextNode(m.textContent)));root.normalize();
  const groups=$$('.rule-group',root),first=groups[0]?.id.replace('rules-','');
  if(!groups.some(g=>g.id==='rules-'+rulesActive))rulesActive=first;
  // Móvil: al empezar a buscar se recuerda qué acordeones estaban abiertos y al borrar se restauran.
  if(tokens.length&&root.dataset.searching!=='1'){groups.forEach(g=>g.dataset.wasOpen=g.open?'1':'0');root.dataset.searching='1';}
  let total=0;
  for(const group of groups){
    let shown=0;
    for(const cd of $$('.card.searchable',group)){
      const hay=fold(`${cd.textContent} ${cd.dataset.keywords}`),ok=tokens.every(t=>hay.includes(t));
      cd.hidden=!ok;if(ok){shown++;if(tokens.length)highlight(cd,tokens);}
    }
    total+=shown;
    // Buscando: se ven todas las secciones con resultados. Sin buscar: escritorio = solo la sección activa; móvil = todas.
    group.hidden=tokens.length?!shown:desktop&&group.id!=='rules-'+rulesActive;
    const link=$(`.rules-index [data-group="${group.id}"]`);
    if(link){link.hidden=tokens.length>0&&!shown;link.classList.toggle('active',!tokens.length&&group.id==='rules-'+rulesActive);$('.idx-count',link).textContent=tokens.length&&shown?shown:'';}
    if(tokens.length)group.open=shown>0;
    else if(desktop)group.open=true;
  }
  if(!tokens.length&&root.dataset.searching==='1'){root.dataset.searching='0';if(!desktop)groups.forEach(g=>{g.open=g.dataset.wasOpen==='1';});}
  // Al volver de escritorio a móvil, los acordeones recuperan su estado inicial.
  if(!tokens.length&&!desktop&&root.dataset.mode==='d')groups.forEach(g=>{g.open=g.dataset.default==='1';});
  root.dataset.mode=desktop?'d':'m';
  $$('.rules-chip').forEach(b=>b.setAttribute('aria-pressed',String(tokens.length>0&&fold(rulesQuery).trim()===fold(b.dataset.q))));
  $('#rules-empty').hidden=!(tokens.length&&!total);
  $('#rules-status').textContent=tokens.length?`${total} ${total===1?'resultado':'resultados'}`:'';
  $('#rules-clear').hidden=!rulesQuery;
}
DESKTOP.addEventListener('change',()=>applyRulesSearch());
// Pestañas de cada página: barra fija bajo la cabecera, pestaña activa siempre a la vista, sombras en los bordes
// cuando hay más pestañas fuera de pantalla y navegación con el teclado (← → Inicio Fin).
// En móvil, al quedarse fija la barra de pestañas aparece sobre ella el nombre de la liga (clase is-stuck). Se calcula con la posición de la
// marca donde empieza la barra, así también está al llegar tras pulsar una pestaña (la página se coloca justo ahí).
const navHeight=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'))||0;
const markStuck=()=>{const bar=$('.tabs-bar'),anchor=$('.tabs-anchor');if(bar&&anchor)bar.classList.toggle('is-stuck',anchor.getBoundingClientRect().top<=navHeight()+1);};
let stuckFrame=0;
window.addEventListener('scroll',()=>{if(!stuckFrame)stuckFrame=requestAnimationFrame(()=>{stuckFrame=0;markStuck();});},{passive:true});
window.addEventListener('resize',markStuck);
function initTabs() {
  const bar=$('.tabs-bar'),tabs=$('.tabs');if(!bar||!tabs)return;
  markStuck();
  const update=()=>{const max=tabs.scrollWidth-tabs.clientWidth;bar.classList.toggle('fade-l',tabs.scrollLeft>2);bar.classList.toggle('fade-r',tabs.scrollLeft<max-2);};
  // La pestaña activa se centra al entrar; se repite cuando carga la tipografía, que cambia los anchos.
  const center=()=>{const active=$('.tab.active',tabs);if(!active||!tabs.isConnected)return;const a=active.getBoundingClientRect(),t=tabs.getBoundingClientRect();tabs.scrollTo({left:tabs.scrollLeft+(a.left-t.left)-(t.width-a.width)/2,behavior:'instant'});update();};
  center();document.fonts?.ready.then(center);
  update();tabs.onscroll=update;
  tabs.onkeydown=e=>{
    const links=$$('.tab',tabs),i=links.indexOf(document.activeElement),to={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:links.length-1}[e.key];
    if(i<0||to===undefined)return;
    e.preventDefault();links[(to+links.length)%links.length].focus();
  };
}
window.addEventListener('resize',()=>$('.tabs')?.dispatchEvent(new Event('scroll')));
// Chips de una línea. Cada tabla se ajusta como un conjunto: «Jornada 7» si todas las filas lo admiten; si alguna no cabe, todas pasan a «J7» (mismo formato en toda la tabla).
// Si aun así una fila no cabe, se ocultan sus últimos chips y aparece «+N», que abre la lista completa.
function fitGroup(boxes) {
  const items=boxes.filter(b=>b.offsetParent).map(box=>({chips:[...box.querySelectorAll('.rchip:not(.more)')],more:box.querySelector('.rchip.more')})).filter(x=>x.chips.length);
  const label=(x,long)=>x.chips.forEach(c=>{const i=c.querySelector('i[data-s]');if(i)i.textContent=long?i.dataset.l:i.dataset.s;});
  const wraps=(x,el)=>el.offsetTop>x.chips[0].offsetTop+2;
  items.forEach(x=>{x.chips.forEach(c=>{c.hidden=false;});if(x.more)x.more.hidden=true;label(x,true);});
  if(items.some(x=>x.chips.some(c=>wraps(x,c))))items.forEach(x=>label(x,false));
  items.forEach(x=>{
    if(!x.more||!x.chips.some(c=>wraps(x,c)))return;
    x.more.hidden=false;let n=x.chips.length;
    do{n--;x.chips.forEach((c,i)=>{c.hidden=i>=n;});x.more.textContent=`+${x.chips.length-n}`;x.more.setAttribute('aria-label',`Ver ${x.chips.length-n} más`);}while(n>1&&wraps(x,x.more));
  });
}
const fitAllChips=()=>{const groups=new Map();$$('.rchips[data-fit]',main).forEach(b=>{const g=b.closest('.panel')||main;groups.set(g,[...(groups.get(g)||[]),b]);});groups.forEach(fitGroup);};
window.addEventListener('resize',fitAllChips);
let moreOpener=null;
function showRounds(btn) {
  let dlg=$('#rounds-dialog');
  if(!dlg){dlg=document.createElement('dialog');dlg.id='rounds-dialog';dlg.className='rounds-dialog';document.body.append(dlg);dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.closest('[data-close]'))dlg.close();});dlg.addEventListener('close',()=>moreOpener?.focus({preventScroll:true}));}
  const rounds=btn.dataset.moreRounds.split(',').filter(Boolean).map(x=>{const [number,place]=x.split(':').map(Number);return {number,place:place||0};});
  dlg.setAttribute('aria-label',btn.dataset.moreTitle);
  dlg.innerHTML=`<div class="rounds-head"><h2>${esc(btn.dataset.moreTitle)}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x',18)}</button></div><div class="rounds-body">${rounds.map(r=>`<span class="rchip big${r.place?` place-${r.place}`:''}"${r.place?` title="${PLACE_NAME[r.place]}"`:''}>${placeIcon(r.place,12)}<i>Jornada ${r.number}</i></span>`).join('')}</div><p class="rounds-count">${rounds.length} ${rounds.length===1?'jornada':'jornadas'}</p>`;
  moreOpener=btn;dlg.showModal();
}
document.addEventListener('click',e=>{const b=e.target.closest('.rchip.more');if(b)showRounds(b);});
// Paginación de «Último de cada jornada»: solo se vuelve a pintar la lista; la cabecera del panel no se mueve.
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-history-page]');if(!btn||btn.disabled||!currentId)return;
  const body=$('#history-body');if(!body)return;
  const top=$('#history-panel').getBoundingClientRect().top;
  historyPage=Number(btn.dataset.historyPage);
  body.innerHTML=historyHtml(state.competitions[currentId]);
  hydrateIcons(body);fitAllChips();
  const delta=$('#history-panel').getBoundingClientRect().top-top;if(delta)window.scrollBy({top:delta,behavior:'instant'});   // la lista cambia de alto: el panel se queda donde estaba
  $('.pager [data-history-page]:not([disabled])',body)?.focus?.({preventScroll:true});
});
// Récords: chips fijos bajo las pestañas que llevan a cada récord (scroll suave) y marcan el que se está viendo.
const recOffset=()=>navHeight()+($('.tabs-bar')?.offsetHeight||0)+($('.rec-nav')?.offsetHeight||0)+12;
let recCurrent=null,recFrame=0;
function markRecord(force) {
  const nav=$('.rec-nav');if(!nav)return;
  const panels=$$('.rec-panel',main);if(!panels.length)return;
  const y=recOffset()+4;let cur=panels[0];
  panels.forEach(p=>{if(p.getBoundingClientRect().top<=y)cur=p;});
  if(innerHeight+scrollY>=document.documentElement.scrollHeight-2)cur=panels.at(-1);
  if(cur.id===recCurrent&&!force)return;
  recCurrent=cur.id;
  $$('.rec-jump',nav).forEach(b=>{const on=b.dataset.jump===cur.id;b.classList.toggle('active',on);if(on){b.setAttribute('aria-current','true');nav.scrollTo({left:b.offsetLeft-(nav.clientWidth-b.offsetWidth)/2,behavior:'smooth'});}else b.removeAttribute('aria-current');});
}
window.addEventListener('scroll',()=>{if(!recFrame)recFrame=requestAnimationFrame(()=>{recFrame=0;markRecord();});},{passive:true});
document.addEventListener('click',e=>{
  const jump=e.target.closest('[data-jump]'),target=jump&&document.getElementById(jump.dataset.jump);if(!target)return;
  window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+scrollY-recOffset()),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
});
function initRulesSearch() {
  const input=$('#rules-search');if(!input)return;
  input.oninput=()=>{rulesQuery=input.value;applyRulesSearch();};
  // Temas frecuentes: un toque busca ese tema y otro toque sobre el mismo lo quita.
  $$('.rules-chip').forEach(b=>b.onclick=()=>{rulesQuery=fold(rulesQuery).trim()===fold(b.dataset.q)?'':b.dataset.q;input.value=rulesQuery;applyRulesSearch();});
  input.onkeydown=e=>{if(e.key==='Escape'&&rulesQuery){e.preventDefault();rulesQuery='';input.value='';applyRulesSearch();}};
  // Escritorio: el índice cambia de sección (y sale de la búsqueda si la hubiera).
  $$('.rules-index a').forEach(a=>a.onclick=e=>{e.preventDefault();rulesQuery='';input.value='';rulesActive=a.dataset.group.replace('rules-','');applyRulesSearch();});
  $('#rules-clear').onclick=()=>{rulesQuery='';input.value='';applyRulesSearch();input.focus();};
  applyRulesSearch();
}
// ---- MahtuChampions: resumen de la copa, fases y cuadro ---------------------------------------
const PHASE_STATE={done:'Finalizada',active:'En curso',pending:'Pendiente'};
const phaseTab=n=>n<=2?`fase${n}`:'cuadro';
const stateChip=state=>state==='pending'?'':`<span class="chip ${state}">${state==='active'?'<i class="live-dot"></i>':''}${PHASE_STATE[state]}</span>`;
const startChip=p=>p.state==='pending'&&p.start?`<span class="chip start">Empieza el ${date(p.start)}</span>`:'';
function champFormat(progress) {
  const tiles=p=>Array.from({length:p.from},(_,i)=>`<span class="tile ${i>=p.from-p.out?'out':''}">${i+1}</span>`).join('');
  const body=p=>p.kind==='liga'?`<strong>Formato liga</strong><div class="tiles">${tiles(p)}</div><small>Avanzan del 1.º al ${p.to}.º · quedan eliminados el ${Array.from({length:p.out},(_,i)=>`${p.to+1+i}.º`).join(' y el ')}</small>`
    :p.n===3?`<strong>${p.note}</strong><div class="pairs">${[0,1].map(()=>`<span class="pair"><span class="tile wide">Clasificado</span><span class="vs">VS</span><span class="tile wide">Clasificado</span></span>`).join('')}</div><small>Los cruces se deciden por sorteo entre los 4 clasificados</small>`
    :`<strong>${p.note}</strong><div class="pairs"><span class="pair"><span class="tile wide">Ganador<br>semifinal 1</span><span class="vs">VS</span><span class="tile wide">Ganador<br>semifinal 2</span></span></div><small>Partido único entre los ganadores de las semifinales: el ganador es el campeón</small>`;
  return `<div class="phases">${progress.phases.map(p=>`<section class="phase state-${p.state}"><header><span class="phase-n">Fase de Champions League ${stateChip(p.state)}${startChip(p)}</span><a class="phase-name" data-route href="/mahtuchampions?tab=${phaseTab(p.n)}">${p.name}</a><span class="phase-flow" title="Fase ${p.n} de MahtuChampions">Fase ${p.n}</span></header><div class="phase-body">${body(p)}</div></section>`).join('')}</div><p class="legend"><span class="tile out sm"></span>Eliminados en esa fase</p>`;
}
// Una fila por temporada entre la primera y la última con campeón; las que faltan quedan en blanco.
function timeline(c) {
  const by=new Map(c.honours.map(h=>[h.season,h.name])),years=c.honours.map(h=>+h.season.slice(0,4));
  if(!years.length)return '';
  const rows=[];for(let y=Math.max(...years);y>=Math.min(...years);y--){const key=`${y}/${String(y+1).slice(2)}`,name=by.get(key);rows.push(`<div class="list-row"><span class="player ${name?'':'muted-row'}">${name?avatar(name):'<span class="avatar ghost" aria-hidden="true">?</span>'}<span>${name?esc(name):'Sin registrar'}</span></span><span class="value"><small>${key}</small></span></div>`);}
  return `<section class="panel hall-timeline">${panelHead('Temporada a temporada',{iconName:'calendar'})}${rows.join('')}</section>`;
}
function champSummary(c) {
  const progress=championsProgress(c),cur=progress.phases.find(p=>p.state==='active'),next=progress.phases.find(p=>p.state==='pending');
  const hero=progress.finished
    ?`<div class="phase-hero done"><span class="hero-icon">${icon('trophy',26)}</span><div><small>Copa finalizada</small><strong>Campeón: ${esc(c.bracket.winner)}</strong></div></div>`
    :cur?`<div class="phase-hero active"><span class="hero-icon">${icon('swords',26)}</span><div><small>Fase actual</small><strong>Fase ${cur.n} · ${cur.name}</strong></div>${stateChip('active')}<a class="button secondary" data-route href="/mahtuchampions?tab=${phaseTab(cur.n)}">Ver fase ${icon('arrow-right',16)}</a></div>`
    :next?`<div class="phase-hero"><span class="hero-icon">${icon('calendar',26)}</span><div><small>Estado de la copa</small><strong>${c.players.length} de ${META.mahtuchampions.capacity} plazas confirmadas</strong><span>La fase ${next.n} ${next.start?`empieza el ${date(next.start)}`:'empieza con su ronda de la Champions League, fecha por confirmar'}</span></div></div>`:'';
  // Datos útiles de un vistazo que no se repiten en otra parte del resumen: cuánto falta para el corte y cuánto se juega.
  const lastDone=c2=>Math.max(roundCoverage(c2),0,...c2.rounds.filter(r=>!r.postponed&&!r.incomplete).map(r=>r.number)),
    left=Math.max(0,19-Math.min(...IDS.slice(0,2).map(id=>lastDone(state.competitions[id])))),
    facts=[
      ...(!cur&&!progress.finished?[left>0?['calendar','Corte en la J19',`${left===1?'falta 1 jornada':`faltan ${left} jornadas`} · 4 primeros de cada liga`]:['check','Corte hecho','los 4 primeros de cada liga entran']]:[]),
      ...(!progress.finished?[['trophy',`${championsPrize(state)} € al campeón`,'premio de la copa','gold']]:[]),
    ];
  const strip=facts.length?`<div class="fact-strip">${facts.map(([i,a,b,tone=''])=>`<div class="fact ${tone}">${icon(i,20)}<span><strong>${a}</strong><small>${b}</small></span></div>`).join('')}</div>`:'';
  return hero+strip+champFormat(progress);
}
function champPhaseView(c,n) {
  const ph=CHAMPIONS_PHASES[n-1],ph0=championsProgress(c).phases[n-1],st=ph0.state,rounds=c.rounds.filter(r=>r.phase===n);
  const head=`<div class="phase-intro"><div><span class="eyebrow">Fase ${n}</span><h2>${ph.name}</h2><p>${ph.desc}</p></div>${stateChip(st)}</div>`;
  if(!rounds.length)return `${head}<div class="panel">${empty('Todavía sin jornadas',ph0.start?`Empieza el ${date(ph0.start)}, con su ronda de la Champions League.`:'Empieza con su ronda de la Champions League.','calendar')}</div>`;
  const {rows}=phaseStandings(c,n);
  const table=`<section class="panel">${panelHead('Clasificación de la fase',{iconName:'list-ordered'})}${rankRows(rows,{outFrom:ph.to})}<div class="table-note"><i class="dot out"></i>Zona de eliminación (últimos ${ph.out})</div></section>`;
  return `${head}${table}<div class="phase-rounds">${sectionHeading('Jornadas de la fase')}${roundsView({...c,rounds})}</div>`;
}
function champBracket(c) {
  const b=c.bracket,semis=b?.semifinals||[{},{}],fin=b?.final||{},progress=championsProgress(c);
  const live=n=>progress.phases[n-1].state==='active'?stateChip('active'):'';
  const team=(t,placeholder,other)=>{
    const done=t&&other&&t.points!=null&&other.points!=null,win=done&&t.points>other.points,lose=done&&t.points<other.points;
    return `<div class="rank-row team ${t?'':'tbd'} ${win?'win':''} ${lose?'dim':''}">${t?avatar(t.name):'<span class="avatar ghost" aria-hidden="true">?</span>'}<span class="name">${t?esc(t.name):placeholder}</span>${t?.points!=null?`<span class="pts">${num(t.points)}</span>`:''}${win?icon('check',16,'win-check'):''}</div>`;
  };
  const match=(m,pa,pb)=>`<article class="panel match">${team(m?.a,pa,m?.b)}${team(m?.b,pb,m?.a)}</article>`;
  return `<div class="bracket"><h2 class="stage-title c1">Semifinales ${live(3)}</h2><h2 class="stage-title c3">Final Champions ${live(4)}</h2><h2 class="stage-title c5">Campeón</h2><div class="semis">${match(semis[0],'Por sortear','Por sortear')}${match(semis[1],'Por sortear','Por sortear')}</div><div class="conn conn-semis" aria-hidden="true"></div><div class="final-cell">${match(fin,'Ganador semifinal 1','Ganador semifinal 2')}</div><div class="conn conn-final" aria-hidden="true"></div><div class="panel champion ${b?.winner?'set':''}"><div class="rank-row">${icon('trophy',22)}<span class="name">${b?.winner?esc(b.winner):'Por decidir'}</span></div></div></div><p class="bracket-note">${CHAMPIONS_PHASES[2].desc} ${CHAMPIONS_PHASES[3].desc}</p>`;
}
function competition() {
  const c=state.competitions[currentId],m=META[currentId],isChamp=currentId==='mahtuchampions';
  const progress=isChamp?championsProgress(c):null,liveTab=n=>progress?.phases[n-1].state==='active';
  const tabs=isChamp
    ?[['resumen','Resumen'],['clasificados','Clasificados'],['fase1','Fase 1',liveTab(1)],['fase2','Fase 2',liveTab(2)],['cuadro','Cuadro',liveTab(3)||liveTab(4)],['reglas','Reglas'],['palmares','Palmarés']]
    :[['resumen','Resumen'],['clasificacion','Clasificación'],['jornadas','Jornadas'],['records','Récords'],['ultimos','Últimos'],['reglas','Reglas'],['palmares','Palmarés']];
  if(!isChamp&&['clasificados','fase1','fase2','cuadro'].includes(currentTab)||isChamp&&['clasificacion','jornadas','records','ultimos'].includes(currentTab))currentTab='resumen';
  let content='';
  if(currentTab==='resumen') {
    const ranking=standings(c),best=records(c)[0],tiedBest=records(c).filter(r=>r.rank===1).length-1;
    if(isChamp)content=champSummary(c);
    else content=`<div class="stat-grid">${stat({label:'Líder',value:ranking[0]?esc(ranking[0].name):'Por decidir',player:true,iconName:'crown',tone:'leader'})}${stat({label:'Última jornada',value:maxRound(c)||'—',suffix:isChamp?'':'/ 38',iconName:'calendar',tone:'round',sub:lastRoundDate(c)})}${stat({label:'Mejor jornada',value:best?num(best.points):'—',suffix:best?'pts':'',iconName:'medal',tone:'best',sub:best?`<span class="who-name">${esc(best.name)}${tiedBest>0?` · +${tiedBest} ${tiedBest===1?'empate':'empates'}`:''}</span><span class="who-photo">${avatar(best.name)}</span>`:'',aside:best?rchips([rchip(`J${best.number}`)]):''})}</div>${c.baseline?`<div class="notice">${icon('info',16)}<span>Clasificación inicial hasta la <strong>J${c.baseline.throughRound??'?'}</strong>. ${c.rounds.filter(r=>r.number<=c.baseline.throughRound).length< c.baseline.throughRound?'Récords y últimos puestos incluyen solo las jornadas registradas.':'Historial de jornadas inicial completo.'}</span></div>`:''}<div class="content-grid"><section class="panel">${panelHead('Clasificación',{iconName:'list-ordered'})}${table(c,isChamp?undefined:standings(c).slice(0,5))}<div class="table-note">${isChamp?'Puntos de las jornadas de MahtuChampions.':'<i class="dot champ"></i>Top 4 · Acceso a MahtuChampions en la J19.'}</div>${isChamp?'':`<a class="panel-link" href="/${currentId}?tab=clasificacion" data-route>Clasificación completa ${icon('arrow-right',16)}</a>`}</section><aside class="stack"><section class="panel">${panelHead('Mejores jornadas',{iconName:'medal',action:moreLink(`/${currentId}?tab=records`)})}${podium(c)}</section><section class="panel">${panelHead('Últimos puestos',{iconName:'arrow-down-to-line',action:moreLink(`/${currentId}?tab=ultimos`)})}${lastList(c)}</section></aside></div>`;
  } else if(currentTab==='jornadas') content=roundsView(c);
  else if(currentTab==='clasificacion') content=standingsView(c);
  else if(currentTab==='clasificados') content=qualificationPanel();
  else if(currentTab==='fase1'||currentTab==='fase2') content=champPhaseView(c,Number(currentTab.slice(4)));
  else if(currentTab==='cuadro') content=champBracket(c);
  else if(currentTab==='records') content=recordsView(c,isChamp);
  else if(currentTab==='ultimos') content=lastView(c,isChamp);
  else if(currentTab==='reglas') content=rulesView(c,isChamp);
  else if(currentTab==='palmares') {
    const hall=hallOfFame(c);
    content=`${sectionHeading('Palmarés')}${hall.length?`<div class="hall-grid">${hall.map(r=>`<article class="hall-card">${icon('trophy',26,'gold')}<h3>${esc(r.name)}</h3><strong>${r.count}</strong><div class="subtle">${r.count===1?'título':'títulos'}</div></article>`).join('')}</div>${timeline(c)}`:`<div class="panel">${empty('La historia está por escribir','Los campeones de cada temporada tendrán su sitio aquí.','trophy')}</div>`}`;
  }
  const status=`<span class="pill"><i class="dot"></i>${isChamp?(progress.finished?'Finalizada':progress.current?`Fase ${progress.current} en curso`:'Próximamente'):(maxRound(c)?'En juego':'Próximamente')}</span>`;
  return `<div class="page" style="--accent:${m.color}"><header class="competition-heading">${crest(currentId,'xl')}<div class="competition-title">${isChamp?'':'<span class="eyebrow">Liga</span>'}<h1>${m.name}</h1></div>${isChamp?status:''}</header><span class="tabs-anchor"></span><div class="tabs-bar"><div class="tabs-title" aria-hidden="true">${crest(currentId,'sm')}<span>${m.name}</span></div><nav class="tabs" aria-label="Secciones de ${m.name}">${tabs.map(([id,label,live])=>`<a class="tab ${id===currentTab?'active':''}" href="/${currentId}?tab=${id}" data-route ${id===currentTab?'aria-current="page"':''}>${label}${live?'<i class="live-dot" title="Fase en curso"></i>':''}</a>`).join('')}</nav></div><div class="section-space">${content}</div></div>`;
}
// Recortes de la imagen de alineación de Biwenger (1080×1080): solo el campo y los 4 suplentes.
const LINEUP_IMG=1080;
const FIELD_CROP={x:205,y:285,w:670,h:587};
const BENCH_CROPS=[['PT',{x:0,y:315,w:172,h:153}],['DF',{x:908,y:315,w:172,h:153}],['MC',{x:0,y:485,w:172,h:151}],['DL',{x:908,y:485,w:172,h:151}]];
const crop=(src,{x,y,w,h},cls,alt='')=>`<div class="crop ${cls}" style="aspect-ratio:${w}/${h}"><img src="${src}" alt="${esc(alt)}" loading="lazy" style="width:${LINEUP_IMG/w*100}%;left:${-x/w*100}%;top:${-y/h*100}%"></div>`;
const roundUrl=(n,playerId,view)=>`/${currentId}?tab=${currentTab==='jornadas'||/^fase\d$/.test(currentTab)?currentTab:'jornadas'}&jornada=${n}${playerId?`&jugador=${playerId}`:''}${view?'&vista=alineacion':''}`;
function lineupPane(c,round,ranks,selected) {
  const withLineup=ranks.filter(r=>round.lineups.includes(r.id)),i=withLineup.indexOf(selected);
  const prev=withLineup[i-1],next=withLineup[i+1];
  const src=assetUrl(`/api/lineups/${currentId}/${roundKey(round)}/${selected.id}`);
  gallery={title:roundLabel(round),items:withLineup.map(r=>({name:r.name,rank:r.rank,points:r.points,src:assetUrl(`/api/lineups/${currentId}/${roundKey(round)}/${r.id}`)}))};
  const nav=(r,dir,label)=>r?`<a class="icon-btn ${dir}" data-route data-keep data-${dir} href="${roundUrl(roundKey(round),r.id,true)}" aria-label="${label}: ${esc(r.name)}">${icon(dir==='prev'?'chevron-left':'chevron-right',20)}</a>`:`<span class="icon-btn disabled ${dir}" aria-hidden="true">${icon(dir==='prev'?'chevron-left':'chevron-right',20)}</span>`;
  return `<section class="panel lineup-pane" aria-label="Alineación de ${esc(selected.name)}"><div class="lineup-top"><div class="lineup-head">${nav(prev,'prev','Anterior')}<div class="lineup-title"><strong>${esc(selected.name)}</strong></div>${nav(next,'next','Siguiente')}</div><dl class="lineup-facts"><div><dt>Puesto</dt><dd>${selected.rank}.º</dd></div><div><dt>Puntos</dt><dd data-count="${selected.points}">${num(selected.points)}</dd></div><div><dt>Jornada</dt><dd>${round.number}${round.postponed?'a':''}</dd></div></dl></div>${round.fields?.includes(selected.id)?`<div data-field="${esc(`/api/lineups/${currentId}/${roundKey(round)}/${selected.id}`)}"></div>`:`<button type="button" class="field-link" data-gallery="${i}" aria-haspopup="dialog" aria-label="Ver la alineación completa de ${esc(selected.name)}" title="Ver imagen completa">${crop(src,FIELD_CROP,'field','')}<span class="field-zoom" aria-hidden="true">${icon('maximize-2',16)}</span></button><h3 class="bench-title">Suplentes</h3>${round.noBench?.includes(selected.id)?'<p class="no-bench">Sin suplentes en esta jornada.</p>':`<div class="bench">${BENCH_CROPS.map(([pos,box])=>crop(src,box,`bench-slot pos-${pos}`)).join('')}</div>`}`}</section>`;
}
// Desplegable propio (patrón listbox de WAI-ARIA): sustituye al <select> nativo para controlar su aspecto en todos los navegadores.
// options: [{value, label, note?, selected?}]. Al elegir una opción se navega a su `value` (una URL).
function dropdown({id,label,options}) {
  const current=options.find(o=>o.selected)||options[0];
  return `<div class="dropdown" data-dropdown><button type="button" class="dd-trigger" id="${id}" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(label)}: ${esc(current.label)}"><span class="dd-value">${esc(current.label)}</span>${current.note?`<span class="dd-note">${esc(current.note)}</span>`:''}${icon('chevron-down',18,'dd-chevron')}</button><ul class="dd-menu" role="listbox" tabindex="-1" aria-label="${esc(label)}" hidden>${options.map((o,i)=>`<li role="option" id="${id}-o${i}" data-value="${esc(o.value)}" aria-selected="${o===current}"><span class="dd-label">${esc(o.label)}</span>${o.note?`<span class="dd-note">${esc(o.note)}</span>`:''}${icon('check',16,'dd-check')}</li>`).join('')}</ul></div>`;
}
// Visor de imágenes (diálogo modal nativo): ver la alineación completa y recorrer las de la jornada con flechas, teclado o deslizando.
let galleryIndex=0,galleryOpener=null,touchX=null;
function galleryDialog() {
  let dlg=$('#gallery');if(dlg)return dlg;
  dlg=document.createElement('dialog');dlg.id='gallery';dlg.className='gallery';dlg.setAttribute('aria-label','Alineación completa');
  dlg.innerHTML=`<div class="gallery-bar"><div class="gallery-title"><strong></strong><small></small></div><button type="button" class="gallery-btn" data-close aria-label="Cerrar">${icon('x',22)}</button></div><div class="gallery-stage"><button type="button" class="gallery-btn gallery-nav prev" data-step="-1" aria-label="Alineación anterior">${icon('chevron-left',26)}</button><img alt=""><button type="button" class="gallery-btn gallery-nav next" data-step="1" aria-label="Alineación siguiente">${icon('chevron-right',26)}</button></div><p class="gallery-count" aria-live="polite"></p>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click',e=>{if(!e.target.closest('img,button,.gallery-title'))dlg.close();const step=e.target.closest('[data-step]');if(step)galleryShow(galleryIndex+Number(step.dataset.step));if(e.target.closest('[data-close]'))dlg.close();});
  dlg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();galleryShow(galleryIndex+(e.key==='ArrowRight'?1:-1));}});
  dlg.addEventListener('touchstart',e=>{touchX=e.touches[0].clientX;},{passive:true});
  dlg.addEventListener('touchend',e=>{if(touchX===null)return;const dx=e.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(dx)>50)galleryShow(galleryIndex+(dx<0?1:-1));});
  dlg.addEventListener('close',()=>{document.documentElement.classList.remove('gallery-open');galleryOpener?.focus({preventScroll:true});});
  return dlg;
}
function galleryShow(i) {
  const items=gallery.items;if(!items.length)return;
  galleryIndex=(i+items.length)%items.length;
  const dlg=galleryDialog(),it=items[galleryIndex],img=$('img',dlg);
  dlg.classList.add('loading');img.onload=img.onerror=()=>dlg.classList.remove('loading');
  img.src=it.src;img.alt=`Alineación de ${it.name} en la ${gallery.title.toLowerCase()}`;
  $('.gallery-title strong',dlg).textContent=it.name;$('.gallery-title small',dlg).textContent=`${gallery.title} · ${it.rank}.º · ${num(it.points)} pts`;
  $('.gallery-count',dlg).textContent=`${galleryIndex+1} de ${items.length}`;
  $$('.gallery-nav',dlg).forEach(b=>b.hidden=items.length<2);
  for(const k of [1,-1]){const n=items[(galleryIndex+k+items.length)%items.length];if(n)new Image().src=n.src;}   // precarga las vecinas
}
function galleryOpen(i,opener) {
  const dlg=galleryDialog();galleryOpener=opener;galleryShow(i);
  document.documentElement.classList.add('gallery-open');if(!dlg.open)dlg.showModal();
}
const gameDate=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
// Partidos que faltan por jugar de una jornada incompleta: en la etiqueta «Partidos pendientes» se apilan sus escudos (solapados, en una sola línea)
// y el detalle sale en su globo (al pasar el ratón, enfocar o pulsar), así la sección no crece aunque haya varios.
const crestImg=(t,size)=>t.eq?`<img src="${withBase(`/assets/escudos/${esc(t.eq)}.png`)}" alt="" width="${size}" height="${size}" onerror="this.remove()">`:'';
const gameWhen=g=>g.estado==='aplazado'?'Aplazado':g.fecha?gameDate.format(new Date(g.fecha*1000)).replace(/\./g,''):'';
function pendingStack(round) {
  if(!round.incomplete||!round.pending?.length)return '';
  const teams=[...new Map(round.pending.flatMap(g=>[g.local,g.visitante]).filter(t=>t.eq).map(t=>[t.eq,t])).values()],shown=teams.slice(0,4),more=teams.length-shown.length;
  return `<span class="pg-stack" aria-hidden="true">${shown.map(t=>crestImg(t,18)).join('')}${more>0?`<b>+${more}</b>`:''}</span>`;
}
function pendingList(round) {
  if(!round.incomplete||!round.pending?.length)return '';
  return `<span class="pg-head">Faltan por jugar</span><ul class="pg-list" aria-label="Partidos que faltan por jugar">${round.pending.map(g=>`<li>${crestImg(g.local,18)}${crestImg(g.visitante,18)}<span class="pg-teams">${esc(g.local.n)} – ${esc(g.visitante.n)}</span><span class="pg-when">${esc(gameWhen(g))}</span></li>`).join('')}</ul>`;
}
function roundSelect(c,round) {
  const asc=chronological(c.rounds),i=asc.findIndex(r=>roundKey(r)===roundKey(round));
  const keep=[null,preferredView==='lineup'];   // al cambiar de jornada se mantiene la vista; el participante pasa a ser el primero
  const label=r=>roundLabel(r)+(r.incomplete&&!r.postponed?' · pendiente':'');
  const step=(r,dir,text)=>r?`<a class="round-step" data-route href="${roundUrl(roundKey(r),...keep)}" aria-label="${text}: ${esc(label(r))}" title="${text}">${icon(dir==='prev'?'chevron-left':'chevron-right',20)}</a>`:`<span class="round-step disabled" aria-hidden="true">${icon(dir==='prev'?'chevron-left':'chevron-right',20)}</span>`;
  const menu=dropdown({id:'round-dd',label:'Jornada',options:[...asc].reverse().map(r=>({value:roundUrl(roundKey(r),...keep),label:label(r),selected:roundKey(r)===roundKey(round)}))});
  return `${step(asc[i-1],'prev','Jornada anterior')}${menu}${step(asc[i+1],'next','Jornada siguiente')}`;
}
function roundsView(c) {
  if(!c.rounds.length)return `<div class="panel">${empty('Cada jornada cuenta','Las jornadas aparecerán aquí en cuanto se publiquen sus resultados.','calendar')}</div>`;
  const round={lineups:[],noBench:[],...(c.rounds.find(r=>roundKey(r)===currentRound)||chronological(c.rounds).at(-1))};
  const ranks=standings(c,[round]).filter(r=>round.scores.some(x=>x.playerId===r.id));
  // En un empate por abajo, el último de la jornada (el que decide la fianza) va el último de la tabla, no donde le toque por nombre.
  const lastAt=round.incomplete?-1:ranks.findIndex(r=>r.id===round.lastPlayerId);
  if(lastAt>=0){const [last]=ranks.splice(lastAt,1);ranks.splice(ranks.findLastIndex(r=>r.points===last.points)+1,0,last);}
  const hasLineups=ranks.some(r=>round.lineups.includes(r.id));
  const selected=hasLineups?(ranks.find(r=>r.id===currentPlayer&&round.lineups.includes(r.id))||ranks.find(r=>round.lineups.includes(r.id))):null;
  const view=selected&&currentView==='lineup'?'lineup':'list';
  if(selected)preferredView=view;
  const tabs=selected?`<div class="view-tabs" role="tablist" aria-label="Vista de la jornada"><a role="tab" data-route data-keep href="${roundUrl(roundKey(round))}" class="${view==='list'?'active':''}" aria-selected="${view==='list'}">${icon('list-ordered',16)}Tabla</a><a role="tab" data-route data-keep href="${roundUrl(roundKey(round),selected.id,true)}" class="${view==='lineup'?'active':''}" aria-selected="${view==='lineup'}">${icon('users',16)}Alineaciones</a></div>`:'';
  // Una sola etiqueta de estado: pendientes de partidos, o cierre de una jornada aplazada ya disputada entera.
  const state=round.incomplete?'pending':round.postponed?'final':'';
  const reprogrammed=round.pending?.some(g=>g.estado==='pendiente');   // con fecha nueva: los titulares de esos partidos no se sustituyen hasta que se jueguen
  const hint={pending:`Faltan partidos por jugar de esta jornada. Los puntos de cada participante ya suman a la clasificación, pero el mejor y el último de la jornada, la fianza y los récords no se deciden hasta que termine el último partido.${reprogrammed?' Un suplente no sustituye a un titular cuyo partido pendiente aún no se ha jugado: el cambio se hace cuando se dispute. Si el titular ya jugó su partido y no participó, el cambio se hace ya.':''}`,final:'Todos los partidos disputados. En la clasificación general solo suma lo que añade a lo ya contado.'}[state];
  const badge=state?`<span class="status-wrap"><button type="button" class="status-badge is-${state}" aria-expanded="false" aria-haspopup="true" aria-controls="round-hint" title="Ver detalle">${icon(state==='final'?'check':'clock',14)}${state==='final'?'Clasificación final':'Partidos pendientes'}${state==='pending'?pendingStack(round):''}${icon('chevron-down',14,'status-chev')}</button><span class="status-hint" id="round-hint" role="tooltip">${state==='pending'?pendingList(round):''}${hint}</span></span>`:'';
  return `<div class="round-toolbar"><div class="round-pick">${roundSelect(c,round)}${badge}</div></div>${tabs?`<div class="view-tabs-bar">${tabs}</div>`:''}<div class="round-split ${selected?'with-lineup':''}" data-view="${view}"><section class="panel ranking-pane">${rankRows(ranks,{href:selected?r=>round.lineups.includes(r.id)?roundUrl(roundKey(round),r.id,true):null:null,activeId:selected?.id,mark:r=>round.incomplete?null:r.id===round.lastPlayerId?'last':r.rank===1?'first':null})}</section>${selected?lineupPane(c,round,ranks,selected):''}</div>`;
}
// Pie de página: sin enlaces ni datos, solo el nombre y el número de participantes (la temporada ya va en la cabecera).
function renderFooter() {
  const footer=document.querySelector('.footer');if(!footer||!state)return;
  const seen=new Set();for(const id of ['mahtuliga','mahtwoliga'])for(const p of state.competitions[id]?.players||[])seen.add(normalize(p.name));
  footer.innerHTML=`<p>Mahtuersos Fantasy · ${seen.size} participantes</p>`;
}
// ---- Microinteracciones ----------------------------------------------------------------
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
// Los números de la alineación suben hasta su valor, siempre en enteros (en Biwenger no hay decimales).
function countUp(el) {
  const to=Number(el.dataset.count);if(!Number.isFinite(to)||calm())return;
  const t0=performance.now(),dur=600;el.textContent='0';
  const step=now=>{const k=Math.min(1,(now-t0)/dur);el.textContent=num(k<1?Math.round(to*(1-Math.pow(1-k,3))):to);if(k<1&&el.isConnected)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
// Indicador que se desliza hasta la pestaña activa. La página se vuelve a pintar entera al cambiar, así que se recuerda dónde estaba el anterior
// y el nuevo arranca desde ahí.
const sliderMemory={};
function slider(container,key,animate=true) {
  if(!container||!container.offsetWidth)return;
  const active=$('.active',container);if(!active)return;
  let el=$('.slider',container);
  if(!el){el=document.createElement('span');el.className='slider';el.setAttribute('aria-hidden','true');container.appendChild(el);}
  const to={x:active.offsetLeft,w:active.offsetWidth},from=animate&&!calm()&&sliderMemory[key]||to;
  el.style.transition='none';el.style.transform=`translateX(${from.x}px)`;el.style.width=from.w+'px';
  el.getBoundingClientRect();
  el.style.transition='';el.style.transform=`translateX(${to.x}px)`;el.style.width=to.w+'px';
  sliderMemory[key]=to;container.classList.add('has-slider');
}
const placeSliders=animate=>{slider($('.tabs',main),`tabs|${currentId}`,animate);slider($('.view-tabs',main),`view|${currentId}`,animate);};
window.addEventListener('resize',()=>placeSliders(false));
let lastPageKey=null;

// Campo dibujado con los datos de la alineación (si la jornada los tiene; si no, se ve la imagen de Biwenger).
let stopField=null;const fieldCache=new Map();
let lastFieldH=0;
async function mountFields() {
  stopField?.();stopField=null;
  const host=$('[data-field]',main);if(!host)return;
  if(lastFieldH&&main.dataset.enter==='swap')host.style.cssText=`padding:0;aspect-ratio:auto;height:${lastFieldH}px`;   // el hueco conserva el alto del campo anterior (con o sin suplentes) hasta dibujar el nuevo
  const url=lineupDataUrl(host.dataset.field);
  try {
    if(!fieldCache.has(url))fieldCache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}));
    const data=await fieldCache.get(url);
    if(!host.isConnected)return;   // mientras tanto se ha navegado a otra alineación
    host.style.cssText='';
    stopField=mountField(host,data,{crestUrl:eq=>withBase(`/assets/escudos/${eq}.png`)});
    lastFieldH=main.dataset.enter==='swap'?Math.max(lastFieldH,host.offsetHeight):host.offsetHeight;   // en un mismo visor el campo nunca encoge: sin suplentes queda hueco, pero la página no salta
    host.style.minHeight=lastFieldH+'px';
  } catch { fieldCache.delete(url);if(host.isConnected)host.innerHTML='<p class="no-bench">No se ha podido cargar la alineación.</p>'; }
}
function render() {
  renderFooter();
  const season=$('.season-label b');if(season&&state?.season)season.textContent=`${state.season.slice(2,4)}/${state.season.slice(5)}`;   // 2026/27 → 26/27
  document.title=currentId?`${META[currentId].name} · Mahtuersos Fantasy`:'Mahtuersos Fantasy';
  // Entrada de página solo al cambiar de pantalla o pestaña; al pasar de jornada o de participante no se vuelve a animar todo.
  // 'page': otra liga o la portada (entra todo, encabezado incluido) · 'tab': otra pestaña de la misma liga (el encabezado con el logo se queda quieto) · 'swap': otra jornada o participante.
  const pageKey=`${currentId}|${currentTab}`;main.dataset.enter=pageKey===lastPageKey?'swap':lastPageKey?.split('|')[0]===String(currentId)?'tab':'page';lastPageKey=pageKey;
  const keepY=scrollY;   // al pasar de alineación o de jornada la página se vuelve a pintar entera: se conserva la posición (el navegador, si no, la reajusta con saltos)
  const wasStuck=!!$('.tabs-bar.is-stuck');   // pulsar una pestaña vuelve a pintar la página: el nombre de la liga no debe parpadear
  const keepH=main.dataset.enter==='swap'?main.offsetHeight:0;if(keepH)main.style.minHeight=keepH+'px';   // el campo se dibuja un instante después: sin este alto la página se encoge y el navegador recorta el scroll
  main.innerHTML=currentId?competition():home();
  if(wasStuck)$('.tabs-bar')?.classList.add('is-stuck');
  hydrateIcons(main);
  rebase(main);
  mountFields();
  initTabs();
  placeSliders(true);document.fonts?.ready.then(()=>placeSliders(false));
  $$('[data-count]',main).forEach(countUp);
  if(main.dataset.enter==='swap'&&scrollY!==keepY)window.scrollTo({top:keepY,behavior:'instant'});
  if(keepH)setTimeout(()=>{main.style.minHeight='';},900);
  initRulesSearch();recCurrent=null;fitAllChips();document.fonts?.ready.then(fitAllChips);markRecord(true);
  document.body.dataset.theme=currentId==='mahtuchampions'?'champions':currentId?'':'home';
  document.querySelector('meta[name=theme-color]').content=currentId==='mahtuchampions'?'#04011f':currentId?'#1b2433':'#0b1020';
  $$('[data-nav]').forEach(a=>{const active=a.dataset.nav===(currentId||'inicio');a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
document.addEventListener('click',e=>{
  const gal=e.target.closest('[data-gallery]');if(gal){galleryOpen(Number(gal.dataset.gallery),gal);return;}
  const link=e.target.closest('a[data-route]');
  if(link&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&e.button===0){e.preventDefault();navigate(link.getAttribute('href'),link.hasAttribute('data-prev')||link.hasAttribute('data-next'));}   // las flechas de la alineación no mueven la página
});
document.addEventListener('click',e=>{
  const open=document.querySelector('.status-wrap.open'),btn=e.target.closest('.status-badge');
  if(open&&(!btn||!open.contains(btn))){open.classList.remove('open');open.querySelector('.status-badge').setAttribute('aria-expanded','false');}
  if(btn){const wrap=btn.closest('.status-wrap'),on=!wrap.classList.contains('open');wrap.classList.toggle('open',on);btn.setAttribute('aria-expanded',String(on));}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.status-wrap.open')?.querySelector('.status-badge')?.click();});
// Comportamiento de los desplegables: ratón, teclado (↑ ↓ Inicio Fin Intro Espacio Esc, letra inicial) y cierre al pulsar fuera.
function ddOpen(dd,focusIndex) {
  const trigger=$('.dd-trigger',dd),menu=$('.dd-menu',dd),items=$$('[role=option]',menu);
  menu.hidden=false;trigger.setAttribute('aria-expanded','true');dd.classList.add('open');
  const r=trigger.getBoundingClientRect(),room=innerHeight-r.bottom-(matchMedia('(max-width:760px)').matches?72:12);
  dd.classList.toggle('up',room<Math.min(menu.scrollHeight,300)&&r.top>room);
  ddActive(dd,focusIndex??Math.max(0,items.findIndex(o=>o.getAttribute('aria-selected')==='true')));
}
function ddClose(dd,restoreFocus=false) {
  const menu=$('.dd-menu',dd);if(menu.hidden)return;
  menu.hidden=true;dd.classList.remove('open','up');$('.dd-trigger',dd).setAttribute('aria-expanded','false');menu.removeAttribute('aria-activedescendant');
  if(restoreFocus)$('.dd-trigger',dd).focus();
}
function ddActive(dd,i) {
  const menu=$('.dd-menu',dd),items=$$('[role=option]',menu);if(!items.length)return;
  i=(i+items.length)%items.length;items.forEach((o,k)=>o.classList.toggle('active',k===i));
  menu.setAttribute('aria-activedescendant',items[i].id);items[i].scrollIntoView({block:'nearest'});
}
function ddChoose(dd,item) {
  ddClose(dd,true);
  if(item.getAttribute('aria-selected')!=='true')navigate(item.dataset.value);
}
document.addEventListener('click',e=>{
  const open=$('.dropdown.open'),trigger=e.target.closest('.dd-trigger'),item=e.target.closest('.dd-menu [role=option]');
  if(open&&!open.contains(e.target))ddClose(open);
  if(item)ddChoose(item.closest('.dropdown'),item);
  else if(trigger){const dd=trigger.closest('.dropdown');dd.classList.contains('open')?ddClose(dd):ddOpen(dd);}
});
document.addEventListener('keydown',e=>{
  const dd=e.target.closest?.('.dropdown');if(!dd||e.altKey||e.ctrlKey||e.metaKey)return;
  const menu=$('.dd-menu',dd),items=$$('[role=option]',menu),open=!menu.hidden,cur=items.findIndex(o=>o.classList.contains('active'));
  if(!open){if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();ddOpen(dd);}return;}
  const step={ArrowDown:cur+1,ArrowUp:cur-1,Home:0,End:items.length-1}[e.key];
  if(step!==undefined){e.preventDefault();e.stopPropagation();ddActive(dd,step);}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(items[cur])ddChoose(dd,items[cur]);}
  else if(e.key==='Escape'||e.key==='Tab'){if(e.key==='Escape')e.preventDefault();ddClose(dd,e.key==='Escape');}
  else if(e.key.length===1){const k=fold(e.key),from=items.findIndex((o,i)=>i>cur&&fold(o.textContent.trim())[0]===k),any=items.findIndex(o=>fold(o.textContent.trim())[0]===k);const t=from>=0?from:any;if(t>=0)ddActive(dd,t);}
},true);
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const l=document.querySelector(e.key==='ArrowLeft'?'[data-prev]':e.key==='ArrowRight'?'[data-next]':'#none');if(l)navigate(l.getAttribute('href'),true);});
window.addEventListener('popstate',()=>{rulesQuery='';rulesActive=null;getRoute();render();window.scrollTo({top:0});});
window.addEventListener('online',()=>notify('Conexión recuperada.'));
window.addEventListener('offline',()=>notify('Sin conexión. Las publicaciones necesitan conexión al servidor.'));
async function refresh() {
  if(document.hidden||!state)return;
  try {const fresh=await api('/api/state');if(fresh.revision!==state.revision||fresh.updatedAt!==state.updatedAt||JSON.stringify(fresh.competitions)!==JSON.stringify(state.competitions)){state=fresh;render();}} catch{/* Keep the last successful view. */}
}
hydrateIcons(document.querySelector('.topbar'));hydrateIcons(document.querySelector('.footer'));
try {
  [state,rules]=await Promise.all([api('/api/state'),api('/rules.json')]);
  photos=await api('/avatares.json').catch(()=>({}));
  getRoute();render();setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
} catch(e) {
  main.innerHTML=`<div class="page"><div class="loading"><h1>No se puede cargar la temporada</h1><p>Comprueba que el servidor está en marcha y vuelve a intentarlo.</p><button class="button" id="retry">Reintentar</button></div></div>`;$('#retry').onclick=()=>location.reload();
}
