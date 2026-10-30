import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {startServer,configFromEnv} from '../server/server.mjs';
import {buildWorld,Match,cleanChat,cleanName,botNames,ROOM} from '../public/game.mjs';

const cfg=o=>({...configFromEnv({}),port:0,trustProxy:false,...o});
function client(port,origin){
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const msgs=[],waiters=[];
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);msgs.push(m);
    for(const w of waiters.slice())if(w.f(m)){waiters.splice(waiters.indexOf(w),1);w.r(m)}});
  const wait=(f,ms=4000)=>new Promise((r,j)=>{const hit=msgs.find(f);if(hit)return r(hit);
    const w={f,r};waiters.push(w);setTimeout(()=>j(new Error('tempo esgotado esperando mensagem')),ms)});
  const open=new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j)});
  const send=o=>ws.send(JSON.stringify(o));
  return{ws,msgs,wait,open,send};
}

test('filtro do chat troca palavrões e links',()=>{
  assert.equal(cleanChat('que porra é essa www.spam.com kkk'),'que ★★★★★ é essa [link] kkk');
  assert.equal(cleanChat('  oi​   gente  '),'oi gente');
  assert.equal(cleanName('<Lu do 3ºB que é muito longo>'),'Lu do 3ºB qu');
});

test('nomes de bots não se repetem',()=>{
  const n=botNames(ROOM,['Bia']);
  assert.equal(new Set(n.map(x=>x.toLowerCase())).size,ROOM);
  assert.ok(!n.includes('Bia'));
});

test('uma partida de 50 vai até o resultado e quem entra ocupa o lugar de um bot',()=>{
  const m=new Match(buildWorld());m.fillBots();
  const me=m.addHuman('Luciano','#ff4f8b');
  assert.equal(m.players.length,ROOM);assert.equal(m.humans().length,1);
  m.startMatch();
  for(let i=0;i<8000&&m.phase!=='results';i++){m.step(1/30);m.ev.length=0}
  assert.equal(m.phase,'results');
  assert.equal(m.final.length,ROOM);
  assert.ok(m.final.some(f=>f.id===me.id));
  const beto=m.players.find(p=>p.bot);beto.name='Beto';
  const human=m.addHuman('beto','#2f6bff');
  assert.equal(m.players.filter(p=>p.name.toLowerCase()==='beto').length,1);
  assert.equal(human.name,'beto');
  m.humanLeft(human);
  m.humanLeft(me);
  assert.equal(m.humans().length,0);assert.equal(m.players.length,ROOM);
});

test('entrar, receber a sala e mover o boneco',async()=>{
  const s=await startServer(cfg({}));
  try{
    const a=client(s.port);await a.open;
    a.send({t:'hello',name:'Lu',c:1,vw:500,vh:900});
    const j=await a.wait(m=>m.t==='j');
    assert.ok(j.id>0);
    const ro=await a.wait(m=>m.t==='ro'&&m.l.some(p=>p[0]===j.id&&p[1]==='Lu'&&p[3]===0));
    assert.equal(ro.l.length,ROOM);
    const s1=await a.wait(m=>m.t==='s'&&m.me);
    for(let i=1;i<=20;i++)a.send({t:'i',s:i,x:1,y:0});
    const s2=await a.wait(m=>m.t==='s'&&m.ack>=10);
    assert.ok(s2.ack>=10);assert.ok(s1.me&&s2.me);
    a.ws.close();
  }finally{await s.close()}
});

test('duas pessoas caem na mesma sala',async()=>{
  const s=await startServer(cfg({}));
  try{
    const a=client(s.port),b=client(s.port);await a.open;await b.open;
    a.send({t:'hello',name:'Ana',c:0});const ja=await a.wait(m=>m.t==='j');
    b.send({t:'hello',name:'Beto',c:2});const jb=await b.wait(m=>m.t==='j');
    assert.equal(ja.room,jb.room);
    await b.wait(m=>m.t==='ro'&&m.l.filter(p=>p[3]===0).length===2);
    a.ws.close();b.ws.close();
  }finally{await s.close()}
});

test('com as salas lotadas, quem chega vai para a fila e entra quando abre vaga',async()=>{
  const s=await startServer(cfg({maxRooms:1,roomSize:2}));
  try{
    const a=client(s.port),b=client(s.port),c=client(s.port);await Promise.all([a.open,b.open,c.open]);
    a.send({t:'hello',name:'A'});await a.wait(m=>m.t==='j');
    b.send({t:'hello',name:'B'});await b.wait(m=>m.t==='j');
    c.send({t:'hello',name:'C'});
    const q=await c.wait(m=>m.t==='q');
    assert.equal(q.pos,1);
    await c.wait(m=>m.t==='s'&&m.fl>0);
    a.ws.close();
    const j=await c.wait(m=>m.t==='j'&&m.id>0);
    assert.ok(j.id>0);
    b.ws.close();c.ws.close();
  }finally{await s.close()}
});

test('o chat passa pelo filtro no servidor e tem limite de ritmo',async()=>{
  const s=await startServer(cfg({}));
  try{
    const a=client(s.port);await a.open;
    a.send({t:'hello',name:'Lu'});const j=await a.wait(m=>m.t==='j');
    a.send({t:'c',text:'que merda, entra em www.golpe.com'});
    a.send({t:'c',text:'segunda mensagem rápida demais'});
    const s1=await a.wait(m=>m.t==='s'&&m.e&&m.e.some(e=>e.t==='say'&&e.id===j.id));
    const said=s1.e.find(e=>e.t==='say'&&e.id===j.id).text;
    assert.equal(said,'que ★★★★★, entra em [link]');
    await new Promise(r=>setTimeout(r,500));
    assert.ok(!a.msgs.some(m=>m.e&&m.e.some(e=>e.t==='say'&&e.text.startsWith('segunda'))));
    a.ws.close();
  }finally{await s.close()}
});

test('recusa origem não autorizada e mensagens grandes demais',async()=>{
  const s=await startServer(cfg({origins:['https://role.close4us.com']}));
  try{
    const status=await new Promise(r=>{
      const req=http.request({host:'127.0.0.1',port:s.port,path:'/ws',headers:{Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':Buffer.alloc(16).toString('base64'),Origin:'https://outro-site.com'}});
      req.on('response',res=>r(res.statusCode));req.on('upgrade',()=>r(101));req.on('error',()=>r(0));req.end();
    });
    assert.equal(status,403);
    const a=client(s.port);await a.open;
    const closed=new Promise(r=>a.ws.addEventListener('close',e=>r(e.code)));
    a.send({t:'c',text:'x'.repeat(10000)});
    assert.equal(await closed,1009);
  }finally{await s.close()}
});
