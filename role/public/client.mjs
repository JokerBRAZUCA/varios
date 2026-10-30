// Rolê no navegador: desenho, controles, telas, chat e rede.
// Online, o servidor manda nas partidas e o navegador prevê só o próprio boneco.
// Sem servidor (ou na prévia), a mesma lógica roda aqui com bots.
import {buildWorld,applyAd,Match,stepPlayer,dash,MODES,W,H,BS,ST,M,FRONT,ROUND_TIME,
  COLORS,OUTDOORS,NAMES,QUICK,QUICK_LEAD,cleanChat,inkOn,rand,clamp,pick,seeded} from './game.mjs';

const $=s=>document.querySelector(s);
const DISPLAY="'Bungee','Arial Black',Impact,sans-serif";
const BODY="'Figtree',system-ui,sans-serif";
const MARKER="'Permanent Marker','Comic Sans MS',cursive";
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STEP=1/30,INTERP=110;
const preview=!/^https?:$/.test(location.protocol)||/(^|\.)claude\.ai$|claudeusercontent/.test(location.hostname);

const world=buildWorld();
applyAd(world,store.get('role_ad'));

/* ================= som ================= */
let AC=null,muted=store.get('role_muted')===true;
function audio(){if(AC||muted)return;try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}
function tone(f1,f2,dur,type='square',vol=.05){
  if(!AC||muted)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f2),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+dur+.02);
}
function boomSnd(){
  if(!AC||muted)return;const t=AC.currentTime,len=AC.sampleRate*.5,buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5);
  const s=AC.createBufferSource(),g=AC.createGain(),fl=AC.createBiquadFilter();fl.type='lowpass';fl.frequency.value=900;
  s.buffer=buf;g.gain.value=.35;s.connect(fl).connect(g).connect(AC.destination);s.start(t);tone(160,40,.4,'sine',.2);
}
const SFX={
  bump:()=>tone(rand(180,240),90,.12,'triangle',.06),
  dash:()=>tone(300,900,.12,'sawtooth',.03),
  knock:()=>{tone(520,120,.25,'square',.05);tone(800,300,.15,'triangle',.04)},
  paint:()=>tone(rand(600,900),rand(1200,1600),.06,'sine',.03),
  pass:()=>tone(440,880,.15,'square',.05),
  score:()=>{tone(660,660,.08,'square',.04);setTimeout(()=>tone(990,990,.12,'square',.04),80)},
  tick:()=>tone(880,880,.05,'square',.03),
  go:()=>tone(520,1040,.3,'square',.06),
};

/* ================= estado ================= */
// mode: null (lobby), 'offline' ou 'online'
let mode=null,me=null,myId=0;
let nick=(store.get('role_nick')||'').slice(0,12),colorIdx=store.get('role_color');if(typeof colorIdx!=='number')colorIdx=0;
const attract=new Match(world,{simFila:true});attract.fillBots();
let match=attract;
const tileFlash=new Float32Array(world.tiles.length);
const net={ws:null,roster:new Map(),snaps:[],offset:null,seq:0,pending:[],acc:0,tiles:new Int32Array(world.tiles.length).fill(-1),
  last:null,board:null,queued:false,objs:new Map(),say:new Map(),dashQ:false,lastChat:-1e9,follow:0,vis:null};
let myResults=null,lastPhaseKey=null,watchers=4,watchT=0;
const input={x:0,y:0};

/* ================= visão (o que desenhar) ================= */
function holderMap(m){
  const map=new Map();
  if(m.phase==='play'&&m.modeKey==='batata'&&m.ms.bombs)for(const b of m.ms.bombs)if(b.holder)map.set(b.holder.id,{fuse:b.fuse,x:b.holder.x,y:b.holder.y});
  return map;
}
function buildView(dt){
  if(mode!=='online'){
    const m=match;
    return{phase:m.phase,phaseT:m.phaseT,timeLeft:m.timeLeft,roundIdx:m.roundIdx,modeKey:m.modeKey,players:m.players,
      tileOwner:m.tileOwner,bombs:holderMap(m),target:m.phase==='play'&&m.modeKey==='corre'?m.ms.target:-1,
      info:id=>m.byId.get(id),sayOf:p=>p.say,follow:null};
  }
  const s=net.last;
  const list=interpolate(dt);
  if(me)list.push(me);
  return{phase:s?s.ph:'idle',phaseT:s?s.pt:0,timeLeft:s?s.tl:0,roundIdx:s?s.ri:0,modeKey:s?s.mk:null,players:list,
    tileOwner:net.tiles,bombs:new Map((s&&s.bo||[]).map(b=>[b[0],{fuse:b[1],x:b[2],y:b[3]}])),target:s?s.tg:-1,
    info:id=>id===myId&&me?me:net.roster.get(id),sayOf:p=>{const q=net.say.get(p.id);return q&&q.t>0?q:null},follow:s&&s.fl};
}
function interpolate(dt){
  const S=net.snaps;if(!S.length)return[];
  const rt=performance.now()+net.offset-INTERP;
  let a=S[S.length-1],b=a;
  for(let i=S.length-1;i>0;i--){if(S[i-1].t<=rt){a=S[i-1];b=S[i];break}}
  const k=b.t>a.t?clamp((rt-a.t)/(b.t-a.t),0,1):1;
  const out=[];
  for(const [id,tb] of b.players){
    const ta=a.players.get(id)||tb,r=net.roster.get(id);if(!r)continue;
    let o=net.objs.get(id);
    if(!o){o={id,r:14,wob:Math.random()*6,spin:0,lookX:0,lookY:1,x:tb[1],y:tb[2]};net.objs.set(id,o)}
    o.name=r.name;o.color=r.color;o.bot=r.bot;
    o.x=ta[1]+(tb[1]-ta[1])*k;o.y=ta[2]+(tb[2]-ta[2])*k;o.vx=tb[3];o.vy=tb[4];
    o.stun=tb[5]&1?1:0;o.dashT=tb[5]&2?1:0;o.arrived=!!(tb[5]&4);
    const ang=tb[6]/100;o.lookX=Math.cos(ang);o.lookY=Math.sin(ang);
    if(o.stun)o.spin+=dt*16;
    o.wob+=dt*10;
    out.push(o);
  }
  return out;
}

/* ================= efeitos ================= */
let parts=[],texts=[],floaters=[],shakeA=0,paintSnd=0;
function part(x,y,vx,vy,color,size,life){if(parts.length<600)parts.push({x,y,vx,vy,color,size,life,max:life})}
function ftext(x,y,text,color,scale=1){texts.push({x,y,text,color,t:0,scale})}
function shake(a){if(!reduceMotion)shakeA=Math.max(shakeA,a)}
let toastT=0;
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.remove('off');toastT=2.4}
const nearMe=(x,y)=>me&&Math.hypot(x-me.x,y-me.y)<450;
let curView=null;
const nameOf=id=>{const p=curView&&curView.info(id);return p?p.name:'alguém'};
const colorOf=id=>{const p=curView&&curView.info(id);return p?p.color:'#c9c3d6'};

