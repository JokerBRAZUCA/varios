// Servidor multiplayer do Rolê: salas de até 50 jogadores com bots completando as vagas,
// fila de espera quando todas as salas lotam e rodízio no fim de cada partida. Sem dependências.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {acceptUpgrade} from './ws.mjs';
import {buildWorld,Match,dash,cleanChat,cleanName,botNames,COLORS,REACTIONS,ROOM,RESULTS_TIME,clamp} from '../public/game.mjs';

const TICK=1/30,SNAP_EVERY=2,BOARD_EVERY=15,ROTATE_MAX=3;
const CODE_CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789',CODE_LEN=5;
export const normCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,CODE_LEN);
const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};

export function configFromEnv(env=process.env){
  return{
    port:+(env.PORT??8090),host:env.HOST||'127.0.0.1',
    maxRooms:+(env.MAX_ROOMS||50),roomSize:+(env.ROOM_SIZE||ROOM),maxPerIp:+(env.MAX_PER_IP||6),
    origins:(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),
    staticDir:env.STATIC_DIR||'',trustProxy:env.TRUST_PROXY!=='0',
  };
}

export function startServer(cfg){
  const world=buildWorld();
  const rooms=[],queue=[],clients=new Set(),perIp=new Map();
  const stats={tickMs:0,tickMax:0,bytesOut:0,msgsIn:0,started:Date.now()};
  let nextRoom=1,nextClient=1;

  const send=(c,o)=>{if(c.ws.closed)return;const s=JSON.stringify(o);stats.bytesOut+=s.length;c.ws.send(s)};
  const roster=m=>({t:'ro',l:m.players.map(p=>[p.id,p.name,p.color,p.bot?1:0])});
  const viewers=room=>[...room.conns,...room.specs];

  // Sala pública começa direto. Sala de amigos espera o anfitrião, com todo mundo andando pela cidade.
  function newRoom(priv=false){
    const m=new Match(world,{size:cfg.roomSize,auto:true});m.fillBots();
    const room={id:nextRoom++,m,conns:new Set(),specs:new Set(),idle:0,tick:0,dirty:new Set(),ev:[],rosterSent:-1,rot:null,
      priv,code:priv?newCode():null,host:null,waiting:priv};
    m.hooks.onResults=()=>planRotation(room);
    m.hooks.beforeNext=()=>applyRotation(room);
    if(!priv)m.startMatch();
    rooms.push(room);return room;
  }
  function newCode(){
    for(;;){let c='';for(let i=0;i<CODE_LEN;i++)c+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];
      if(!rooms.some(r=>r.code===c))return c}
  }
  function sendLobby(room){
    if(!room.priv)return;
    const people=[...room.conns].map(c=>c.name);
    for(const c of room.conns)send(c,{t:'lob',code:room.code,host:c===room.host,people,waiting:room.waiting,size:cfg.roomSize});
  }
  // Prefere a sala com mais gente, para as pessoas se encontrarem.
  function pickRoom(){
    let best=null;
    for(const r of rooms)if(!r.priv&&r.conns.size<cfg.roomSize&&(!best||r.conns.size>best.conns.size))best=r;
    if(best)return best;
    return rooms.length<cfg.maxRooms?newRoom():null;
  }
  function join(c,room){
    if(c.room)c.room.specs.delete(c);
    c.room=room;c.player=room.m.addHuman(c.name,c.color);c.inputs=[];c.ack=0;c.qpos=0;room.conns.add(c);c.fullTiles=false;
    send(c,{t:'j',id:c.player.id,room:room.id,size:cfg.roomSize,tiles:Array.from(room.m.tileOwner)});
    send(c,roster(room.m));
  }
  function spectate(c){
    let best=null;for(const r of rooms)if(!r.priv&&(!best||r.conns.size>best.conns.size))best=r;
    if(c.room!==best){if(c.room)c.room.specs.delete(c);c.room=best;if(best){best.specs.add(c);send(c,{t:'j',id:0,room:best.id,size:cfg.roomSize,tiles:Array.from(best.m.tileOwner)});send(c,roster(best.m))}}
  }
  function leave(c){
    const room=c.room;
    if(room){
      if(c.player&&room.conns.has(c)){room.m.humanLeft(c.player);room.conns.delete(c)}
      room.specs.delete(c);
      if(room.priv){if(room.host===c)room.host=room.conns.values().next().value||null;sendLobby(room)}
    }
    const qi=queue.indexOf(c);if(qi>=0)queue.splice(qi,1);
    c.player=null;c.room=null;
    admit();
  }
  function admit(){
    while(queue.length){const room=pickRoom();if(!room)break;join(queue.shift(),room)}
    queue.forEach((c,i)=>{if(c.qpos!==i+1){c.qpos=i+1;spectate(c);send(c,{t:'q',pos:i+1,total:queue.length,room:c.room?.id||0})}});
  }
  // No fim da partida, quem ficou por último dá a vez a quem está na fila.
  function planRotation(room){
    const m=room.m,k=room.priv?0:Math.min(ROTATE_MAX,queue.length,room.conns.size);
    if(k>0){
      const byRank=m.final.map(f=>f.id),humans=[...room.conns].sort((a,b)=>byRank.indexOf(b.player.id)-byRank.indexOf(a.player.id));
      room.rot={humans:humans.slice(0,k),out:humans.slice(0,k).map(c=>c.name),in:queue.slice(0,k).map(c=>c.name)};
    }else{
      const out=m.final.map(f=>m.byId.get(f.id)).filter(p=>p.bot).slice(-ROTATE_MAX);
      room.rot={bots:out,out:out.map(p=>p.name),in:botNames(out.length,m.players.map(p=>p.name))};
    }
    sendResults(room);
  }
  function applyRotation(room){
    const rot=room.rot;room.rot=null;if(!rot)return;
    if(rot.bots){rot.bots.forEach((p,i)=>{if(p.bot)p.name=rot.in[i]});room.m.rosterV++;return}
    for(const c of rot.humans){
      if(!room.conns.has(c))continue;
      room.m.humanLeft(c.player);room.conns.delete(c);c.player=null;c.qpos=0;
      queue.push(c);room.specs.add(c);
      send(c,{t:'q',pos:queue.length,total:queue.length,room:room.id,rotated:true});
    }
    admit();
  }
  function sendResults(room){
    const m=room.m,n=m.final.length;
    const top=m.final.slice(0,8).map(f=>{const p=m.byId.get(f.id);return[p.id,p.name,p.color,p.bot?1:0,f.total]});
    for(const c of viewers(room)){
      const i=c.player?m.final.findIndex(f=>f.id===c.player.id):-1;
      send(c,{t:'res',top,me:i>=0?[i+1,m.final[i].total]:null,n,rot:{out:room.rot.out,in:room.rot.in},next:RESULTS_TIME,q:queue.length,
        rotated:!!(room.rot.humans&&room.rot.humans.includes(c))});
    }
  }
  function sendRoundEnd(room){
    const r=room.m.lastRound,top=r.slice(0,3).map(x=>[x.id,x.score]);
    for(const c of viewers(room)){const i=c.player?r.findIndex(x=>x.id===c.player.id):-1;
      send(c,{t:'rend',top,me:i>=0?[i+1,r[i].score]:null,n:r.length,mk:room.m.modeKey})}
  }
  function sendBoards(room){
    const ranked=room.m.ranking(),idx=new Map(ranked.map((p,i)=>[p.id,i]));
    const top=ranked.slice(0,3).map(p=>[p.id,Math.max(0,Math.floor(p.score))]);
    for(const c of viewers(room)){const p=c.player;
      send(c,{t:'b',top,r:p?idx.get(p.id)+1:0,s:p?Math.max(0,Math.floor(p.score)):0,n:ranked.length})}
  }
  const involves=(e,id)=>id&&(e.id===id||e.v===id||e.a===id||e.to===id||e.from===id);
  function sendSnaps(room){
    const m=room.m;
    if(m.rosterV!==room.rosterSent){room.rosterSent=m.rosterV;const ro=roster(m);for(const c of viewers(room))send(c,ro)}
    const td=room.dirty.size?[...room.dirty].map(i=>[i,m.tileOwner[i]]):null;room.dirty.clear();
    const ev=room.ev;room.ev=[];
    const bo=m.phase==='play'&&m.modeKey==='batata'&&m.ms.bombs?m.ms.bombs.filter(b=>b.holder).map(b=>[b.holder.id,+b.fuse.toFixed(1),b.holder.x|0,b.holder.y|0]):null;
    const tg=m.phase==='play'&&m.modeKey==='corre'?m.ms.target:-1;
    const tup=m.players.map(p=>[p.id,p.x|0,p.y|0,p.vx|0,p.vy|0,(p.stun>0?1:0)|(p.dashT>0?2:0)|(p.arrived?4:0),Math.round(Math.atan2(p.lookY,p.lookX)*100)]);
    const lead=m.leader||m.players[0];
    const base={t:'s',st:Date.now(),ph:m.phase,pt:+m.phaseT.toFixed(2),tl:+m.timeLeft.toFixed(2),ri:m.roundIdx,mk:m.modeKey,tg,bo,q:queue.length,h:room.conns.size};
    for(const c of viewers(room)){
      if(c.ws.buffered>2e6){c.ws.terminate();continue}
      if(c.ws.buffered>256e3){c.fullTiles=true;continue}
      const p=c.player,f=p||lead,id=p?p.id:0;
      const list=[];for(const t of tup)if(t[0]!==id&&Math.abs(t[1]-f.x)<c.ax&&Math.abs(t[2]-f.y)<c.ay)list.push(t);
      const evs=ev.filter(e=>e.x===undefined||involves(e,id)||(Math.abs(e.x-f.x)<c.ax+200&&Math.abs(e.y-f.y)<c.ay+200));
      const o={...base,p:list,ack:c.ack};
      if(evs.length)o.e=evs;
      if(c.fullTiles){o.ta=Array.from(m.tileOwner);c.fullTiles=false}else if(td)o.td=td;
      if(p)o.me=[p.x|0,p.y|0,p.vx|0,p.vy|0,p.stun*100|0,p.dashT*100|0,p.dashCd*100|0,p.knockImm*100|0,(p.arrived?4:0),p.passCd*100|0];
      else o.fl=lead.id;
      send(c,o);
    }
  }
  function tick(){
    const t0=performance.now();
    for(const room of rooms){
      if(!room.conns.size&&!room.specs.size){room.idle+=TICK;continue}
      room.idle=0;const m=room.m;
      for(const c of room.conns){
        const q=c.inputs;if(q.length>6)q.splice(0,q.length-2);
        const i=q.shift();if(!i)continue;
        c.player.input={x:i.x,y:i.y};c.ack=i.s;
        if(i.d&&m.phase==='play')dash(c.player,m);
      }
      m.step(TICK);
      for(const e of m.ev){
        if(e.t==='paint'){room.dirty.add(e.i);continue}
        if(e.t==='rend')sendRoundEnd(room);
        room.ev.push(e);
      }
      m.ev.length=0;
      room.tick++;
      if(room.tick%SNAP_EVERY===0)sendSnaps(room);
      if(room.tick%BOARD_EVERY===0)sendBoards(room);
    }
    for(let i=rooms.length-1;i>=0;i--)if(rooms[i].idle>60)rooms.splice(i,1);
    const ms=performance.now()-t0;stats.tickMs=stats.tickMs*.95+ms*.05;stats.tickMax=Math.max(stats.tickMax*.999,ms);
  }

  function onMessage(c,raw){
    stats.msgsIn++;
    const now=performance.now();c.tokens=Math.min(60,c.tokens+(now-c.tokT)/1000*45);c.tokT=now;
    if(--c.tokens<0)return c.ws.close(1008);
    let msg;try{msg=JSON.parse(raw)}catch{return}
    if(!msg||typeof msg!=='object')return;
    const num=(v,a,b)=>Number.isFinite(+v)?clamp(+v,a,b):0;
    switch(msg.t){
      case 'hello':{
        if(c.name)return;
        c.name=cleanName(msg.name)||'Visitante';c.color=COLORS[num(msg.c,0,COLORS.length-1)|0];
        view(c,msg);send(c,{t:'hi',cid:c.id});
        if(msg.mode==='new'){
          if(rooms.length>=cfg.maxRooms)return send(c,{t:'err',e:'busy'});
          const room=newRoom(true);join(c,room);room.host=c;sendLobby(room);
        }else if(msg.mode==='join'){
          const code=normCode(msg.code),room=rooms.find(r=>r.priv&&r.code===code);
          if(!room)return send(c,{t:'err',e:'code',code});
          if(room.conns.size>=cfg.roomSize)return send(c,{t:'err',e:'full',code});
          join(c,room);sendLobby(room);
        }else{
          const room=pickRoom();
          if(room&&!queue.length)join(c,room);else{queue.push(c);admit()}
        }
        break;
      }
      case 'start':{
        const room=c.room;
        if(!room||!room.priv||room.host!==c||!room.waiting)return;
        room.waiting=false;room.m.startMatch();sendLobby(room);
        break;
      }
      case 'i':{
        if(!c.player)return;
        c.inputs.push({s:msg.s|0,x:num(msg.x,-1,1),y:num(msg.y,-1,1),d:msg.d?1:0});
        if(c.inputs.length>30)c.inputs.splice(0,c.inputs.length-30);
        break;
      }
      case 'c':{
        if(!c.room||now-c.lastChat<1200)return;
        const text=cleanChat(msg.text);if(!text)return;c.lastChat=now;
        if(c.player)c.room.m.humanSay(c.player,text);else c.room.ev.push({t:'fila',who:c.name,text});
        break;
      }
      case 'r':{
        if(!c.room||!REACTIONS.includes(msg.r)||now-c.lastReact<500)return;c.lastReact=now;
        c.room.ev.push({t:'react',r:msg.r,who:c.name,id:c.player?.id||0});
        break;
      }
      case 'v':view(c,msg);break;
      case 'ping':send(c,{t:'pong',c:msg.c});break;
    }
  }
  function view(c,msg){
    c.ax=clamp((+msg.vw||900)/2+220,420,1400);c.ay=clamp((+msg.vh||1400)/2+220,420,1400);
  }

  const root=cfg.staticDir?path.resolve(cfg.staticDir):'';
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://x');
    if(url.pathname==='/healthz'){
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      res.end(JSON.stringify({rooms:rooms.length,friendRooms:rooms.filter(r=>r.priv).length,players:[...clients].filter(c=>c.player).length,queue:queue.length,connections:clients.size,
        maxRooms:cfg.maxRooms,roomSize:cfg.roomSize,tickMs:+stats.tickMs.toFixed(2),tickMaxMs:+stats.tickMax.toFixed(2),
        kbOutPerSec:+(stats.bytesOut/1024/((Date.now()-stats.started)/1000)).toFixed(1),uptimeS:Math.round((Date.now()-stats.started)/1000)}));
      return;
    }
    if(!root||req.method!=='GET'){res.writeHead(404).end();return}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
    try{const data=await readFile(file);res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream'});res.end(data)}
    catch{res.writeHead(404).end()}
  });
  server.on('upgrade',(req,socket)=>{
    if(new URL(req.url,'http://x').pathname!=='/ws'){socket.destroy();return}
    const fwd=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
    const loop=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(socket.remoteAddress);
    const ip=cfg.trustProxy&&loop&&fwd?fwd:socket.remoteAddress;
    if((perIp.get(ip)||0)>=cfg.maxPerIp){socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');return}
    const ws=acceptUpgrade(req,socket,{origins:cfg.origins.length?cfg.origins:null});
    if(!ws)return;
    perIp.set(ip,(perIp.get(ip)||0)+1);
    const c={id:nextClient++,ws,ip,name:'',room:null,player:null,inputs:[],ack:0,tokens:60,tokT:performance.now(),lastChat:-1e9,lastReact:-1e9,ax:900,ay:900,qpos:0};
    clients.add(c);
    ws.on('message',raw=>onMessage(c,raw));
    ws.on('close',()=>{
      if(!clients.delete(c))return;
      const n=(perIp.get(ip)||1)-1;if(n>0)perIp.set(ip,n);else perIp.delete(ip);
      leave(c);
    });
  });

  // Passo fixo de 1/30 s, compensando atrasos do relógio.
  let next=performance.now(),timer=null,stopped=false;
  const loop=()=>{if(stopped)return;const now=performance.now();let n=0;while(now>=next&&n<5){tick();next+=TICK*1000;n++}if(now>=next)next=now+TICK*1000;timer=setTimeout(loop,Math.max(0,next-performance.now()))};
  loop();
  const hb=setInterval(()=>{const t=Date.now();for(const c of clients){if(t-c.ws.lastSeen>45000)c.ws.terminate();else c.ws.ping()}},15000);

  return new Promise(resolve=>server.listen(cfg.port,cfg.host,()=>resolve({
    server,port:server.address().port,stats,rooms,queue,
    close(){stopped=true;clearTimeout(timer);clearInterval(hb);for(const c of clients)c.ws.close(1001);return new Promise(r=>server.close(()=>r()))},
  })));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const cfg=configFromEnv();
  if(process.argv.includes('--dev'))cfg.staticDir=cfg.staticDir||path.join(path.dirname(fileURLToPath(import.meta.url)),'../public');
  const s=await startServer(cfg);
  console.log(`Rolê ouvindo em http://${cfg.host}:${s.port} (salas: até ${cfg.maxRooms} de ${cfg.roomSize}${cfg.staticDir?', servindo arquivos estáticos':''})`);
  const stop=async()=>{await s.close();process.exit(0)};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
