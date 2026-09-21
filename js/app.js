/* The AI Line: app logic.
   Lessons live in content/ as JSON. See CONTRIBUTING.md.
   Data is loaded at start. The single-file build sets window.AILINE_DATA instead. */
let LINES=[],MODS=[],levelFilter='all';

function normalize(s){
  return {
    id:s.id,lvl:s.line,level:s.level,st:s.shortTitle||s.title,title:s.title,hook:s.hook,plain:s.inPlainWords,
    uc:{t:s.useCase.title,s:s.useCase.story},
    ap:s.approaches.map(a=>({n:a.name,w:a.what,g:a.greatWhen,a:a.avoidWhen,e:a.example})),
    ch:{q:s.challenge.question,o:s.challenge.options.map(o=>({t:o.text,v:o.verdict,y:o.why}))},
    best:{t:s.bestCase.title,e:s.bestCase.example},
    worst:{t:s.worstCase.title,e:s.worstCase.example},
    arch:{item:s.route.travelling,lanes:s.route.lanes.map(l=>({n:l.name||'',s:l.steps.map(x=>({l:x.label,g:x.goes,b:x.goesWrong}))}))},
    key:s.takeaway
  };
}
function buildData(lines,order,stops){
  LINES=lines.map((l,i)=>({n:l.name,c:'var(--l'+((i%7)+1)+')',rank:l.rank}));
  const by={};stops.forEach(s=>{by[s.id]=s});
  MODS=order.map(id=>normalize(by[id]));
}
async function loadData(){
  if(window.AILINE_DATA){const d=window.AILINE_DATA;buildData(d.lines,d.order,d.stops);return}
  const get=async u=>{const r=await fetch(u);if(!r.ok)throw new Error('Could not load '+u+' ('+r.status+')');return r.json()};
  const [lines,order]=await Promise.all([get('content/lines.json'),get('content/order.json')]);
  const stops=await Promise.all(order.map(id=>get('content/stops/'+id+'.json')));
  buildData(lines,order,stops);
}