function fx(e){
  switch(e.t){
    case 'dash':for(let i=0;i<6;i++)part(e.x-e.dx*10,e.y-e.dy*10,-e.dx*rand(40,120)+rand(-40,40),-e.dy*rand(40,120)+rand(-40,40),'#e9e4f2',rand(3,6),.4);break;
    case 'ft':ftext(e.x,e.y,e.text,e.c);break;
    case 'knock':{
      ftext(e.x,e.y-26,e.text,'#ffd23f');const c=colorOf(e.v);
      for(let i=0;i<10;i++)part(e.x,e.y,rand(-160,160),rand(-160,160),pick(['#fff','#ffd23f',c]),rand(2,5),.5);
      if(e.v===myId||e.a===myId){SFX.knock();shake(6)}
      break;
    }
    case 'bump':if(e.a===myId||e.b===myId)SFX.bump();break;
    case 'bombs':toast(`${e.k} bomba${e.k>1?'s':''} na cidade. Fuja!`);break;
    case 'drop':if(e.id===myId){toast('A bomba caiu na sua mão! Passa pra frente!');SFX.pass()}break;
    case 'pass':
      ftext(e.x,e.y-30,'PEGA!','#ff4f8b');
      if(e.to===myId){SFX.pass();toast('Você pegou a bomba! Passa pra frente!')}
      else if(e.from===myId){SFX.pass();toast(`Passou pra ${nameOf(e.to)}!`)}
      break;
    case 'boom':
      for(let i=0;i<34;i++)part(e.x,e.y,rand(-320,320),rand(-320,320),pick(['#ff8a1f','#ffd23f','#ff4f8b','#3b3b3b']),rand(3,8),.8);
      ftext(e.x,e.y-30,'BUM!','#ff8a1f',1.6);
      if(e.id===myId||nearMe(e.x,e.y)){boomSnd();shake(e.id===myId?16:8);toast(e.id===myId?'BUM! Você explodiu (-8)':`${nameOf(e.id)} explodiu!`)}
      break;
    case 'paint':paintFx(e.i,e.id);break;
    case 'target':toast(`Corre pra ${world.buildings[e.b].loja.name}!`);SFX.go();break;
    case 'arrive':
      if(e.pts)ftext(e.x,e.y-30,`+${e.pts}`,'#ffd23f',1.3);
      if(e.id===myId){SFX.score();toast(e.pts?`Chegou em ${e.place}º! +${e.pts}`:'Chegou! Mas sem pontos dessa vez')}
      break;
    case 'say':
      if(mode==='online')net.say.set(e.id,{text:e.text,t:3});
      feedPush(nameOf(e.id),colorOf(e.id),e.text,false);break;
    case 'fila':feedPush(`${e.who} (fila)`,'#c9c3d6',e.text,true);break;
    case 'react':if(!(e.who===nick&&e.id===myId))floaters.push({r:e.r,x:VW-rand(90,150),y:VH-rand(170,240),t:0,who:e.who});break;
    case 'lead':if(e.id===myId)toast('Você tá na frente! Zoa no 💬');break;
  }
}
function paintFx(i,id){
  tileFlash[i]=1;const t=world.tiles[i];
  if(me&&Math.abs(t.x-me.x)<500&&Math.abs(t.y-me.y)<700){
    const c=colorOf(id);for(let k=0;k<4;k++)part(t.x+t.w/2,t.y+t.h/2,rand(-90,90),rand(-90,90),c,rand(2,5),.45);
    if(id===myId&&paintSnd<=0){SFX.paint();paintSnd=.05}
  }
}

/* ================= chat ================= */
let chatOn=store.get('role_chat')!==false,feed=[];
function feedPush(name,color,text,fila){feed.push({name,color,text,fila,t:0});if(feed.length>4)feed.shift();renderFeed()}
function renderFeed(){
  const el=$('#feed');el.hidden=!chatOn||!feed.length;el.innerHTML='';
  for(const f of feed){const d=document.createElement('div');if(f.fila)d.className='fila';
    const b=document.createElement('b');b.textContent=f.name;b.style.color=f.color;d.append(b,document.createTextNode(' '+f.text));el.appendChild(d)}
}
function sendChat(text){
  text=cleanChat(text);if(!text)return;
  if(mode==='online'){
    const now=performance.now();if(now-net.lastChat<1200){toast('Calma, espera um pouquinho pra mandar outra');return}
    net.lastChat=now;netSend({t:'c',text});
  }else if(mode==='offline'&&me)match.humanSay(me,text);
  SFX.bump();
}
const sheet=$('#chatSheet');
function myRank(){return mode==='online'?(net.board?net.board.r:0):(me?match.ranking().indexOf(me)+1:0)}
function fillQuick(){
  const lead=me&&curView&&curView.phase==='play'&&myRank()===1,q=$('#quick');q.innerHTML='';
  $('#chatTitle').textContent=lead?'Você tá na frente: zoa!':'Chat';
  (lead?QUICK_LEAD:QUICK).forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('click',()=>{sendChat(t);closeChat()});q.appendChild(b)});
}
function openChat(){fillQuick();sheet.hidden=false;joy.active=false;joy.id=null;input.x=input.y=0;syncChatToggle()}
function closeChat(){sheet.hidden=true;$('#chatIn').blur()}
function syncChatToggle(){$('#chatToggle').textContent=chatOn?'Esconder chat':'Mostrar chat';$('#quick').hidden=!chatOn;$('#chatForm').hidden=!chatOn}
$('#chatBtn').addEventListener('click',()=>sheet.hidden?openChat():closeChat());
$('#chatClose').addEventListener('click',closeChat);
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const v=$('#chatIn').value;if(v.trim()){sendChat(v);$('#chatIn').value='';closeChat()}});
$('#chatToggle').addEventListener('click',()=>{chatOn=!chatOn;store.set('role_chat',chatOn);syncChatToggle();renderFeed()});
document.querySelectorAll('.reacts .chip[data-r]').forEach(b=>b.addEventListener('click',()=>{
  floaters.push({r:b.dataset.r,x:VW/2+rand(-30,30),y:VH-170,t:0,big:true,who:'você'});SFX.bump();
  if(mode==='online')netSend({t:'r',r:b.dataset.r});
}));

/* ================= telas e fluxo ================= */
function showScreen(id){for(const s of ['lobby','match','results','ads','queue'])$('#'+s).hidden=s!==id;if(id==='ads')openAds()}
function renderCard(html){const c=$('#card');c.innerHTML=`<div class="sticker">${html}</div>`;c.hidden=false}
function hideCard(){$('#card').hidden=true}
function showHud(on){$('#hud').hidden=!on;document.body.classList.toggle('spectating',on&&!me)}

function play(){
  audio();
  nick=($('#nick').value.trim()||'Você').slice(0,12);store.set('role_nick',nick);store.set('role_color',colorIdx);
  if(preview){startOffline();return}
  showScreen('match');$('#mmTitle').textContent='Conectando…';$('#mmN').textContent='0';$('#mmLast').textContent='';$('#dots').innerHTML='';
  $('#mmNote').textContent='Procurando uma sala com gente.';
  connect().catch(()=>startOffline('Sem conexão com o servidor agora. Você joga com bots.'));
}

/* ---------- offline ---------- */
function startOffline(note){
  mode='offline';match=attract;myId=0;
  if(me&&match.byId.get(me.id)===me&&!me.bot){Object.assign(me,{name:nick,color:COLORS[colorIdx]});match.rosterV++}
  else{me=match.addHuman(nick,COLORS[colorIdx])}
  myId=me.id;
  if(note)$('#lobbyNote').textContent=note;
  fillDots(match.players.map(p=>({color:p.color,me:p===me,name:p.name,bot:p.bot})),
    note||'Pouca gente online agora. Completamos a sala com bots, e eles saem quando alguém entra.',
    ()=>{showScreen(null);showHud(true);lastPhaseKey=null;match.startMatch()});
}
function fillDots(list,noteText,done){
  showScreen('match');const dots=$('#dots');dots.innerHTML='';
  for(let i=0;i<list.length;i++)dots.appendChild(document.createElement('i'));
  $('#mmTitle').textContent='Procurando sala…';$('#mmNote').textContent=noteText;
  const order=list.slice().sort((a,b)=>(b.me-a.me)||(a.bot-b.bot));
  const gap=Math.max(18,Math.min(55,1400/list.length));
  order.forEach((p,i)=>setTimeout(()=>{
    const d=dots.children[i];d.className=p.me?'on me':'on';d.style.background=p.color;
    $('#mmN').textContent=i+1;$('#mmLast').textContent=p.me?'Você entrou':`${p.name} entrou${p.bot?' 🤖':''}`;
    if(i%6===0)SFX.bump();
    if(i===order.length-1){$('#mmTitle').textContent=`Sala cheia! ${list.length}/${list.length}`;setTimeout(done,700)}
  },200+i*gap));
}

