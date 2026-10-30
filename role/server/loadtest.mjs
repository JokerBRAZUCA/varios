// Teste de carga: abre N conexões que andam, dão empurrão e conversam como jogadores.
// Uso: node role/server/loadtest.mjs [jogadores=200] [segundos=30] [url=ws://127.0.0.1:8090/ws]
// O servidor testado precisa aceitar várias conexões do mesmo IP (MAX_PER_IP alto).
const N=+(process.argv[2]||200),SECS=+(process.argv[3]||30),URL=process.argv[4]||'ws://127.0.0.1:8090/ws';
const health=URL.replace(/^ws/,'http').replace(/\/ws$/,'/healthz');
let open=0,failed=0,msgs=0,bytes=0,queued=0;
const socks=[];
for(let i=0;i<N;i++){
  setTimeout(()=>{
    const ws=new WebSocket(URL);let seq=0,timer=null,ang=Math.random()*6.28;
    ws.onopen=()=>{
      open++;ws.send(JSON.stringify({t:'hello',name:`carga${i}`,c:i%8,vw:500,vh:800}));
      timer=setInterval(()=>{
        ang+=(Math.random()-.5)*.6;
        ws.send(JSON.stringify({t:'i',s:++seq,x:+Math.cos(ang).toFixed(2),y:+Math.sin(ang).toFixed(2),d:Math.random()<.02?1:0}));
        if(Math.random()<.002)ws.send(JSON.stringify({t:'c',text:'gg kkkk'}));
      },1000/30);
    };
    ws.onmessage=e=>{msgs++;bytes+=e.data.length;if(e.data.startsWith('{"t":"q"'))queued++};
    ws.onerror=()=>{failed++};
    ws.onclose=()=>clearInterval(timer);
    socks.push(ws);
  },i*15);
}
const t0=Date.now();
const iv=setInterval(async()=>{
  const s=(Date.now()-t0)/1000;
  let h='';try{h=await (await fetch(health)).text()}catch{h='(healthz indisponível)'}
  console.log(`${s.toFixed(0)}s conectados=${open} falhas=${failed} recebidas/s por jogador=${(msgs/Math.max(1,open)/s).toFixed(1)} KB/s por jogador=${(bytes/1024/Math.max(1,open)/s).toFixed(1)} | ${h}`);
  if(s>=SECS){clearInterval(iv);for(const w of socks)try{w.close()}catch{};setTimeout(()=>process.exit(0),500)}
},5000);