/* ---------- storage and state ---------- */
const KEY='ailine:v1';
function load(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
function save(){try{localStorage.setItem(KEY,JSON.stringify({answers:S.answers,streak:S.streak,last:S.last,theme:S.theme}))}catch(e){}}
const S=Object.assign({answers:{},streak:0,last:'',theme:''},load());
const XP={best:20,ok:10,poor:5};
const VT={best:['Best pick','\u2714'],ok:['Works, but not ideal','~'],poor:['Risky choice','\u2716']};
const viewPick={};

function dayStr(d){try{return d.toLocaleDateString('en-CA')}catch(e){return d.toISOString().slice(0,10)}}
(function streak(){
  const t=dayStr(new Date()), y=dayStr(new Date(Date.now()-864e5));
  if(S.last!==t){S.streak=(S.last===y)?(S.streak||0)+1:1;S.last=t;save();}
})();

function applyTheme(){
  const r=document.documentElement;
  if(S.theme==='light'||S.theme==='dark') r.setAttribute('data-theme',S.theme); else r.removeAttribute('data-theme');
}
applyTheme();

const $=(s,el)=>(el||document).querySelector(s);
const $$=(s,el)=>Array.from((el||document).querySelectorAll(s));
const view=$('#view');
let timer=null, player=null;

function points(){return Object.values(S.answers).reduce((a,b)=>a+(b.xp||0),0)}
function done(){return Object.keys(S.answers).length}
function rank(){let r='Curious rider',ok=true;LINES.forEach((L,i)=>{const ms=MODS.filter(m=>m.lvl===i+1);ok=ok&&ms.length>0&&ms.every(m=>S.answers[m.id]);if(ok&&L.rank)r=L.rank});return r}
function has(id){return MODS.some(m=>m.id===id)}
function href(id){return has(id)?'#/stop/'+id:'#/map'}
function lnk(id,fb){return has(id)?`<a href="#/stop/${id}">stop ${sn(id)}</a>`:fb}
function sn(id){return MODS.findIndex(m=>m.id===id)+1}
function updateStats(){$('#pts').textContent=points();$('#dn').textContent=done();$('#tot').textContent=MODS.length;$('#dn').parentNode.title='Rank: '+rank()}
function nextIdx(){const i=MODS.findIndex(m=>!S.answers[m.id]);return i<0?-1:i}
function col(m){return LINES[m.lvl-1].c}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

/* ---------- routing ---------- */
function route(){
  clearInterval(timer);timer=null;player=null;
  const h=location.hash||'#/map';
  const parts=h.replace(/^#\//,'').split('/');
  const p=parts[0];
  $$('#nav a').forEach(a=>{if(a.dataset.nav===(p==='stop'?'map':p))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(p==='stop') renderStop(parts[1]);
  else if(p==='picture') renderPicture();
  else if(p==='lab') renderLab();
  else renderMap();
  updateStats();
  window.scrollTo(0,0);
  const mn=$('#main');if(mn)mn.focus({preventScroll:true});
}
window.addEventListener('hashchange',route);

/* ---------- map ---------- */
function wrapText(t,max){
  const w=t.split(' '),lines=[];let cur='';
  w.forEach(x=>{if((cur+' '+x).trim().length>max&&cur){lines.push(cur);cur=x}else cur=(cur+' '+x).trim()});
  if(cur)lines.push(cur);return lines;
}
function mapSVG(){
  const cols=(view.clientWidth||900)>=700?4:2;
  const colW=cols===4?210:165,rowH=cols===4?150:140,padX=colW/2+10,padY=44;
  const rows=Math.ceil(MODS.length/cols);
  const W=padX*2+(cols-1)*colW,H=padY+(rows-1)*rowH+96;
  const pos=MODS.map((m,i)=>{const r=Math.floor(i/cols),c=i%cols;return{x:padX+(r%2===0?c:cols-1-c)*colW,y:padY+r*rowH,r}});
  const nxt=nextIdx();
  let segs='',sts='';
  for(let i=1;i<MODS.length;i++){
    const a=pos[i-1],b=pos[i],c=col(MODS[i]);
    const op=S.answers[MODS[i].id]?1:.35;
    let d;
    if(a.y===b.y) d=`M${a.x} ${a.y}L${b.x} ${b.y}`;
    else{const bul=(a.r%2===0?1:-1)*46;d=`M${a.x} ${a.y}C${a.x+bul} ${a.y},${b.x+bul} ${b.y},${b.x} ${b.y}`}
    segs+=`<path d="${d}" fill="none" style="stroke:${c};opacity:${op}" stroke-width="10" stroke-linecap="round"/>`;
  }
  MODS.forEach((m,i)=>{
    const p=pos[i],c=col(m),dn=!!S.answers[m.id],dim=levelFilter!=='all'&&m.level!==levelFilter;
    const lines=wrapText(m.st,cols===4?22:17).slice(0,3);
    const txt=lines.map((t,k)=>`<tspan x="${p.x}" dy="${k?17:0}">${esc(t)}</tspan>`).join('');
    sts+=`<a href="#/stop/${m.id}" style="opacity:${dim?.28:1}" aria-label="Stop ${i+1}: ${esc(m.title)}, ${m.level}${dn?' (done)':''}">
      ${i===nxt?`<circle class="pulse" cx="${p.x}" cy="${p.y}" r="22" fill="none" style="stroke:${c}" stroke-width="3"/>`:''}
      <circle class="ring" cx="${p.x}" cy="${p.y}" r="17" style="fill:${dn?c:'var(--surface)'};stroke:${c}" stroke-width="6"/>
      <text class="st-num" x="${p.x}" y="${p.y+5}" text-anchor="middle" style="fill:${dn?'#fff':'var(--ink)'}">${dn?'\u2713':i+1}</text>
      <text class="st-label" x="${p.x}" y="${p.y+40}" text-anchor="middle">${txt}</text></a>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Map of ${MODS.length} learning stops">${segs}${sts}</svg>`;
}
const LEVELS=[['all','All levels'],['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Advanced']];
const DOTS={beginner:'\u25CF\u25CB\u25CB',intermediate:'\u25CF\u25CF\u25CB',advanced:'\u25CF\u25CF\u25CF'};
const LEVEL_NOTE={
  all:'Beginner stops need no background. Intermediate stops assume the basics. Advanced stops are about building, running and testing real systems.',
  beginner:'Beginner: no background needed. Ride these first to get the whole picture in plain words.',
  intermediate:'Intermediate: you know the basics and want to choose between real options.',
  advanced:'Advanced: building, testing and running real systems. Dimmed stops are other levels.'
};
function levelCount(k){return k==='all'?MODS.length:MODS.filter(m=>m.level===k).length}
function levelButtons(){return LEVELS.map(l=>`<button type="button" class="fbtn" data-lv="${l[0]}" aria-pressed="${levelFilter===l[0]}">${l[1]} <b>${levelCount(l[0])}</b></button>`).join('')}
function levelNote(){return esc(LEVEL_NOTE[levelFilter])}
function renderMap(){
  const n=nextIdx(),d=done();
  const nm=n<0?null:MODS[n];
  const legend=LINES.map((L,i)=>{const ms=MODS.filter(m=>m.lvl===i+1);const c=ms.filter(m=>S.answers[m.id]).length;
    return `<span class="chip"><i style="background:${L.c}"></i>${L.n} <b>${c}/${ms.length}</b></span>`}).join('');
  view.innerHTML=`
  <section class="hero">
    <div>
      <h1>Learn AI, machine learning and deep learning by solving one store's real problems.</h1>
      <p>${MODS.length} stops on one line, each tagged beginner, intermediate or advanced: the basics, data, classic AI, machine learning, deep learning, language models, RAG, agents, and running it safely. Every stop starts with a problem at an online shop called ShopEase, lays out every way to solve it, and shows the best and the worst outcome. No math, and every architecture is a short route you can ride.</p>
    </div>
    <div class="next">
      ${nm?`<h2>${d?'Next stop':'Start here'}: ${esc(nm.st)}</h2><p>${esc(nm.hook)}</p><a class="btn" href="#/stop/${nm.id}">${d?'Continue the ride':'Board at stop 1'}</a>`
          :`<h2>You reached the end of the line</h2><p>All ${MODS.length} stops are done. Try the design lab to plan a real assistant, or replay any stop.</p><a class="btn" href="#/lab">Open the design lab</a>`}
    </div>
  </section>
  <div class="legend" aria-label="Lines">${legend}</div>
  <div class="filters" id="lvlf" role="group" aria-label="Show stops by level">
    <span class="small">Show:</span>${levelButtons()}
  </div>
  <p class="small lvlnote" id="lvlnote">${levelNote()}</p>
  <div class="mapbox" id="mapbox">${mapSVG()}</div>
  <p class="small foot">Progress is saved in this browser only. The ideas here are stable concepts, not product names. Tools and prices change, so check current documentation before you build.</p>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('.fbtn');if(!b)return;
  levelFilter=b.dataset.lv;
  $$('.fbtn').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.lv===levelFilter)));
  const mb=$('#mapbox');if(mb)mb.innerHTML=mapSVG();
  const nt=$('#lvlnote');if(nt)nt.textContent=LEVEL_NOTE[levelFilter];
});
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{const b=$('#mapbox');if(b&&location.hash.replace(/^#\/?/,'').split('/')[0].match(/^(map)?$/))b.innerHTML=mapSVG()},150)});

/* ---------- stop page ---------- */
function verdictHTML(m){
  const a=S.answers[m.id],pick=viewPick[m.id]!==undefined?viewPick[m.id]:(a?a.pick:undefined);
  const asked=pick!==undefined;
  const opts=m.ch.o.map((o,k)=>{
    const cls=asked?` v-${o.v}${k===pick?' mine':''}`:'';
    const vt=VT[o.v];
    return `<button type="button" class="opt${cls}" data-k="${k}"${asked&&k===pick?' aria-pressed="true"':''}>${esc(o.t)}<span class="vt"><b>${vt[1]} ${vt[0]}${k===pick?' (your pick)':''}.</b> ${esc(o.y)}</span></button>`;
  }).join('');
  const res=a?`<p class="res">${a.xp===20?'You picked the best option.':'Check the best pick above.'} You earned ${a.xp} points at this stop.</p>`:'';
  return `<div class="ask${asked?' asked':''}"><p class="q">${esc(m.ch.q)}</p><div class="opts">${opts}</div>${res}</div>`;
}
function renderStop(id){
  const i=MODS.findIndex(m=>m.id===id);if(i<0){location.hash='#/map';return}
  const m=MODS[i],L=LINES[m.lvl-1],c=L.c;
  const prev=MODS[i-1],next=MODS[i+1];
  const aps=m.ap.map(a=>`<details class="ap"><summary><span class="apn">${esc(a.n)}</span><span class="apw">${esc(a.w)}</span></summary><div class="apd">${a.g?`<p><b>Great when:</b> ${esc(a.g)}</p>`:''}${a.a?`<p><b>Avoid when:</b> ${esc(a.a)}</p>`:''}<p class="ex"><b>Example:</b> ${esc(a.e)}</p></div></details>`).join('');
  view.innerHTML=`
  <div style="--lc:${c};--rc:${c}">
  <div class="crumb"><a href="#/map">Map</a><span class="lc"><i style="background:${c}"></i>${L.n} line, stop ${i+1} of ${MODS.length}</span><span class="lvl" title="Level: ${m.level}">${LEVELS.find(x=>x[0]===m.level)[1]} ${DOTS[m.level]}</span></div>
  <div class="stophead"><h1>${esc(m.title)}</h1><p class="hook">${esc(m.hook)}</p>
  ${m.plain?`<div class="plain"><b>In plain words.</b> ${esc(m.plain)}</div>`:''}</div>

  <section class="sec"><h2>The problem</h2>
    <div class="uc"><h3>${esc(m.uc.t)}</h3><p>${esc(m.uc.s)}</p></div></section>

  <section class="sec"><h2>Every way to solve it</h2>
    <div class="aptools"><button type="button" class="linkbtn" id="apall">Open all</button></div>
    <div class="aplist">${aps}</div></section>

  <section class="sec"><h2>Your move</h2><div id="ch">${verdictHTML(m)}</div></section>

  <section class="sec"><h2>Best case and worst case</h2>
    <div class="bw">
      <div class="good"><h3>\u2714 Best case</h3><p class="t">${esc(m.best.t)}</p><p>${esc(m.best.e)}</p></div>
      <div class="worst"><h3>\u2716 Worst case</h3><p class="t">${esc(m.worst.t)}</p><p>${esc(m.worst.e)}</p></div>
    </div></section>

  <section class="sec"><h2>Ride the architecture</h2>
    <p class="riding">Riding this route: <b>${esc(m.arch.item)}</b></p>
    <div id="pl"></div>
    <div class="btns">
      <button type="button" class="btn go" id="pgood">Play best case</button>
      <button type="button" class="btn bad" id="pbad">Play worst case</button>
      <button type="button" class="btn line" id="pnext">Next step</button>
      <button type="button" class="btn line" id="preset">Reset</button>
    </div></section>

  <section class="sec"><h2>Remember this</h2><div class="key"><p>${esc(m.key)}</p></div></section>

  <div class="pn">
    ${prev?`<a class="btn line" href="#/stop/${prev.id}">Previous: ${esc(prev.st)}</a>`:'<span></span>'}
    ${next?`<a class="btn" href="#/stop/${next.id}">Next: ${esc(next.st)}</a>`:`<a class="btn" href="#/picture">See the big picture</a>`}
  </div></div>`;
  setupPlayer(m);
  $('#apall').addEventListener('click',e=>{const ds=$$('.ap');const anyClosed=ds.some(d=>!d.open);ds.forEach(d=>d.open=anyClosed);e.target.textContent=anyClosed?'Close all':'Open all'});
  $('#ch').addEventListener('click',e=>{
    const b=e.target.closest('.opt');if(!b)return;
    const k=+b.dataset.k,v=m.ch.o[k].v;
    if(!S.answers[m.id]){S.answers[m.id]={pick:k,xp:XP[v]};save();updateStats()}
    viewPick[m.id]=k;
    $('#ch').innerHTML=verdictHTML(m);
  });
}

/* ---------- route player ---------- */
function setupPlayer(m){
  const flat=[];m.arch.lanes.forEach((ln,li)=>ln.s.forEach((s,si)=>flat.push(Object.assign({lane:li,si},s))));
  player={m,flat,mode:'good',idx:-1,fail:flat.findIndex(s=>s.b)};
  drawPlayer();
  $('#pgood').onclick=()=>run('good');
  $('#pbad').onclick=()=>run('bad');
  $('#pnext').onclick=()=>{clearInterval(timer);timer=null;if(player.idx<0)player.mode='good';if(player.idx<flat.length-1)player.idx++;drawPlayer()};
  $('#preset').onclick=()=>{clearInterval(timer);timer=null;player.idx=-1;player.mode='good';drawPlayer()};
}
function run(mode){
  clearInterval(timer);player.mode=mode;player.idx=0;drawPlayer();
  timer=setInterval(()=>{if(player.idx<player.flat.length-1){player.idx++;drawPlayer()}else{clearInterval(timer);timer=null}},1500);
}
function statusOf(i){
  const {mode,idx,fail}=player;
  if(idx<0)return'todo';
  if(mode==='bad'&&fail>=0&&idx>=fail){
    if(i<fail)return'done';
    if(i===fail)return idx===fail?'fail active':'fail';
    if(i<idx)return'tainted';
    if(i===idx)return'tainted active';
    return'todo';
  }
  if(i<idx)return'done';if(i===idx)return'active';return'todo';
}
function drawPlayer(){
  const {m,flat,mode,idx,fail}=player;
  const bad=mode==='bad'&&fail>=0&&idx>=fail;
  let html='';
  m.arch.lanes.forEach((ln,li)=>{
    const stops=flat.map((s,i)=>({s,i})).filter(x=>x.s.lane===li).map(({s,i})=>{
      const st=statusOf(i),cls=st.split(' ').map(x=>'is-'+x).join(' ')+((mode==='bad'&&fail>=0&&idx>=fail&&i>=fail)?' cut':'');
      let sym=i+1;
      if(st.indexOf('fail')>=0)sym='\u2716';
      else if(st.indexOf('tainted')>=0)sym='!';
      else if(st==='done')sym='\u2713';
      else if(st==='active')sym='\uD83D\uDE86';
      return `<button type="button" class="stop ${cls}" data-i="${i}" aria-label="Stop ${i+1}: ${esc(s.l)}"><span class="dot" aria-hidden="true">${sym}</span><span class="slabel">${esc(s.l)}</span></button>`;
    }).join('');
    html+=`<div class="lane">${ln.n?`<div class="lanename">${esc(ln.n)}</div>`:''}<div class="route">${stops}</div></div>`;
  });
  let cap;
  if(idx<0){
    cap=`<h3>Ready to ride</h3><p>Press <b>Play best case</b> or <b>Play worst case</b>, or click any stop, to watch the example travel down the line.</p>`;
  }else{
    const s=flat[idx];let txt,head=`Stop ${idx+1} of ${flat.length}: ${esc(s.l)}`;
    if(mode==='bad'&&fail>=0&&idx>=fail){
      if(idx===fail){txt=s.b;head='Goes wrong at stop '+(idx+1)+': '+esc(s.l)}
      else txt=s.b||'The mistake from stop '+(fail+1)+' travels downstream. Everything from here on is built on a bad input.';
    }else txt=s.g;
    cap=`<h3>${head}</h3><p>${esc(txt)}</p>`;
    if(idx===flat.length-1)cap+=`<p class="out">${bad?'Worst-case outcome: '+esc(m.worst.t):'Best-case outcome: '+esc(m.best.t)}</p>`;
  }
  $('#pl').innerHTML=html+`<div class="cap${bad?' bad':''}" role="status" aria-live="polite">${cap}</div>`;
  $$('#pl .stop').forEach(b=>b.onclick=()=>{clearInterval(timer);timer=null;player.idx=+b.dataset.i;drawPlayer()});
}

/* ---------- big picture ---------- */
function coverageTable(){
  const lv=['beginner','intermediate','advanced'];
  const head='<tr><th scope="col">Line</th>'+lv.map(k=>`<th scope="col">${k[0].toUpperCase()+k.slice(1)}</th>`).join('')+'</tr>';
  const rows=LINES.map((L,i)=>{
    const cells=lv.map(k=>{
      const ms=MODS.map((m,j)=>({m,n:j+1})).filter(x=>x.m.lvl===i+1&&x.m.level===k);
      return '<td>'+(ms.length?ms.map(x=>`<a href="#/stop/${x.m.id}"><b>${x.n}</b> ${esc(x.m.st)}</a>`).join(''):'<span class="small" title="No stops at this level yet">\u2014</span>')+'</td>';
    }).join('');
    return `<tr><th scope="row"><i style="background:${L.c}"></i>${esc(L.n)}</th>${cells}</tr>`;
  }).join('');
  return `<div class="covwrap"><table class="cov"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}
function renderPicture(){
  const rungs=[
   ['One clear prompt','Try this first. It solves more than people expect.','m5',4],
   ['Add examples and a fixed output shape','Climb here when answers are inconsistent or your code cannot read them.','m5',4],
   ['Add RAG','Climb here when the model must know your documents, and they change.','m7',5],
   ['Add tools','Climb here when it needs live data or must take an action.','m9',6],
   ['Make it a workflow','Climb here when the steps are known and should repeat reliably.','m10',6],
   ['Let an agent decide','Climb here only where the steps cannot be predicted.','m10',6],
   ['Split into several agents','Climb here only when one agent demonstrably fails a test you wrote.','m12',6]
  ];
  const lad=rungs.filter(r=>has(r[2])).map((r,i)=>`<li style="--lc:var(--l${r[3]})"><span class="n">${i+1}</span><b>${r[0]}</b><p>${r[1]}</p><a href="#/stop/${r[2]}">Open stop ${sn(r[2])}</a></li>`).join('');
  const layers=[
   ['Agents and workflows','Decide the steps and take actions','m10',6],
   ['Tools and connectors (MCP)','Live data and actions','m9',6],
   ['Knowledge: RAG and memory','Your documents and past cases','m7',5],
   ['Prompts','Instructions, examples, output shape','m5',4],
   ['Language models','Deep networks trained on text','m4',4],
   ['Deep learning','Neural networks for images, sound and text','dl1',3],
   ['Machine learning','Models that learn from tables and history','ml1',2],
   ['Data and databases','Where data lives, classic AI, the basics','db1',1]
  ].filter(l=>has(l[2])).map(l=>`<a class="layer" style="--lc:var(--l${l[3]})" href="#/stop/${l[2]}"><b>${l[0]}</b><span>${l[1]}</span></a>`).join('');
  const rails=[['Guardrails','Filters, limits, approvals','m13'],['Testing and watching','Golden questions, traces','m14'],['Cost and routing','Right-size every call','m15'],['Photos and voice','Other kinds of input','m16']]
    .filter(r=>has(r[2])).map(r=>`<a class="rail" href="#/stop/${r[2]}"><b>${r[0]}</b><span>${r[1]}</span></a>`).join('');
  view.innerHTML=`
  <div class="stophead"><h1>The big picture</h1><p class="hook">How AI, machine learning and deep learning fit together, and how one store's assistant grows into the whole stack.</p></div>
  <section class="sec"><h2>How AI, machine learning and deep learning nest</h2>
    <div class="two"><div class="nest">
      <a href="${href('m1')}">Artificial intelligence</a><p>Any software that acts smart: rules, search, planning, learning.</p>
      <div class="nest n2"><a href="${href('ml1')}">Machine learning</a><p>AI that learns patterns from data. Tables, forecasts, recommendations.</p>
        <div class="nest n3"><a href="${href('dl1')}">Deep learning</a><p>Machine learning with large neural networks. Images, sound, text.</p>
          <div class="nest n4"><a href="${href('m4')}">Language models and generative AI</a><p>Deep networks trained on huge text and images. Chat, writing, code.</p></div>
        </div>
      </div>
    </div>
    <div><div class="uc"><h3>Bigger is not better</h3><p>Each inner circle is a more powerful and more expensive tool. Most business problems are solved in the outer circles. Use the smallest circle that works, and go inward only when a test shows you must.</p></div></div></div></section>
  <section class="sec"><h2>The ladder for language-model systems: add power only when you must</h2>
    <p class="rule">Climb one rung only when the rung below fails a test you wrote.</p>
    <div class="two"><ol class="ladder">${lad}</ol>
    <div><div class="uc"><h3>The side branch: fine-tuning</h3><p>Fine-tuning is not a rung. It changes behavior, such as voice, format or a narrow high-volume skill. It does not keep facts fresh. Reach for it after prompts, RAG and routing have been tried. See ${lnk('dl3','the fine-tuning stop')} and ${lnk('m15','the cost stop')}.</p></div>
    <div class="uc" style="margin-top:14px"><h3>Why the ladder matters</h3><p>Every rung adds cost, delay and new ways to fail. Most problems are solved by rungs one to four. Teams get into trouble when they start at rung seven.</p></div></div></div></section>
  <section class="sec"><h2>The stack: what sits on what</h2>
    <div class="stack"><div class="layers">${layers}</div><div class="rails" aria-label="Concerns that apply to every layer">${rails}</div></div>
    <p class="small" style="margin-top:10px">Dashed boxes apply to every layer, not just one.</p></section>
  <section class="sec"><h2>Coverage map: every stop by line and level</h2>
    <p>Read across a row to go from basics to advanced within one topic. Read down a column to see everything at one level.</p>
    ${coverageTable()}</section>`;
}

/* ---------- design lab ---------- */
const LAB=[
 ['docs','Answers must come from our documents'],
 ['live','It needs live data, like order status or stock'],
 ['act','It takes actions, like refunds or cancellations'],
 ['legacy','It must work with old software that has no API, or write code'],
 ['multi','It combines several data sources into reports'],
 ['mem','It should remember returning customers'],
 ['lang','It tags, extracts, summarizes or translates lots of text'],
 ['photo','Customers send photos or voice notes'],
 ['gen','It writes descriptions or creates images'],
 ['find','Search should match meaning, not only exact words'],
 ['sql','Managers should ask our database questions in plain English'],
 ['pred','It predicts things from past data, like returns, churn or fraud'],
 ['label','We only have a few labeled examples'],
 ['seg','It groups customers or spots unusual events'],
 ['fore','It forecasts demand or traffic over time'],
 ['rec','It recommends products or content'],
 ['cause','We need to know whether something we did caused a result'],
 ['learn','It chooses between options and learns from the results'],
 ['rules','It plans routes or schedules with strict rules'],
 ['explain','Its decisions affect people, so they must be explained and checked for fairness'],
 ['vol','Volume is very high, tens of thousands a day'],
 ['sens','It touches sensitive or personal data'],
 ['public','It faces the public']
];
const lab={docs:true,live:true};
function plan(){
  const p=[];
  const any=(...k)=>k.some(x=>lab[x]);
  p.push(['Start with the basics','Know the four kinds of smart, how a model learns, the ways machines learn, and the shape of an ML pipeline.',['m1','fd1','m3','m2']]);
  p.push(['Pick the problem, then decide build, buy or blend','Score ideas by value and readiness, pilot against today\'s process, measure a business number, and buy the common parts.',['biz1']]);
  p.push(['Decide where the data lives, and how you will get and label it','Keep one source of truth for facts. Add search, memory and analytics stores that point back to it. Write clear label rules and check that labelers agree.',['db1','data1']]);
  p.push(['Set up a light toolbox','Notebooks, a table library, a hosted model API, rented GPUs only if needed, and version control from day one.',['tool1']]);
  if(lab.rules)p.push(['Solvers and rules for known constraints','If the rules are known and must be obeyed, compute the answer. Use learning only for the unknowns that feed it.',['ai1']]);
  if(lab.pred)p.push(['A classic ML model on your table','Name the question type, beat a simple baseline with boosted trees, prepare data after splitting, cut useless columns, tune with a budget, score by the cost of mistakes, and check for overfitting.',['ml1','ml2','ml3','ml12','ml4','ml5','ml11']]);
  if(lab.label)p.push(['Stretch a few labels','Start from a pretrained model, label the most uncertain examples, and never let a model train on its own unchecked guesses.',['ml13','data1']]);
  if(lab.seg)p.push(['Clustering and anomaly detectors','Group with scaled features and human-named segments. Catch rare, changing problems with layered detectors and reviews that create labels.',['ml7','ml8']]);
  if(lab.fore)p.push(['Forecasting with a baseline and ranges','Beat a naive baseline, add calendar and promotion columns, test by predicting the future, and give ranges.',['ml9']]);
  if(lab.rec)p.push(['A hybrid recommender','Popular items and session clues on day one, growing into similar-item and look-alike signals, with business rules on top.',['ml6']]);
  if(lab.cause)p.push(['Fair comparisons for cause and effect','Randomize when you can, use a comparison group when you cannot, and model who really responds.',['ml14']]);
  if(lab.learn)p.push(['A bandit for live choices','Shift traffic toward winners while still exploring. Only consider full reinforcement learning if a bandit fails.',['dl6']]);
  if(lab.explain)p.push(['Explanations and fairness checks','Give reasons for each decision, compare error rates across groups, and keep a human appeal path.',['ml10']]);
  if(any('pred','seg','fore','rec','explain','label'))p.push(['Run models like a product (MLOps)','Automate the pipeline, version everything, roll out in shadow then on a small share, and watch for drift.',['ops1']]);
  if(any('docs','live','act','legacy','multi','mem','gen','sql','lang')||!any('pred','rec','learn','photo','seg','fore','rules','find','explain','label','cause'))p.push(['A hosted language model with a clear prompt','The fastest safe start. Write the role, the steps, the output shape, and what to do when information is missing. Know what tokens and context mean, keep the desk tidy, pick the model with your own tests, and design around AI\'s built-in limits.',['m4','lm4','lm1','m5','lm3','lm2','fd2']]);
  if(lab.lang)p.push(['Right-size the language tasks','Rules for exact patterns, small models for volume, large models for flexibility, and services for translation.',['nlp1']]);
  if(lab.docs)p.push(['RAG: hybrid search, reranking, cited sources','Answers come from your documents, so an update needs no retraining. Chunk by structure, tag with metadata, and debug in pipeline order when an answer is wrong.',['m6','emb1','m7','m8','rag3']]);
  if(lab.find&&!lab.docs)p.push(['Hybrid search over embeddings','Vector search for meaning, keyword search for codes, filters for stock, and one embedding model kept up to date.',['emb1']]);
  if(lab.live)p.push(['Read-only tools for live data','Order status and stock change hourly. Let the model ask and your code answer. Use MCP if many apps share the tools.',['m9']]);
  if(lab.sql)p.push(['Text-to-SQL on safe read-only views','Let people ask in plain English, but only against approved views, with agreed metric definitions, limits and logs.',['db2']]);
  if(lab.act)p.push(['A workflow with approval gates','Fixed steps, an agent only for the messy judgement, a person approving anything above a limit, and tests that check the whole path.',['m10','ag1']]);
  if(lab.legacy)p.push(['Sandboxed screen and code agents','Prefer real APIs. When you must use screens or code, use read-only access, no secrets, logs, and human approval for changes.',['ag2']]);
  if(lab.multi)p.push(['Parallel workflow steps before any agent team','Known sources call for known steps. Run them together and merge. Split into agents only if one agent fails a test.',['m12']]);
  if(lab.mem)p.push(['Memory: recent chat and searchable past cases','Keep short-term chat in the prompt, search older tickets, and let customers view and delete what is saved.',['m11']]);
  if(lab.photo)p.push(['Pretrained vision model, OCR and a confidence gate','Name the exact task. Fine-tune a pretrained network instead of training from scratch, run it where speed demands, use OCR for exact text, and send low-confidence cases to a person.',['dl7','dl1','dl2','dl4','m16']]);
  if(lab.gen)p.push(['Grounded generation with review','Draft only from real source data, check facts automatically, and have a person review a sample. Adapt the model with the cheapest rung that passes your tests.',['dl5','dl3']]);
  if(lab.vol)p.push(['Model routing and caching','Cheap models for easy requests, a big one for hard ones, and never pay twice for the same answer.',['m15']]);
  p.push(['Guardrails, safety, privacy and governance',lab.sens?'Sensitive data means minimizing and masking it, choosing where the model runs, setting retention, and naming an owner. Then add filters, least privilege, approvals and logs.':'Anything that reads outside text or handles people\'s data needs limits on its power, plus clear answers on where data goes and who is accountable.',(any('sens','live','act','sql','legacy')?['m13','gov1']:['gov1']).concat(lab.public?['safe1']:[])]);
  p.push(['Testing and monitoring','A golden question set before every change, then traces and feedback after launch.',['m14']]);
  return p;
}
function drawPlan(){
  const p=plan().map(x=>[x[0],x[1],x[2].filter(has)]).filter(x=>x[2].length);
  $('#plan').innerHTML=`<ol class="plan">${p.map(x=>`<li><b>${esc(x[0])}</b><p>${esc(x[1])}</p>${x[2].map(id=>{const k=MODS.findIndex(m=>m.id===id);return `<a href="#/stop/${id}">Stop ${k+1}: ${esc(MODS[k].st)}</a>`}).join('')}</li>`).join('')}</ol>
  <div class="skip"><b>Not needed yet:</b> fine-tuning, graph RAG and multi-agent teams. Add them only when a test shows the simpler version failing.</div>`;
}
function renderLab(){
  view.innerHTML=`
  <div class="stophead"><h1>Design lab</h1><p class="hook">Describe the AI system you want and get a build order made from the stops you have learned.</p></div>
  <section class="sec"><div class="lab">
    <div><h2>What does it need to do?</h2><div class="toggles" id="tg">
      ${LAB.map(l=>`<label class="tg"><input type="checkbox" data-k="${l[0]}"${lab[l[0]]?' checked':''}><span>${esc(l[1])}</span></label>`).join('')}
    </div></div>
    <div><h2>Build it in this order</h2><div id="plan" aria-live="polite"></div></div>
  </div></section>`;
  $('#tg').addEventListener('change',e=>{const k=e.target.dataset.k;if(k){lab[k]=e.target.checked;drawPlan()}});
  drawPlan();
}

/* ---------- boot ---------- */
$('#theme').addEventListener('click',()=>{
  const dark=S.theme?S.theme==='dark':(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  S.theme=dark?'light':'dark';applyTheme();save();
});
loadData().then(()=>route()).catch(e=>{
  view.innerHTML='<div class="uc"><h3>Could not load the lessons</h3><p>'+esc(e.message)+'. If you opened index.html straight from your computer, start a small local server instead, for example <b>python3 -m http.server 8000</b>, then open http://localhost:8000. Or use the single-file build in dist/.</p></div>';
});