/* ---------- online ---------- */
function connect(){
  return new Promise((resolve,reject)=>{
    let ws;try{ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`)}catch(e){reject(e);return}
    let ok=false;const to=setTimeout(()=>{if(!ok){try{ws.close()}catch(e){}reject(new Error('timeout'))}},4000);
    ws.onopen=()=>ws.send(JSON.stringify({t:'hello',name:nick,c:colorIdx,vw:Math.round(VW/SCALE),vh:Math.round(VH/SCALE)}));
    ws.onmessage=ev=>{
      let m;try{m=JSON.parse(ev.data)}catch(e){return}
      if(m.t==='hi'){ok=true;clearTimeout(to);startOnline(ws);resolve();return}
      onNet(m);
    };
    ws.onclose=()=>{clearTimeout(to);if(!ok)reject(new Error('closed'));else if(net.ws===ws)lostConnection()};
    ws.onerror=()=>{};
  });
}
function netSend(o){if(net.ws&&net.ws.readyState===1)net.ws.send(JSON.stringify(o))}
function startOnline(ws){
  mode='online';net.ws=ws;net.snaps=[];net.offset=null;net.pending=[];net.seq=0;net.acc=0;net.objs.clear();net.say.clear();
  net.board=null;net.queued=false;me=null;myId=0;lastPhaseKey=null;feed=[];renderFeed();
}
function lostConnection(){
  net.ws=null;
  if(mode!=='online')return;
  mode=null;me=null;myId=0;match=attract;showHud(false);hideCard();closeChat();
  $('#lobbyNote').textContent='A conexão caiu. Toque em Jogar pra voltar.';showScreen('lobby');
}
function onNet(m){
  switch(m.t){
    case 'j':{
      net.tiles.set(m.tiles);
      if(m.id>0){
        const wasQueued=net.queued;net.queued=false;myId=m.id;
        me=new Match(world).makePlayer(nick,COLORS[colorIdx],false);me.id=myId;me.x=-1;net.pending=[];net.vis=null;
        if(wasQueued){showScreen(null);showHud(true);toast('Sua vez! Você entrou na sala');lastPhaseKey=null}
        else net.joinPending=true;
      }
      break;
    }
    case 'ro':
      net.roster=new Map(m.l.map(([id,name,color,bot])=>[id,{id,name,color,bot:!!bot}]));
      if(net.joinPending){net.joinPending=false;
        const list=m.l.map(([id,name,color,bot])=>({color,me:id===myId,name,bot:!!bot})),h=list.filter(p=>!p.bot).length;
        fillDots(list,h>1?`${h} pessoas na sala. Bots completam o resto e saem quando alguém entra.`:'Pouca gente online agora. Completamos a sala com bots, e eles saem quando alguém entra.',
          ()=>{if(mode!=='online')return;showScreen(null);showHud(true);lastPhaseKey=null});
      }
      break;
    case 'q':
      net.queued=true;me=null;myId=0;net.pending=[];
      $('#qEyebrow').textContent=m.rotated?'Você deu a vez':'Sala cheia';
      $('#qTitle').textContent=`Você é o ${m.pos}º da fila`;
      $('#qText').textContent=m.rotated?'Quem ficou por último dá a vez a quem está esperando. Você volta assim que abrir vaga.':'Enquanto espera, assista à partida, reaja e mande recado no chat.';
      showScreen('queue');showHud(true);hideCard();
      break;
    case 's':onSnap(m);break;
    case 'b':net.board=m;break;
    case 'rend':roundEndCard(m.top.map(([id,score])=>({id,score})),m.me?m.me[0]:0,m.n,m.mk);break;
    case 'res':
      showResults({top:m.top.map(([id,name,color,bot,total])=>({id,name,color,bot:!!bot,total})),me:m.me?{rank:m.me[0],total:m.me[1]}:null,
        n:m.n,rot:m.rot,online:true,rotated:m.rotated,queue:m.q});
      break;
  }
}
function onSnap(s){
  const now=performance.now(),d=s.st-now;
  net.offset=net.offset==null?d:(d<net.offset?d:net.offset+(d-net.offset)*.02);
  net.snaps.push({t:s.st,players:new Map(s.p.map(t=>[t[0],t]))});if(net.snaps.length>30)net.snaps.shift();
  const prevPh=net.last&&net.last.ph;net.last=s;
  if(s.ph==='intro'&&prevPh!=='intro')net.tiles.fill(-1);
  if(s.ta)net.tiles.set(s.ta);
  if(s.td)for(const [i,o] of s.td){net.tiles[i]=o;paintFx(i,o)}
  if(s.e)for(const e of s.e)fx(e);
  if(s.me&&me)reconcile(s);
  $('#watch').textContent=s.q?`${s.h} na sala · ${s.q} na fila`:`${s.h} ${s.h===1?'pessoa':'pessoas'} na sala`;
}
function reconcile(s){
  const a=s.me,first=me.x<0;
  Object.assign(me,{x:a[0],y:a[1],vx:a[2],vy:a[3],stun:a[4]/100,dashT:a[5]/100,dashCd:a[6]/100,knockImm:a[7]/100,arrived:!!(a[8]&4),passCd:a[9]/100});
  net.pending=net.pending.filter(i=>i.s>s.ack);
  if(s.ph==='play')for(const i of net.pending){me.input={x:i.x,y:i.y};if(i.d)dash(me,null);stepPlayer(world,me,STEP,null,false)}
  if(first||!net.vis)net.vis={x:me.x,y:me.y};
}
function onlineStep(dt){
  if(!me||net.queued)return;
  net.acc+=dt;
  while(net.acc>=STEP){
    net.acc-=STEP;
    const i={s:++net.seq,x:+input.x.toFixed(2),y:+input.y.toFixed(2),d:net.dashQ?1:0};net.dashQ=false;
    netSend({t:'i',...i});net.pending.push(i);if(net.pending.length>90)net.pending.shift();
    if(net.last&&net.last.ph==='play'&&me.x>=0){me.input={x:i.x,y:i.y};if(i.d)dash(me,null);stepPlayer(world,me,STEP,null,false)}
  }
  if(net.vis){const dx=me.x-net.vis.x,dy=me.y-net.vis.y;if(Math.hypot(dx,dy)>120){net.vis.x=me.x;net.vis.y=me.y}else{const k=Math.min(1,dt*18);net.vis.x+=dx*k;net.vis.y+=dy*k}}
  for(const q of net.say.values())q.t-=dt;
}

/* ---------- fases, placar e resultados ---------- */
function phaseUI(v){
  const key=v.phase+':'+v.roundIdx;
  if(key!==lastPhaseKey){
    const prev=lastPhaseKey;lastPhaseKey=key;
    if(v.phase==='intro'){
      if(mode==='online'&&!$('#results').hidden)showScreen(net.queued?'queue':null);
      const md=MODES[v.modeKey],sp=OUTDOORS[v.roundIdx%OUTDOORS.length];
      showHud(true);$('#modeName').textContent=md.name;$('#roundNo').textContent=`${v.roundIdx+1}/3`;$('#hint').hidden=v.roundIdx>0;
      renderCard(`
        <div class="eyebrow">Rodada ${v.roundIdx+1} de 3</div>
        <h2 class="mode">${md.name}</h2>
        <p class="tip">${md.tip}</p>
        <div class="count" id="cnt">3</div>
        <div class="sponsor">Rodada oferecida por <span class="brand" style="background:${sp.bg};color:${sp.fg}">${sp.brand}</span></div>`);
      net.cnt=null;
    }else if(v.phase==='play'){
      hideCard();$('#modeName').textContent=MODES[v.modeKey].name;$('#roundNo').textContent=`${v.roundIdx+1}/3`;
      if(prev===null&&mode==='online')toast(`Rodada em andamento: ${MODES[v.modeKey].name}`);
    }else if(v.phase==='roundEnd'&&mode==='offline'){
      const r=match.lastRound;roundEndCard(r,r.findIndex(x=>x.id===myId)+1,r.length,match.modeKey);
    }else if(v.phase==='results'){
      if(mode==='offline')offlineResults();
      else if(prev===null)renderCard(`<div class="eyebrow">Intervalo</div><h2 class="mode">Próxima partida já já</h2><p class="tip">Você entra na próxima rodada.</p>`);
    }
  }
  if(v.phase==='intro'){
    const n=Math.ceil(v.phaseT-.6),c=$('#cnt');
    if(c&&n!==net.cnt){net.cnt=n;c.textContent=n>0?n:'JÁ!';n>0?SFX.tick():SFX.go()}
  }
  if(v.phase==='play'){
    const t=Math.max(0,Math.ceil(v.timeLeft)),tel=$('#timer');
    if(tel.textContent!==String(t)){tel.textContent=t;tel.classList.toggle('hot',t<=10);if(t<=5&&t>0)SFX.tick()}
  }
  if(v.phase==='results'&&mode==='online'){
    const n=Math.max(0,Math.ceil(v.phaseT)),el=$('#resNext');
    el.hidden=false;el.textContent=`Próxima partida em ${n}s`;
  }
}
function roundEndCard(top,myPos,n,mk){
  const unit=MODES[mk]?MODES[mk].unit:'pontos';
  renderCard(`
    <div class="eyebrow">Fim da rodada</div>
    <h2 class="mode">${myPos===1?'VOCÊ GANHOU!':'FIM!'}</h2>
    <ol class="mini">${top.slice(0,3).map((p,i)=>`<li><span>${i+1}º</span><span>${esc(nameOf(p.id))}</span><span>${p.score} ${unit}</span></li>`).join('')}</ol>
    ${myPos?`<p class="tip">Você ficou em <b>${myPos}º de ${n}</b> nesta rodada.</p>`:''}`);
  SFX.score();
}
function offlineResults(){
  const m=match,top=m.final.slice(0,8).map(f=>{const p=m.byId.get(f.id);return{id:p.id,name:p.name,color:p.color,bot:p.bot,total:f.total}});
  const i=m.final.findIndex(f=>f.id===myId);
  const rot=m.rotateBots(5);
  showResults({top,me:i>=0?{rank:i+1,total:m.final[i].total}:null,n:m.final.length,rot,online:false});
}
function showResults(r){
  myResults=r;hideCard();closeChat();
  const pos=r.me?r.me.rank:0;
  $('#resTitle').textContent=r.rotated?'Você deu a vez':pos===1?'Você é o rei do rolê!':pos?`Você ficou em ${pos}º de ${r.n}`:'Fim da partida';
  const ol=$('#rank');ol.innerHTML='';
  const rows=r.top.map((p,i)=>({...p,rank:i+1}));
  if(r.me&&pos>8)rows.push(null,{name:nick,color:COLORS[colorIdx],bot:false,total:r.me.total,rank:pos,me:true});
  for(const p of rows){
    if(!p){const g=document.createElement('li');g.className='gap';g.textContent='…';ol.appendChild(g);continue}
    const li=document.createElement('li');if(p.me||p.id===myId)li.className='me';
    const a=document.createElement('span');a.className='pos';a.textContent=p.rank;
    const dot=document.createElement('span');dot.style.cssText=`width:14px;height:14px;border-radius:50%;border:2px solid #1b1a22;background:${p.color};flex:none`;
    const n=document.createElement('span');n.className='nm';n.textContent=p.name+(p.bot?' 🤖':'');
    const s=document.createElement('span');s.className='pts';s.textContent=p.total;
    li.append(a,dot,n,s);ol.appendChild(li);
  }
  const qb=$('#queueBox');qb.innerHTML='';
  if(r.rot&&r.rot.out.length){
    const b1=document.createElement('div');const B=document.createElement('b');B.textContent='Rodízio da sala: ';
    b1.append(B,document.createTextNode(`${r.rot.in.join(', ')} entram na próxima. Os ${r.rot.out.length} últimos (${r.rot.out.join(', ')}) dão a vez.`));
    qb.appendChild(b1);qb.hidden=false;
  }else qb.hidden=true;
  $('#again').textContent=r.online?'CONTINUAR':'JOGAR DE NOVO';
  $('#resNext').hidden=!r.online;
  showScreen('results');
}
let boardT=0;
function updateBoard(v){
  if(--boardT>0)return;boardT=8;
  let top,r,s,n;
  if(mode==='online'){const b=net.board;if(!b)return;top=b.top.map(([id,score])=>({id,score}));r=b.r;s=b.s;n=b.n}
  else{const ranked=match.ranking();top=ranked.slice(0,3).map(p=>({id:p.id,score:Math.max(0,Math.floor(p.score))}));r=me?ranked.indexOf(me)+1:0;s=me?Math.max(0,Math.floor(me.score)):0;n=ranked.length}
  const el=$('#board');el.innerHTML='';
  const head=document.createElement('div');head.className='unit';
  const h1=document.createElement('span');h1.textContent=`ao vivo · ${n}`;const h2=document.createElement('span');h2.textContent=v.modeKey?MODES[v.modeKey].unit:'';
  head.append(h1,h2);el.appendChild(head);
  const rows=top.map((p,i)=>({...p,rank:i+1}));
  if(r>3)rows.push({id:myId,score:s,rank:r});
  for(const p of rows){const d=document.createElement('div');if(p.id===myId&&myId)d.className='me';
    const i=document.createElement('i');i.style.background=colorOf(p.id);const sp=document.createElement('span');sp.textContent=`${p.rank}. ${p.id===myId?nick:nameOf(p.id)}`;
    const b=document.createElement('b');b.textContent=p.score;d.append(i,sp,b);el.appendChild(d)}
}

/* ================= loop ================= */
const cv=$('#cv'),ctx=cv.getContext('2d');
let DPR=1,VW=0,VH=0,SCALE=1;
const cam={x:world.plaza.x+BS/2,y:world.plaza.y+BS,follow:null};
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);VW=cv.clientWidth;VH=cv.clientHeight;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);
  SCALE=clamp(Math.min(VW/500,VH/800),.6,1.5);
  if(mode==='online')netSend({t:'v',vw:Math.round(VW/SCALE),vh:Math.round(VH/SCALE)});
}
addEventListener('resize',resize);resize();
let last=performance.now(),paused=false;
document.addEventListener('visibilitychange',()=>{paused=document.hidden;last=performance.now()});
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(!paused){update(dt);render()}
  requestAnimationFrame(frame);
}
function update(dt){
  if(toastT>0){toastT-=dt;if(toastT<=0)$('#toast').classList.add('off')}
  paintSnd-=dt;
  if(mode==='online')onlineStep(dt);
  else{
    if(me&&mode==='offline')me.input={x:input.x,y:input.y};
    match.step(dt);
    for(const e of match.ev)fx(e);match.ev.length=0;
    if(mode==='offline'){
      watchT-=dt;if(watchT<=0){watchT=rand(5,9);watchers=clamp(watchers+Math.round(rand(-1,1.6)),2,9);$('#watch').textContent=`${watchers} na fila`}
      if(match.phase==='play'&&Math.random()<dt*.5)floaters.push({r:pick(['😂','🔥','😱','👏','💀','🤣']),x:VW-rand(90,150),y:VH-rand(170,240),t:0,who:pick(NAMES)});
    }
  }
  const v=buildView(dt);curView=v;
  if(mode)phaseUI(v);
  if(mode&&$('#hud').hidden===false)updateBoard(v);
  if(me){const cd=me.dashCd>0?1-me.dashCd/1.1:1;$('#dash').style.setProperty('--cd',clamp(cd,0,1))}
  for(const q of parts){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.92;q.vy*=.92;q.life-=dt}
  parts=parts.filter(q=>q.life>0);
  for(const t of texts)t.t+=dt;texts=texts.filter(t=>t.t<1.1);
  for(let i=0;i<tileFlash.length;i++)if(tileFlash[i]>0)tileFlash[i]-=dt*3;
  for(const e of floaters)e.t+=dt;floaters=floaters.filter(e=>e.t<2.2);
  const nf=feed.length;for(const f of feed)f.t+=dt;feed=feed.filter(f=>f.t<9);if(feed.length!==nf)renderFeed();
  // câmera
  let tx=cam.x,ty=cam.y;
  const mePos=mode==='online'?net.vis:me;
  if(me&&mePos&&mode){tx=mePos.x;ty=mePos.y}
  else if(mode==='online'){const f=v.players.find(p=>p.id===v.follow)||v.players[0];if(f){tx=f.x;ty=f.y}}
  else{if(!cam.follow||Math.random()<dt*.08||!v.players.includes(cam.follow))cam.follow=pick(v.players);if(cam.follow){tx=cam.follow.x;ty=cam.follow.y}}
  const k=Math.min(1,dt*(me?6:1.2));cam.x+=(tx-cam.x)*k;cam.y+=(ty-cam.y)*k;
  const hw=VW/SCALE/2,hh=VH/SCALE/2;
  cam.x=W>hw*2?clamp(cam.x,hw,W-hw):W/2;cam.y=H>hh*2?clamp(cam.y,hh,H-hh):H/2;
  shakeA*=Math.exp(-dt*10);
}

/* ================= desenho ================= */
function fitFont(g,text,maxW,size,fam){g.font=`${size}px ${fam}`;const w=g.measureText(text).width;if(w>maxW){size=Math.max(6,size*maxW/w);g.font=`${size}px ${fam}`}return size}
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;r=clamp(Math.round(r*amt),0,255);g=clamp(Math.round(g*amt),0,255);b=clamp(Math.round(b*amt),0,255);return`rgb(${r},${g},${b})`}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function drawRecado(g,x,y,w,h,rec,seed){
  g.fillStyle='#bdb6aa';g.fillRect(x,y,w,h);
  g.strokeStyle='rgba(0,0,0,.08)';g.lineWidth=1;
  for(let yy=y+6;yy<y+h;yy+=7){g.beginPath();g.moveTo(x,yy);g.lineTo(x+w,yy);g.stroke()}
  drawRecadoText(g,x,y,w,h,rec,seed);
}
function drawRecadoText(g,x,y,w,h,rec,seed){
  const size=fitFont(g,rec.t,w-10,h*.82,MARKER);
  g.textAlign='center';g.textBaseline='middle';
  g.lineJoin='round';g.lineWidth=Math.max(2,size*.18);g.strokeStyle='#1b1a22';g.strokeText(rec.t,x+w/2,y+h/2+1);
  g.fillStyle=rec.c;g.fillText(rec.t,x+w/2,y+h/2+1);
  const r=seeded(seed||7);g.fillStyle=rec.c;
  for(let i=0;i<4;i++){const dx=x+w*.15+r()*w*.7;g.fillRect(dx,y+h*.72,1.6,h*.2+r()*h*.35)}
}
function drawLoja(g,x,y,w,h,l){
  const sw=w*.84,sh=h*.66,sx=x+(w-sw)/2,sy=y+(h-sh)/2;
  g.fillStyle='rgba(0,0,0,.25)';g.fillRect(sx+2,sy+2,sw,sh);
  g.fillStyle=l.bg;g.fillRect(sx,sy,sw,sh);g.strokeStyle='#1b1a22';g.lineWidth=1.5;g.strokeRect(sx,sy,sw,sh);
  fitFont(g,l.name,sw-8,sh*.62,DISPLAY);g.fillStyle=l.fg;g.textAlign='center';g.textBaseline='middle';g.fillText(l.name,x+w/2,y+h/2+1);
}
function drawBoard(g,x,y,w,h,ad){
  g.fillStyle='#1b1a22';g.fillRect(x+w*.2,y+h,4,10);g.fillRect(x+w*.8-4,y+h,4,10);
  g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x+4,y+4,w,h);
  g.fillStyle=ad.bg;g.fillRect(x,y,w,h);g.strokeStyle='#1b1a22';g.lineWidth=3;g.strokeRect(x,y,w,h);
  g.textAlign='center';g.textBaseline='middle';
  fitFont(g,ad.brand,w-16,h*.36,DISPLAY);g.fillStyle=ad.fg;g.fillText(ad.brand,x+w/2,y+h*.38);
  g.font=`800 ${Math.min(h*.24,14)}px ${BODY}`;g.fillText(ad.line,x+w/2,y+h*.74);
}
function drawPaint(g,v,x,y,w,h){
  if(v.modeKey!=='picha')return;
  const own=v.tileOwner;
  world.tiles.forEach((t,i)=>{
    if(own[i]<0||t.x<x-1||t.x>x+w||t.y<y-1||t.y>y+h)return;
    g.globalAlpha=.78;g.fillStyle=colorOf(own[i]);g.fillRect(t.x,t.y,t.w+.5,t.h);
    if(tileFlash[i]>0){g.globalAlpha=tileFlash[i];g.fillStyle='#fff';g.fillRect(t.x,t.y,t.w,t.h)}
    g.globalAlpha=1;
  });
}
function render(){
  const g=ctx,v=curView;if(!v)return;g.setTransform(DPR,0,0,DPR,0,0);
  g.fillStyle='#3b4152';g.fillRect(0,0,VW,VH);
  const sx=(Math.random()-.5)*shakeA,sy=(Math.random()-.5)*shakeA;
  g.save();g.translate(VW/2+sx,VH/2+sy);g.scale(SCALE,SCALE);g.translate(-cam.x,-cam.y);
  const vx0=cam.x-VW/SCALE/2-60,vx1=cam.x+VW/SCALE/2+60,vy0=cam.y-VH/SCALE/2-60,vy1=cam.y+VH/SCALE/2+60;
  const vis=r=>r.x+r.w>vx0&&r.x<vx1&&r.y+r.h>vy0&&r.y<vy1;
  const pz=world.plaza;
  // ruas
  g.strokeStyle='rgba(255,210,63,.55)';g.lineWidth=3;g.setLineDash([18,16]);
  for(let c=1;c<5;c++){const x=M+c*(BS+ST)-ST/2;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
  for(let r=1;r<6;r++){const y=M+r*(BS+ST)-ST/2;g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
  g.setLineDash([]);
  g.fillStyle='#cfc8bb';
  for(const b of world.blocks){if(!vis({x:b.x-14,y:b.y-14,w:b.w+28,h:b.h+28}))continue;rr(g,b.x-14,b.y-14,b.w+28,b.h+28,14);g.fill()}
  // praça
  g.fillStyle='#cfc8bb';rr(g,pz.x-14,pz.y-14,pz.w+28,pz.h+28,14);g.fill();
  g.fillStyle='#e6dfd0';rr(g,pz.x,pz.y,pz.w,pz.h,10);g.fill();
  g.strokeStyle='rgba(0,0,0,.05)';g.lineWidth=1;
  for(let x=pz.x;x<pz.x+pz.w;x+=24){g.beginPath();g.moveTo(x,pz.y);g.lineTo(x,pz.y+pz.h);g.stroke()}
  for(let y=pz.y;y<pz.y+pz.h;y+=24){g.beginPath();g.moveTo(pz.x,y);g.lineTo(pz.x+pz.w,y);g.stroke()}
  g.fillStyle='#8fc27a';
  rr(g,pz.x+12,pz.y+120,70,180,30);g.fill();rr(g,pz.x+pz.w-82,pz.y+120,70,180,30);g.fill();
  g.font=`14px ${DISPLAY}`;g.fillStyle='rgba(27,26,34,.35)';g.textAlign='center';g.textBaseline='middle';
  g.fillText('PRAÇA CENTRAL',pz.x+pz.w/2,pz.y+pz.h-24);
  if(v.target>=0){
    const d=world.buildings[v.target].door,p=.5+.5*Math.sin(performance.now()/160);
    g.fillStyle=`rgba(255,210,63,${.25+.25*p})`;g.beginPath();g.arc(d.x,d.y,38+p*6,0,7);g.fill();
    g.strokeStyle='#ffd23f';g.lineWidth=4;g.setLineDash([10,8]);g.beginPath();g.arc(d.x,d.y,38,0,7);g.stroke();g.setLineDash([]);
  }
  for(const b of world.buildings){
    if(!vis(b))continue;
    g.fillStyle='rgba(0,0,0,.22)';g.fillRect(b.x+8,b.y+8,b.w,b.h);
    g.fillStyle=b.roof;g.fillRect(b.x,b.y,b.w,b.h-FRONT);
    g.strokeStyle=shade(b.roof,.75);g.lineWidth=4;g.strokeRect(b.x+4,b.y+4,b.w-8,b.h-FRONT-8);
    if(!b.outdoor)for(const d of b.deco){const s=10+d.s*14;g.fillStyle=shade(b.roof,.82);g.fillRect(b.x+14+d.x*(b.w-28-s),b.y+14+d.y*(b.h-FRONT-28-s),s,s)}
    if(b.outdoor){const bw=Math.min(210,b.w-40),bh=74;drawBoard(g,b.x+(b.w-bw)/2,b.y+(b.h-FRONT-bh)/2-6,bw,bh,b.outdoor)}
    const fy=b.y+b.h-FRONT;
    if(b.recado)drawRecado(g,b.x,fy,b.w,FRONT,b.recado,b.x+b.y);
    else{g.fillStyle=shade(b.roof,.6);g.fillRect(b.x,fy,b.w,FRONT)}
    drawPaint(g,v,b.x,fy,b.w,FRONT);
    if(b.loja)drawLoja(g,b.x,fy,b.w,FRONT,b.loja);
    else if(b.recado&&v.modeKey==='picha')drawRecadoText(g,b.x,fy,b.w,FRONT,b.recado,b.x+b.y);
    g.strokeStyle='#1b1a22';g.lineWidth=2;g.strokeRect(b.x,b.y,b.w,b.h);
  }
  for(const m of world.muros){if(!vis(m))continue;
    g.fillStyle='rgba(0,0,0,.2)';g.fillRect(m.x+5,m.y+5,m.w,m.h);
    drawRecado(g,m.x,m.y,m.w,m.h,m.recado,m.y);drawPaint(g,v,m.x,m.y,m.w,m.h);
    if(v.modeKey==='picha')drawRecadoText(g,m.x,m.y,m.w,m.h,m.recado,m.y);
    g.strokeStyle='#1b1a22';g.lineWidth=2;g.strokeRect(m.x,m.y,m.w,m.h);}
  const bb=world.billboard;drawBoard(g,bb.x,bb.y,bb.w,bb.h,bb.ad);
  for(const c of world.circles){
    if(c.fountain){g.fillStyle='#9aa3b5';g.beginPath();g.arc(c.x,c.y,c.r,0,7);g.fill();g.fillStyle='#5fb4e8';g.beginPath();g.arc(c.x,c.y,c.r-8,0,7);g.fill();
      const t=performance.now()/400;g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=2;
      for(let i=0;i<3;i++){g.beginPath();g.arc(c.x,c.y,((t+i)%3)/3*(c.r-10),0,7);g.stroke()}
      g.strokeStyle='#1b1a22';g.lineWidth=2;g.beginPath();g.arc(c.x,c.y,c.r,0,7);g.stroke()}
    else{g.fillStyle='rgba(0,0,0,.2)';g.beginPath();g.arc(c.x+5,c.y+5,c.r+6,0,7);g.fill();
      g.fillStyle='#3f9b5b';g.beginPath();g.arc(c.x,c.y,c.r+6,0,7);g.fill();g.fillStyle='#5cb874';g.beginPath();g.arc(c.x-5,c.y-5,c.r-4,0,7);g.fill()}
  }
  const meDraw=mode==='online'&&me&&net.vis?{...me,x:net.vis.x,y:net.vis.y}:null;
  const plist=meDraw?v.players.map(p=>p===me?meDraw:p):v.players;
  const sorted=plist.filter(p=>p.x>vx0&&p.x<vx1&&p.y>vy0-40&&p.y<vy1+40).sort((a,b)=>a.y-b.y);
  for(const p of sorted){g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(p.x,p.y+p.r*.8,p.r*.95,p.r*.4,0,0,7);g.fill()}
  for(const p of sorted)drawPlayer(g,v,p);
  for(const p of sorted)drawBubble(g,v,p);
  for(const q of parts){g.globalAlpha=clamp(q.life/q.max,0,1);g.fillStyle=q.color;g.beginPath();g.arc(q.x,q.y,q.size,0,7);g.fill()}
  g.globalAlpha=1;
  for(const t of texts){const k=t.t/1.1;g.globalAlpha=1-k*k;const s=(14+8*Math.min(1,t.t*6))*t.scale;
    g.font=`${s}px ${DISPLAY}`;g.textAlign='center';g.textBaseline='middle';g.lineWidth=4;g.strokeStyle='#1b1a22';
    g.strokeText(t.text,t.x,t.y-t.t*40);g.fillStyle=t.color;g.fillText(t.text,t.x,t.y-t.t*40)}
  g.globalAlpha=1;g.restore();
  if(mode&&v.phase==='play'&&me){const mk=marker(v);if(mk)drawEdgeMarker(g,mk)}
  if(joy.active){g.globalAlpha=.55;g.fillStyle='#fff';g.beginPath();g.arc(joy.ox,joy.oy,54,0,7);g.fill();g.globalAlpha=1;
    g.lineWidth=3;g.strokeStyle='#1b1a22';g.beginPath();g.arc(joy.ox,joy.oy,54,0,7);g.stroke();
    g.fillStyle=me?me.color:'#ffd23f';g.beginPath();g.arc(joy.ox+input.x*40,joy.oy+input.y*40,24,0,7);g.fill();g.stroke()}
  for(const e of floaters){const k=e.t/2.2;g.globalAlpha=1-k*k;g.font=`${e.big?40:28}px system-ui,'Apple Color Emoji','Segoe UI Emoji'`;g.textAlign='center';
    g.fillText(e.r,e.x+Math.sin(e.t*4+e.x)*10,e.y-e.t*120);if(e.who){g.font=`800 11px ${BODY}`;g.fillStyle='#fff';g.fillText(e.who,e.x,e.y-e.t*120+26)}}
  g.globalAlpha=1;
}
function marker(v){
  const mp=mode==='online'?net.vis:me;if(!mp)return null;
  if(v.modeKey==='batata'){
    if(v.bombs.has(myId)){let best=null,bd=1e9;for(const p of v.players){if(p.id===myId||v.bombs.has(p.id))continue;const d=Math.hypot(p.x-mp.x,p.y-mp.y);if(d<bd){bd=d;best=p}}
      return best?{x:best.x,y:best.y,label:'PASSA',color:'#ffd23f'}:null}
    let best=null,bd=1e9;for(const [id,b] of v.bombs){const d=Math.hypot(b.x-mp.x,b.y-mp.y);if(d<bd){bd=d;best=b}}
    return best?{x:best.x,y:best.y,label:'BOMBA',color:'#ff4f8b'}:null;
  }
  if(v.modeKey==='corre'&&v.target>=0&&!me.arrived){const b=world.buildings[v.target];return{x:b.door.x,y:b.door.y,label:b.loja.name,color:'#ffd23f'}}
  return null;
}
function drawPlayer(g,v,p){
  const sp=Math.hypot(p.vx,p.vy),st=Math.min(.25,sp/1600);
  const ang=Math.atan2(p.vy,p.vx),bob=Math.sin(p.wob)*Math.min(1,sp/120)*1.6;
  g.save();g.translate(p.x,p.y-bob);
  if(p.stun>0)g.rotate(Math.sin(p.spin)*.5);
  g.save();g.rotate(ang);g.scale(1+st,1-st);g.rotate(-ang);
  g.fillStyle=p.color;g.strokeStyle='#1b1a22';g.lineWidth=3;g.beginPath();g.arc(0,0,p.r,0,7);g.fill();g.stroke();
  g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.arc(-4,-5,4,0,7);g.fill();
  g.restore();
  const lx=p.lookX*4,ly=p.lookY*3-2;
  if(p.stun>0){g.strokeStyle='#1b1a22';g.lineWidth=2;
    for(const ex of [-5,5]){g.beginPath();g.moveTo(ex-3+lx,ly-3);g.lineTo(ex+3+lx,ly+3);g.moveTo(ex+3+lx,ly-3);g.lineTo(ex-3+lx,ly+3);g.stroke()}
    for(let i=0;i<3;i++){const a=p.spin*.6+i*2.1;g.fillStyle='#ffd23f';g.font=`12px ${DISPLAY}`;g.textAlign='center';g.fillText('★',Math.cos(a)*16,-p.r-6+Math.sin(a)*4)}
  }else{
    for(const ex of [-5,5]){g.fillStyle='#fff';g.beginPath();g.ellipse(ex+lx*.4,ly,4,5,0,0,7);g.fill();g.strokeStyle='#1b1a22';g.lineWidth=1.5;g.stroke();
      g.fillStyle='#1b1a22';g.beginPath();g.arc(ex+lx*.9,ly+p.lookY*1.2,2.1,0,7);g.fill()}
  }
  const bomb=v.bombs.get(p.id);
  if(bomb){
    const f=bomb.fuse,blink=f<3&&Math.floor(performance.now()/(f<1.2?70:160))%2;
    g.fillStyle=blink?'#ff4f8b':'#26242e';g.beginPath();g.arc(0,-p.r-12,9,0,7);g.fill();g.strokeStyle='#1b1a22';g.lineWidth=2;g.stroke();
    g.strokeStyle='#8a6d3b';g.beginPath();g.moveTo(4,-p.r-19);g.quadraticCurveTo(9,-p.r-26,6,-p.r-29);g.stroke();
    g.fillStyle=Math.random()<.5?'#ffd23f':'#ff8a1f';g.beginPath();g.arc(6,-p.r-30,3+Math.random()*2,0,7);g.fill();
  }
  if(v.phase==='play'&&v.modeKey==='corre'&&p.arrived){g.font=`12px ${DISPLAY}`;g.fillStyle='#ffd23f';g.textAlign='center';g.fillText('✓',0,-p.r-8)}
  const isMe=p.id===myId&&myId;
  const label=p.bot?`${p.name} 🤖`:p.name;g.font=`800 11px ${BODY}`;g.textAlign='center';g.textBaseline='middle';
  const tw=g.measureText(label).width+10,ny=p.r+14;
  g.fillStyle=isMe?'#ffd23f':'rgba(27,26,34,.75)';rr(g,-tw/2,ny-8,tw,16,8);g.fill();
  g.fillStyle=isMe?'#1b1a22':'#fff';g.fillText(label,0,ny+.5);
  g.restore();
}
function drawBubble(g,v,p){
  const say=v.sayOf(p);
  if(!chatOn||!say)return;g.globalAlpha=Math.min(1,say.t/.3);
  g.font=`800 12px ${BODY}`;let t=say.text;
  if(g.measureText(t).width>150){while(g.measureText(t+'…').width>150&&t.length>2)t=t.slice(0,-1);t+='…'}
  const w=g.measureText(t).width+16,h=24,x=p.x-w/2,y=p.y-p.r-(v.bombs.has(p.id)?66:46);
  g.fillStyle='#fff';g.strokeStyle='#1b1a22';g.lineWidth=2;rr(g,x,y,w,h,10);g.fill();g.stroke();
  g.beginPath();g.moveTo(p.x-6,y+h-1.5);g.lineTo(p.x,y+h+7);g.lineTo(p.x+6,y+h-1.5);g.closePath();g.fill();
  g.beginPath();g.moveTo(p.x-6,y+h);g.lineTo(p.x,y+h+7);g.lineTo(p.x+6,y+h);g.stroke();
  g.fillStyle='#1b1a22';g.textAlign='center';g.textBaseline='middle';g.fillText(t,p.x,y+h/2+.5);g.globalAlpha=1;
}
function drawEdgeMarker(g,mk){
  const sxp=(mk.x-cam.x)*SCALE+VW/2,syp=(mk.y-cam.y)*SCALE+VH/2,pad=46;
  const top=pad+150,bottom=VH-pad-260;
  if(sxp>pad&&sxp<VW-pad&&syp>top&&syp<bottom)return;
  const cx=VW/2,cy=(top+bottom)/2,dx=sxp-cx,dy=syp-cy;
  const s=Math.min((VW/2-pad)/Math.abs(dx||1e-6),((bottom-top)/2)/Math.abs(dy||1e-6));
  const x=cx+dx*s,y=cy+dy*s,a=Math.atan2(dy,dx);
  g.save();g.translate(x,y);g.rotate(a);g.fillStyle=mk.color;g.strokeStyle='#1b1a22';g.lineWidth=3;
  g.beginPath();g.moveTo(18,0);g.lineTo(-10,-13);g.lineTo(-4,0);g.lineTo(-10,13);g.closePath();g.fill();g.stroke();g.restore();
  g.font=`11px ${DISPLAY}`;const lbl=mk.label.length>18?mk.label.slice(0,17)+'…':mk.label;const tw=g.measureText(lbl).width+12;
  const lx=clamp(x-Math.cos(a)*34,tw/2+6,VW-tw/2-6),ly=clamp(y-Math.sin(a)*30,16,VH-16);
  g.fillStyle=mk.color;rr(g,lx-tw/2,ly-10,tw,20,6);g.fill();g.strokeStyle='#1b1a22';g.lineWidth=2;g.stroke();
  g.fillStyle='#1b1a22';g.textAlign='center';g.textBaseline='middle';g.fillText(lbl,lx,ly+1);
}

/* ================= controles ================= */
const joy={active:false,id:null,ox:0,oy:0};
const canMove=()=>me&&mode&&curView&&(curView.phase==='play'||curView.phase==='intro');
function doDash(){
  if(!me||!curView||curView.phase!=='play'||me.dashCd>0||me.stun>0)return;
  SFX.dash();
  if(mode==='online')net.dashQ=true;else dash(me,match);
}
cv.addEventListener('pointerdown',e=>{
  audio();if(!canMove())return;
  if(!joy.active&&e.clientX<VW*.62){joy.active=true;joy.id=e.pointerId;joy.ox=e.clientX;joy.oy=e.clientY;input.x=input.y=0;$('#hint').hidden=true;try{cv.setPointerCapture(e.pointerId)}catch(_){}}
  else if(e.clientX>=VW*.62)doDash();
});
cv.addEventListener('pointermove',e=>{
  if(!joy.active||e.pointerId!==joy.id)return;
  let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const d=Math.hypot(dx,dy),R=44;
  if(d>R*1.6){joy.ox+=dx/d*(d-R*1.6);joy.oy+=dy/d*(d-R*1.6)}
  input.x=clamp(dx/R,-1,1);input.y=clamp(dy/R,-1,1);const m=Math.hypot(input.x,input.y);if(m>1){input.x/=m;input.y/=m}
});
const endJoy=e=>{if(e.pointerId===joy.id){joy.active=false;joy.id=null;input.x=input.y=0}};
cv.addEventListener('pointerup',endJoy);cv.addEventListener('pointercancel',endJoy);
$('#dash').addEventListener('pointerdown',e=>{e.preventDefault();audio();doDash()});
const keys={};
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;keys[e.code]=true;
  if(e.code==='Enter'&&me&&curView&&curView.phase==='play'&&sheet.hidden){e.preventDefault();openChat();$('#chatIn').focus();return}
  if(e.code==='Space'||e.code==='KeyJ'){e.preventDefault();doDash()}keyInput()});
addEventListener('keyup',e=>{keys[e.code]=false;keyInput()});
function keyInput(){if(joy.active)return;let x=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),y=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0);const m=Math.hypot(x,y)||1;input.x=x/m;input.y=y/m}
$('#mute').textContent=muted?'🔇':'🔊';
$('#mute').addEventListener('click',()=>{muted=!muted;store.set('role_muted',muted);$('#mute').textContent=muted?'🔇':'🔊';if(!muted)audio()});

/* ================= lobby, resultados e fila ================= */
function swatches(el,list,getIdx,setIdx){
  el.innerHTML='';list.forEach((c,i)=>{const b=document.createElement('button');b.className='swatch';b.style.background=c;b.setAttribute('aria-label',`Cor ${i+1}`);
    b.setAttribute('aria-pressed',i===getIdx()?'true':'false');b.addEventListener('click',()=>{setIdx(i);[...el.children].forEach((x,j)=>x.setAttribute('aria-pressed',j===i?'true':'false'))});el.appendChild(b)});
}
$('#nick').value=nick;
swatches($('#swatches'),COLORS,()=>colorIdx,i=>{colorIdx=i;store.set('role_color',i)});
if(preview)$('#lobbyNote').textContent='Nesta prévia você joga com bots. No endereço oficial, a sala junta as pessoas online.';
$('#play').addEventListener('click',play);
$('#nick').addEventListener('keydown',e=>{if(e.key==='Enter')play()});
$('#again').addEventListener('click',()=>{
  if(mode==='online'){showScreen(net.queued?'queue':null);return}
  showScreen(null);lastPhaseKey=null;match.startMatch();
});
function toLobby(){
  if(mode==='online'){const ws=net.ws;net.ws=null;mode=null;try{ws&&ws.close()}catch(e){}}
  if(mode==='offline'&&me){match.humanLeft(me)}
  mode=null;me=null;myId=0;match=attract;match.phase='idle';match.modeKey=null;match.mode=null;
  showHud(false);hideCard();closeChat();feed=[];renderFeed();showScreen('lobby');
}
$('#quit').addEventListener('click',toLobby);
$('#qLeave').addEventListener('click',toLobby);
let adReturn='lobby';
$('#openAds').addEventListener('click',()=>{adReturn='lobby';showScreen('ads')});
$('#resAds').addEventListener('click',()=>{adReturn='results';showScreen('ads')});
$('#adBack').addEventListener('click',()=>showScreen(adReturn));
$('#share').addEventListener('click',()=>{
  const pts=myResults&&myResults.me?myResults.me.total:0;
  const txt=`Bora jogar Rolê comigo? Fiz ${pts} pontos. ${location.href}`;
  const done=()=>{$('#share').textContent='Link copiado!';setTimeout(()=>$('#share').textContent='Chamar amigos',1800)};
  const fallback=()=>{const i=$('#shareTxt');i.hidden=false;i.value=txt;i.focus();i.select()};
  try{navigator.clipboard.writeText(txt).then(done,fallback)}catch(e){fallback()}
});

/* ================= anúncios (demonstração) ================= */
const AD_COLORS=['#ff4f8b','#e63946','#2f6bff','#1fbf75','#9b5cff','#ff8a1f','#ffd23f','#12c2d8'];
const AD_INFO={
  muro:{lbl:'Seu recado',ph:'FELIZ NIVER, JU!',reach:'~16 mil',ok:'O recado aparece no primeiro muro da praça já na sua próxima partida.'},
  outdoor:{lbl:'Nome do seu negócio',ph:'DOCERIA DA LIA',reach:'~48 mil',ok:'Seu outdoor ocupa o painel da praça central na sua próxima partida.'},
  fachada:{lbl:'Nome da sua loja',ph:'DOCERIA DA LIA',reach:'~110 mil',ok:'Sua loja vira um prédio da cidade e é o primeiro alvo do modo Corre Pra Loja quando você joga com bots.'},
};
let adKind='muro',adColor=0;
function openAds(){
  const saved=store.get('role_ad');
  if(saved){adKind=saved.kind;adColor=Math.max(0,AD_COLORS.indexOf(saved.color));$('#adText').value=saved.text}
  setKind(adKind);swatches($('#adSw'),AD_COLORS,()=>adColor,i=>{adColor=i;drawPrev()});$('#adOk').hidden=true;drawPrev();
}
function setKind(k){adKind=k;document.querySelectorAll('.opt').forEach(o=>o.setAttribute('aria-pressed',o.dataset.k===k?'true':'false'));
  const i=AD_INFO[k];$('#adLbl').textContent=i.lbl;$('#adText').placeholder=i.ph;$('#reach').textContent=i.reach;drawPrev()}
document.querySelectorAll('.opt').forEach(o=>o.addEventListener('click',()=>{setKind(o.dataset.k);$('#adOk').hidden=true}));
$('#adText').addEventListener('input',drawPrev);
function adTextVal(){return cleanChat($('#adText').value,24).toUpperCase()||AD_INFO[adKind].ph}
function drawPrev(){
  const c=$('#adPrev'),g=c.getContext('2d'),w=c.width,h=c.height,t=adTextVal(),col=AD_COLORS[adColor];
  g.setTransform(1,0,0,1,0,0);g.fillStyle='#3b4152';g.fillRect(0,0,w,h);
  g.save();g.scale(2,2);const W2=w/2,H2=h/2;
  if(adKind==='muro'){
    g.fillStyle='#e6dfd0';g.fillRect(0,0,W2,H2);
    g.fillStyle='rgba(0,0,0,.2)';g.fillRect(25,65,270,26);
    drawRecado(g,20,60,270,26,{t,c:col},11);g.strokeStyle='#1b1a22';g.lineWidth=2;g.strokeRect(20,60,270,26);
    miniGuy(g,90,120,'#2f6bff');miniGuy(g,210,40,'#ff4f8b');miniGuy(g,250,128,'#1fbf75');
  }else if(adKind==='outdoor'){
    g.fillStyle='#e6dfd0';g.fillRect(0,0,W2,H2);drawBoard(g,40,40,240,64,{brand:t,line:'sua frase aqui',bg:col,fg:inkOn(col)});
    miniGuy(g,70,135,'#ffd23f');miniGuy(g,250,128,'#9b5cff');
  }else{
    g.fillStyle='#cfc8bb';g.fillRect(0,0,W2,H2);g.fillStyle='#3b4152';g.fillRect(0,118,W2,42);
    g.fillStyle='#6d7fcc';g.fillRect(30,6,260,86);g.strokeStyle='#1b1a22';g.lineWidth=2;
    g.fillStyle=shade('#6d7fcc',.6);g.fillRect(30,92,260,26);drawLoja(g,30,92,260,26,{name:t,bg:col,fg:inkOn(col)});g.strokeRect(30,6,260,112);
    g.fillStyle='rgba(255,210,63,.45)';g.beginPath();g.arc(160,138,24,0,7);g.fill();
    miniGuy(g,140,140,'#ff4f8b');miniGuy(g,200,146,'#2f6bff');
  }
  g.restore();
}
function miniGuy(g,x,y,c){g.fillStyle=c;g.strokeStyle='#1b1a22';g.lineWidth=2.5;g.beginPath();g.arc(x,y,11,0,7);g.fill();g.stroke();
  g.fillStyle='#fff';g.beginPath();g.arc(x-4,y-2,3,0,7);g.arc(x+4,y-2,3,0,7);g.fill();g.fillStyle='#1b1a22';g.beginPath();g.arc(x-4,y-1,1.5,0,7);g.arc(x+4,y-1,1.5,0,7);g.fill()}
$('#adSend').addEventListener('click',()=>{
  const ad={kind:adKind,text:adTextVal(),color:AD_COLORS[adColor]};store.set('role_ad',ad);applyAd(world,ad);
  const ok=$('#adOk');ok.hidden=false;
  ok.textContent=`Recebido! Num lançamento real, o anúncio passaria por moderação e pagamento via Pix. Neste protótipo nada foi cobrado e só você vê o anúncio. ${AD_INFO[adKind].ok}`;
});

/* ================= início ================= */
document.fonts&&document.fonts.load(`16px ${DISPLAY}`).catch(()=>{});
document.fonts&&document.fonts.load(`16px ${MARKER}`).catch(()=>{});
showScreen('lobby');
requestAnimationFrame(t=>{last=t;frame(t)});
