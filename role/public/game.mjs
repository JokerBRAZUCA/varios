// Rolê: lógica do jogo compartilhada entre o servidor multiplayer, o modo offline
// do navegador e a previsão de movimento do próprio boneco. Não usa DOM.

export const ROOM=15,ROUND_TIME=60,ROUNDS=3,INTRO_TIME=3.6,ROUND_END_TIME=3.2,RESULTS_TIME=12;
export const BC=4,BR=5,BS=288,ST=128,M=64,FRONT=26,CELL=32;
export const W=M*2+BC*BS+(BC-1)*ST,H=M*2+BR*BS+(BR-1)*ST;
export const MAXS=190,DASH=540,DASH_CD=1.1,PR=14;

export const rand=(a,b)=>a+Math.random()*(b-a);
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const pick=a=>a[Math.floor(Math.random()*a.length)];
export const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export function seeded(s){return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646}}
export function inkOn(hex){const n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return(r*299+g*587+b*114)/1000>150?'#1b1a22':'#ffffff'}

/* ================= conteúdo (anúncios de exemplo, negócios fictícios) ================= */
export const COLORS=['#ff4f8b','#2f6bff','#ffd23f','#1fbf75','#ff8a1f','#9b5cff','#12c2d8','#a6e22e'];
export const LOJAS=[
 {name:'PADARIA PÃO QUENTE',bg:'#f4a259',fg:'#3b1f0a'},
 {name:'AÇAÍ DO BAIRRO',bg:'#6a2c91',fg:'#f7e8ff'},
 {name:'BARBEARIA NAVALHA',bg:'#f1f1f1',fg:'#c1121f'},
 {name:'PIZZARIA FORNO VELHO',bg:'#2d6a4f',fg:'#ffe8a3'},
 {name:'PET SHOP AU AU',bg:'#48cae4',fg:'#03045e'},
 {name:'ACADEMIA FÔLEGO',bg:'#151515',fg:'#ffd23f'},
 {name:'SORVETERIA POLAR',bg:'#ffc8dd',fg:'#7b2cbf'},
 {name:'ÓTICA OLHO VIVO',bg:'#ffffff',fg:'#1d3557'},
 {name:'MERCADINHO DA ESQUINA',bg:'#e63946',fg:'#ffffff'},
 {name:'LAVA RÁPIDO BRILHO',bg:'#0077b6',fg:'#caf0f8'},
 {name:'PASTEL DA FEIRA',bg:'#ffb703',fg:'#5a189a'},
 {name:'BORRACHARIA DO TONHO',bg:'#343a40',fg:'#ff8a1f'},
 {name:'FARMÁCIA SAÚDE JÁ',bg:'#2a9d8f',fg:'#ffffff'},
 {name:'HAMBURGUERIA BRASA',bg:'#9d0208',fg:'#ffba08'},
 {name:'PAPELARIA DO BAIRRO',bg:'#bde0fe',fg:'#023047'},
 {name:'SALÃO DIVA',bg:'#ff70a6',fg:'#ffffff'},
 {name:'BAR DO BIRA',bg:'#5c3d2e',fg:'#ffd166'},
 {name:'CHAVEIRO RÁPIDO',bg:'#ffd166',fg:'#1b1a22'},
 {name:'FLORICULTURA IPÊ',bg:'#ffafcc',fg:'#386641'},
 {name:'SACOLÃO VERDINHO',bg:'#6a994e',fg:'#f2e8cf'},
 {name:'ASSISTÊNCIA CELULAR',bg:'#14213d',fg:'#fca311'},
 {name:'DOCERIA DA VÓ',bg:'#fde4cf',fg:'#9a031e'},
 {name:'ESCOLA DE INGLÊS GO',bg:'#3a86ff',fg:'#ffffff'},
 {name:'LANCHONETE ESQUINA',bg:'#fb8500',fg:'#ffffff'},
];
export const OUTDOORS=[
 {brand:'AÇAÍ DO BAIRRO',line:'2 copos por R$ 20',bg:'#6a2c91',fg:'#ffffff'},
 {brand:'ACADEMIA FÔLEGO',line:'1º mês grátis',bg:'#151515',fg:'#ffd23f'},
 {brand:'PIZZARIA FORNO VELHO',line:'peça pelo zap',bg:'#2d6a4f',fg:'#ffe8a3'},
 {brand:'HAMBURGUERIA BRASA',line:'combo em dobro às terças',bg:'#9d0208',fg:'#ffba08'},
 {brand:'ESCOLA DE INGLÊS GO',line:'aula grátis, chama no zap',bg:'#3a86ff',fg:'#ffffff'},
];
export const PLAZA_AD={brand:'SEU ANÚNCIO AQUI',line:'a partir de R$ 49 por dia',bg:'#ffd23f',fg:'#1b1a22'};
export const RECADOS=[
 {t:'FELIZ NIVER, JU!',c:'#ff4f8b'},{t:'ANA, CASA COMIGO?',c:'#e63946'},{t:'SIGA @DUDA.ARTE',c:'#2f6bff'},
 {t:'3ºB É O MAIOR',c:'#1fbf75'},{t:'VOLTA, MARQUINHOS',c:'#9b5cff'},{t:'MÃE, TE AMO',c:'#ff8a1f'},
 {t:'BOM DIA, VIZINHO!',c:'#12c2d8'},{t:'PAULA + LÉO',c:'#ff4f8b'},
 {t:'FORMATURA 2026!',c:'#ffd23f'},{t:'SAUDADE, VÔ',c:'#12c2d8'},{t:'TIME DO ZÉ É FOGO',c:'#ff8a1f'},
 {t:'CHAMA NO PV @LARIX',c:'#9b5cff'},{t:'BEM-VINDA, LIZ!',c:'#ff4f8b'},{t:'VAI CORINGÃO? KKK',c:'#1fbf75'},
];
export const NAMES=['Bia','Rafa','Duda','Caio','Lelê','Tiago','Mari','Juninho','Nina','Gabi','Pedrão','Lu','Vini','Carol','Zé','Teté','Kaká','Dani','Léo','Ju','Fer','Gui','Malu','Davi','Iza','Thi','Babi','Nico','Lari','Biel','Manu','Rô','Dudu','Paty','Jão','Lili','Beto','Cacá','Mel','Tati'];
export function botNames(n,avoid){
  const used=new Set(avoid.map(x=>x.toLowerCase())),out=[];
  for(const x of shuffle(NAMES.slice())){if(out.length>=n)break;if(!used.has(x.toLowerCase())){out.push(x);used.add(x.toLowerCase())}}
  while(out.length<n){const x=pick(NAMES)+pick(['_','.','',''])+pick(['22','07','BR','zin','01','10','99','x','gamer','2k']);
    if(!used.has(x.toLowerCase())){out.push(x);used.add(x.toLowerCase())}}
  return out;
}
export const botColor=i=>`hsl(${Math.round(i*137.5)%360},78%,58%)`;

/* ================= chat ================= */
export const ZOEIRA={
  knockA:['SAI DA FRENTE!','foi mal kkkk','tchau 👋','vem tranquilo','ISSO É CHÃO','nem vi você aí'],
  knockV:['ei!!','covardia 😤','vou lembrar disso','me empurrou??','kkkk ok','tá bom então','revanche!'],
  boomH:['NÃÃÃO','era pra ter passado 😭','morri kkkk','eu tava quase!','alguém anotou a placa?'],
  boomO:['KKKKKKK','voou longe','BUM 💥','rip','essa doeu','print!!'],
  passA:['toma!','presente pra você 🎁','é tua agora','fica com Deus'],
  passV:['NÃO','volta aqui!!','sério?','ah não 😭','quem pediu??'],
  picha:['esse muro é meu','pichei por cima kkk','arte moderna 🎨','assinado: eu'],
  first:['PRIMEIRO!!','chegueeei','lentos demais','tem desconto pra quem chega em 1º?'],
  target:['onde fica isso??','bora!!','tô perdido kkk','sigam-me','é do lado da praça?'],
  win:['GG 😎','ganhei, aceitem','tudo pato 🦆','seus ruins','HAHAHAHAHA','já era','valeu, valeu','respeita'],
  lose:['roubado','lag','próxima eu ganho','foi o controle','gg','valeu','revanche!'],
  lead:['tudo pato 🦆','seus ruins','HAHAHAHAHA','já era','gg','valeu, valeu','ninguém me pega','alguém me para?','cadê vocês? kkk','obrigado pela participação'],
  leadEnd:['JÁ ERA','gg, valeu','pode desligar','tudo pato 🦆','HAHAHAHAHA'],
  lostLead:['NÃO','volta aqui!!','foi sorte','ainda dá','tava de boa…'],
  chase:['alguém para o {L}!','{L} tá roubando','todo mundo no {L}!','calma, {L}','ainda não acabou, {L}','{L} se achando kkk'],
  answerBrag:['calma aí','vai ver só','humilde, hein','print pra cobrar depois','ainda não acabou','convencido kkk'],
  idle:['alguém joga sério aqui?','quem é o rosa? 👀','manda o link pros amigos','esse mapa é enorme','gg','que zona kkkk','quem é a Ju?','ANA RESPONDE O CARA','Marquinhos volta pfv','alguém viu a padaria?'],
  reply:['kkkkk','verdade','fala sério','quem é você? kkk','concordo','📸 printei','isso aí'],
  fila:['me deixa entrar!!','próxima sou eu','👀','bora logo','assistindo de camarote'],
};
export const QUICK=['KKKKKKK','sai da frente!','vem tranquilo','gg','covardia!','vou pichar tudo','ainda dá!','bora mais uma'];
export const QUICK_LEAD=['tudo pato 🦆','seus ruins','HAHAHAHAHA','já era','gg','valeu, valeu','ninguém me pega','alguém me para?'];
export const REACTIONS=['😂','🔥','😱','👏','💀','🤣'];
const BRAG=new Set(QUICK_LEAD.concat(ZOEIRA.lead).map(t=>t.toLowerCase()));
const BAD=['porra','caralho','merda','puta','fdp','buceta','arrombad','viado','bicha','macaco','corno','piroca','vagabund','cuzao','foder','fuder','transa','nude','pinto','xoxota','punheta','retardad'];
const fold=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
export function cleanChat(t,max=60){
  t=String(t??'').normalize('NFC').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
  t=t.replace(/(https?:\/\/|www\.)\S*/gi,'[link]').replace(/\b\S+\.(com|net|org|br|io|gg|app|xyz)\S*/gi,'[link]');
  const low=fold(t);let out=t;
  if(low.length===t.length)for(const w of BAD){let i=low.indexOf(w);while(i>=0){out=out.slice(0,i)+'★'.repeat(w.length)+out.slice(i+w.length);i=low.indexOf(w,i+w.length)}}
  return out;
}
export function cleanName(t){return cleanChat(String(t??'').replace(/[\[\]<>]/g,''),12).trim()}

/* ================= cidade ================= */
const PATS=['h','full','v','v','h','h','v','full','h','v','h','v','full'];
const ROOFS=['#e07a5f','#81b29a','#f2cc8f','#6d7fcc','#c98bb9','#9fb8ad','#d4a373','#7aa6c2'];
const BK=128;
export function buildWorld(){
  const w={blocks:[],buildings:[],muros:[],rects:[],circles:[],tiles:[],billboard:null,
    plaza:{x:M+1*(BS+ST),y:M+2*(BS+ST),w:BS,h:BS*2+ST},fields:new Map()};
  const isPlaza=(r,c)=>c===1&&(r===2||r===3);
  let li=0,ri=0,oi=0;
  for(let r=0;r<BR;r++)for(let c=0;c<BC;c++){
    if(isPlaza(r,c))continue;
    const x=M+c*(BS+ST),y=M+r*(BS+ST),p=PATS[(r*BC+c)%PATS.length];
    w.blocks.push({x,y,w:BS,h:BS});
    const parts=p==='full'?[[x,y,BS,BS]]:p==='h'?[[x,y,124,BS],[x+164,y,124,BS]]:[[x,y,BS,124],[x,y+164,BS,124]];
    for(const [bx,by,bw,bh] of parts){
      const i=w.buildings.length;
      const b={x:bx,y:by,w:bw,h:bh,roof:ROOFS[i%ROOFS.length],rng:seeded(i*97+13)};
      if(i%3===2||li>=LOJAS.length){if(ri<RECADOS.length-3)b.recado=RECADOS[ri++];else if(li<LOJAS.length)b.loja=LOJAS[li++]}else{b.loja=LOJAS[li++]}
      if(p==='full'){b.outdoor=OUTDOORS[oi++%OUTDOORS.length]}
      b.door={x:bx+bw/2,y:by+bh+20};
      b.deco=[];for(let k=0;k<4;k++)b.deco.push({x:b.rng(),y:b.rng(),s:b.rng()});
      w.buildings.push(b);w.rects.push(b);
      const n=Math.max(3,Math.round(bw/36)),tw=bw/n;
      for(let k=0;k<n;k++)w.tiles.push({x:bx+k*tw,y:by+bh-FRONT,w:tw,h:FRONT,stands:[{x:bx+k*tw+tw/2,y:by+bh+16}]});
    }
  }
  const px=w.plaza.x,py=w.plaza.y;
  [py+80,py+330,py+560].forEach((yy,k)=>{
    const m={x:px+24,y:yy,w:240,h:18,recado:RECADOS[(ri+k)%RECADOS.length],muro:true};
    w.muros.push(m);w.rects.push(m);
    const n=7,tw=m.w/n;
    for(let j=0;j<n;j++)w.tiles.push({x:m.x+j*tw,y:m.y,w:tw,h:m.h,stands:[{x:m.x+j*tw+tw/2,y:m.y-16},{x:m.x+j*tw+tw/2,y:m.y+m.h+16}]});
  });
  w.circles.push({x:px+BS/2,y:py+215,r:42,fountain:true});
  w.circles.push({x:px+34,y:py+448,r:20,tree:true},{x:px+BS-34,y:py+448,r:20,tree:true},{x:px+34,y:py+660,r:20,tree:true},{x:px+BS-34,y:py+660,r:20,tree:true});
  w.billboard={x:px+54,y:py+440,w:180,h:44,ad:PLAZA_AD,board:true};
  w.rects.push(w.billboard);
  const lojaIdx=w.buildings.findIndex(b=>b.loja);
  w.defaults={muro:w.muros[0].recado,board:w.billboard.ad,lojaIdx,loja:w.buildings[lojaIdx].loja};
  // grade de caminhos
  w.COLS=Math.ceil(W/CELL);w.ROWS=Math.ceil(H/CELL);w.N=w.COLS*w.ROWS;w.blocked=new Uint8Array(w.N);
  for(let cy=0;cy<w.ROWS;cy++)for(let cx=0;cx<w.COLS;cx++){
    const x=cx*CELL+CELL/2,y=cy*CELL+CELL/2;let b=x>W-12||y>H-12;
    for(const r of w.rects)if(x>r.x-10&&x<r.x+r.w+10&&y>r.y-10&&y<r.y+r.h+10){b=true;break}
    for(const c of w.circles)if(Math.hypot(x-c.x,y-c.y)<c.r+10){b=true;break}
    w.blocked[cy*w.COLS+cx]=b?1:0;
  }
  // baldes espaciais para colisões e pichação
  w.bcols=Math.ceil(W/BK);w.brows=Math.ceil(H/BK);
  w.rectB=buckets(w,w.rects,24);w.tileB=buckets(w,w.tiles,24);
  return w;
}
function buckets(w,list,pad){
  const B=Array.from({length:w.bcols*w.brows},()=>[]);
  list.forEach((r,i)=>{
    const x0=clamp(Math.floor((r.x-pad)/BK),0,w.bcols-1),x1=clamp(Math.floor((r.x+r.w+pad)/BK),0,w.bcols-1);
    const y0=clamp(Math.floor((r.y-pad)/BK),0,w.brows-1),y1=clamp(Math.floor((r.y+r.h+pad)/BK),0,w.brows-1);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)B[y*w.bcols+x].push(i);
  });
  return B;
}
const bucketAt=(w,x,y)=>clamp(Math.floor(y/BK),0,w.brows-1)*w.bcols+clamp(Math.floor(x/BK),0,w.bcols-1);

// Anúncio comprado na tela de demonstração; só altera a cidade de quem comprou.
export function applyAd(w,ad){
  w.muros[0].recado=w.defaults.muro;w.billboard.ad=w.defaults.board;w.buildings[w.defaults.lojaIdx].loja=w.defaults.loja;
  if(!ad||!ad.text)return;
  if(ad.kind==='muro')w.muros[0].recado={t:ad.text,c:ad.color,mine:true};
  else if(ad.kind==='outdoor')w.billboard.ad={brand:ad.text,line:'anúncio aprovado',bg:ad.color,fg:inkOn(ad.color),mine:true};
  else if(ad.kind==='fachada')w.buildings[w.defaults.lojaIdx].loja={name:ad.text,bg:ad.color,fg:inkOn(ad.color),mine:true};
}

/* ================= caminhos ================= */
export const cellOf=(w,x,y)=>clamp(Math.floor(y/CELL),0,w.ROWS-1)*w.COLS+clamp(Math.floor(x/CELL),0,w.COLS-1);
function freeCellNear(w,ci){
  if(!w.blocked[ci])return ci;
  const cx=ci%w.COLS,cy=(ci/w.COLS)|0;
  for(let rr=1;rr<6;rr++)for(let dy=-rr;dy<=rr;dy++)for(let dx=-rr;dx<=rr;dx++){
    const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=w.COLS||ny>=w.ROWS)continue;
    const n=ny*w.COLS+nx;if(!w.blocked[n])return n;
  }
  return ci;
}
function field(w,tc){
  tc=freeCellNear(w,tc);
  let f=w.fields.get(tc);if(f)return f;
  if(w.fields.size>600)w.fields.clear();
  const{COLS,ROWS,N,blocked}=w;
  f=new Int16Array(N).fill(-1);const q=new Int32Array(N);let h=0,t=0;f[tc]=0;q[t++]=tc;
  while(h<t){const c=q[h++],cx=c%COLS,cy=(c/COLS)|0,d=f[c]+1;
    if(cx>0&&!blocked[c-1]&&f[c-1]<0){f[c-1]=d;q[t++]=c-1}
    if(cx<COLS-1&&!blocked[c+1]&&f[c+1]<0){f[c+1]=d;q[t++]=c+1}
    if(cy>0&&!blocked[c-COLS]&&f[c-COLS]<0){f[c-COLS]=d;q[t++]=c-COLS}
    if(cy<ROWS-1&&!blocked[c+COLS]&&f[c+COLS]<0){f[c+COLS]=d;q[t++]=c+COLS}}
  w.fields.set(tc,f);return f;
}
const NB=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
function neighborBy(w,f,ci,better){
  const cx=ci%w.COLS,cy=(ci/w.COLS)|0;let best=-1,bv=f[ci];
  for(const [dx,dy] of NB){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=w.COLS||ny>=w.ROWS)continue;
    const n=ny*w.COLS+nx;if(f[n]<0)continue;
    if(dx&&dy&&(w.blocked[cy*w.COLS+nx]||w.blocked[ny*w.COLS+cx]))continue;
    if(bv<0||better(f[n],bv)){bv=f[n];best=n}}
  return best;
}
function dirTo(w,p,gx,gy){
  const dx=gx-p.x,dy=gy-p.y,d=Math.hypot(dx,dy)||1;
  const f=field(w,cellOf(w,gx,gy)),ci=cellOf(w,p.x,p.y);
  if(d<CELL*1.6||f[ci]===0)return[dx/d,dy/d];
  const n=neighborBy(w,f,ci,(a,b)=>a<b);
  if(n<0)return[dx/d,dy/d];
  const tx=(n%w.COLS)*CELL+CELL/2-p.x,ty=((n/w.COLS)|0)*CELL+CELL/2-p.y,td=Math.hypot(tx,ty)||1;
  return[tx/td,ty/td];
}
function dirAway(w,p,from){
  const f=field(w,cellOf(w,from.x,from.y)),ci=cellOf(w,p.x,p.y);
  const n=neighborBy(w,f,ci,(a,b)=>a>b);
  let ax=p.x-from.x,ay=p.y-from.y;const ad=Math.hypot(ax,ay)||1;ax/=ad;ay/=ad;
  if(n<0)return[ax,ay];
  let tx=(n%w.COLS)*CELL+CELL/2-p.x,ty=((n/w.COLS)|0)*CELL+CELL/2-p.y;const td=Math.hypot(tx,ty)||1;
  tx=tx/td+ax*.5;ty=ty/td+ay*.5;const m=Math.hypot(tx,ty)||1;return[tx/m,ty/m];
}
export function randomFreePoint(w,area){
  for(let i=0;i<200;i++){
    const x=area?rand(area.x,area.x+area.w):rand(40,W-40),y=area?rand(area.y,area.y+area.h):rand(40,H-40);
    if(x>20&&y>20&&x<W-20&&y<H-20&&!w.blocked[cellOf(w,x,y)])return{x,y};
  }
  return{x:w.plaza.x+BS/2,y:w.plaza.y+BS};
}

/* ================= física ================= */
export function dash(p,m){
  if(p.dashCd>0||p.stun>0)return false;
  let dx=p.input.x,dy=p.input.y;const n=Math.hypot(dx,dy);
  if(n<.2){dx=p.lookX;dy=p.lookY;const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l}else{dx/=n;dy/=n}
  p.vx=dx*DASH;p.vy=dy*DASH;p.dashT=.2;p.dashCd=DASH_CD;
  if(m)m.emit({t:'dash',id:p.id,x:p.x|0,y:p.y|0,dx:+dx.toFixed(2),dy:+dy.toFixed(2)});
  return true;
}
export function stepPlayer(w,p,dt,m,frozen){
  p.dashCd-=dt;p.dashT-=dt;p.stun-=dt;p.passCd-=dt;p.knockImm-=dt;p.bonkCd-=dt;p.wob+=dt*10;
  let ix=frozen?0:p.input.x,iy=frozen?0:p.input.y;const n=Math.hypot(ix,iy);if(n>1){ix/=n;iy/=n}
  if(p.stun>0){const f=Math.exp(-dt*2.4);p.vx*=f;p.vy*=f;p.spin+=dt*16}
  else if(p.dashT<=0){const ms=MAXS*p.skill,k=Math.min(1,dt*9);p.vx+=(ix*ms-p.vx)*k;p.vy+=(iy*ms-p.vy)*k}
  if(n>.15&&p.stun<=0){const k=Math.min(1,dt*12),d=Math.max(n,1);p.lookX+=(ix/d-p.lookX)*k;p.lookY+=(iy/d-p.lookY)*k}
  for(let s=0;s<2;s++){p.x+=p.vx*dt/2;p.y+=p.vy*dt/2;collideWorld(w,p,m)}
}
function collideWorld(w,p,m){
  for(const i of w.rectB[bucketAt(w,p.x,p.y)]){
    const r=w.rects[i];
    if(p.x<r.x-p.r||p.x>r.x+r.w+p.r||p.y<r.y-p.r||p.y>r.y+r.h+p.r)continue;
    const cx=clamp(p.x,r.x,r.x+r.w),cy=clamp(p.y,r.y,r.y+r.h);let dx=p.x-cx,dy=p.y-cy,d2=dx*dx+dy*dy,nx,ny,push;
    if(d2>=p.r*p.r)continue;
    if(d2>1e-4){const d=Math.sqrt(d2);nx=dx/d;ny=dy/d;push=p.r-d}
    else{const l=p.x-r.x,rt=r.x+r.w-p.x,t=p.y-r.y,b=r.y+r.h-p.y,mn=Math.min(l,rt,t,b);
      if(mn===l){nx=-1;ny=0}else if(mn===rt){nx=1;ny=0}else if(mn===t){nx=0;ny=-1}else{nx=0;ny=1}push=mn+p.r}
    hitSurface(p,nx,ny,push,m);
  }
  for(const c of w.circles){const dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy),mn=p.r+c.r;if(d<mn&&d>0)hitSurface(p,dx/d,dy/d,mn-d,m)}
  if(p.x<p.r)hitSurface(p,1,0,p.r-p.x,m);if(p.x>W-p.r)hitSurface(p,-1,0,p.x-(W-p.r),m);
  if(p.y<p.r)hitSurface(p,0,1,p.r-p.y,m);if(p.y>H-p.r)hitSurface(p,0,-1,p.y-(H-p.r),m);
}
function hitSurface(p,nx,ny,push,m){
  p.x+=nx*push;p.y+=ny*push;const vn=p.vx*nx+p.vy*ny;
  if(vn<0){const e=p.stun>0?.7:.1;p.vx-=(1+e)*vn*nx;p.vy-=(1+e)*vn*ny;
    if(m&&p.stun>0&&-vn>260&&p.bonkCd<=0){p.bonkCd=.3;m.emit({t:'ft',x:p.x|0,y:(p.y-20)|0,text:pick(['BONK!','POF!','AI!']),c:'#ffffff'})}}
}

/* ================= modos ================= */
const bigArea=w=>({x:w.plaza.x-180,y:w.plaza.y-160,w:BS+360,h:w.plaza.h+320});
export const MODES={
  batata:{
    name:'Batata Quente',unit:'pontos',
    tip:'Fuja de quem está com a bomba. Pegou? Encoste em alguém pra passar antes que exploda!',
    area:bigArea,
    start(m){
      const k=Math.max(1,Math.round(m.players.length/8));
      m.ms.bombs=shuffle(m.players.slice()).slice(0,k).map(h=>({holder:h,fuse:rand(11,15),wait:0,last:null}));
      m.emit({t:'bombs',k});for(const b of m.ms.bombs)m.emit({t:'drop',id:b.holder.id});
    },
    holderOf(m,p){return m.ms.bombs&&m.ms.bombs.find(b=>b.holder===p)},
    update(m,dt){
      for(const p of m.players)if(!this.holderOf(m,p))p.score+=dt;
      for(const b of m.ms.bombs){
        if(b.wait>0){b.wait-=dt;if(b.wait<=0){
          const opts=m.players.filter(p=>p!==b.last&&!this.holderOf(m,p));b.holder=pick(opts);b.fuse=rand(10,14);b.holder.passCd=.6;
          m.emit({t:'drop',id:b.holder.id})}continue}
        if(!b.holder)continue;
        b.fuse-=dt;if(b.fuse<=0)this.explode(m,b);
      }
    },
    contact(m,a,c){
      const ba=this.holderOf(m,a),bc=this.holderOf(m,c);if(!!ba===!!bc)return;
      const b=ba||bc,h=b.holder,to=ba?c:a;if(b.wait>0||h.passCd>0)return;
      b.holder=to;to.passCd=.7;
      m.emit({t:'pass',from:h.id,to:to.id,x:to.x|0,y:to.y|0});
      m.botSay(h,'passA',.5);m.botSay(to,'passV',.6);
    },
    explode(m,b){
      const h=b.holder,a=rand(0,6.28);h.vx=Math.cos(a)*720;h.vy=Math.sin(a)*720;h.stun=1.8;h.score-=8;
      m.emit({t:'boom',id:h.id,x:h.x|0,y:h.y|0});
      m.botSay(h,'boomH',.8);for(const o of m.players)if(o!==h&&Math.hypot(o.x-h.x,o.y-h.y)<400)m.botSay(o,'boomO',.15);
      b.last=h;b.holder=null;b.wait=1.4;
    },
    nearestHolder(m,p){let best=null,bd=1e9;for(const b of m.ms.bombs||[]){if(!b.holder||b.holder===p)continue;const d=Math.hypot(b.holder.x-p.x,b.holder.y-p.y);if(d<bd){bd=d;best=b.holder}}return[best,bd]},
    goal(m,b){
      if(this.holderOf(m,b)){const[t,d]=m.nearestOther(b,p=>!this.holderOf(m,p));return t?{x:t.x+t.vx*.25,y:t.y+t.vy*.25,dash:d<110?.35:0}:null}
      const[h,d]=this.nearestHolder(m,b);
      if(h&&d<300)return{flee:h,dash:d<90?.15:0};
      return null;
    },
  },
  picha:{
    name:'Picha a Cidade',unit:'muros',
    tip:'Encoste nos muros e fachadas pra pintar com a sua cor. Pode pintar por cima dos outros!',
    area:bigArea,
    start(m){m.ms.cnt=new Map()},
    update(m,dt){
      const w=m.w,own=m.tileOwner,cnt=m.ms.cnt;
      for(const p of m.players){
        for(const i of w.tileB[bucketAt(w,p.x,p.y)]){
          if(own[i]===p.id)continue;
          const t=w.tiles[i],cx=clamp(p.x,t.x,t.x+t.w),cy=clamp(p.y,t.y,t.y+t.h);
          if(Math.hypot(p.x-cx,p.y-cy)<=p.r+5){
            const prev=own[i];
            if(prev>=0){cnt.set(prev,(cnt.get(prev)||1)-1);if(Math.random()<.05)m.botSay(p,'picha',.5)}
            own[i]=p.id;cnt.set(p.id,(cnt.get(p.id)||0)+1);
            m.emit({t:'paint',i,id:p.id});
          }
        }
      }
      for(const p of m.players)p.score=cnt.get(p.id)||0;
    },
    goal(m,b){
      const br=b.brain,w=m.w,own=m.tileOwner;
      if(br.tile>=0&&own[br.tile]!==b.id&&br.goalT>0)return{x:br.stand.x,y:br.stand.y};
      let best=-1,bs=1e9,stand=null;
      w.tiles.forEach((t,i)=>{if(own[i]===b.id)return;
        for(const s of t.stands){const d=Math.hypot(s.x-b.x,s.y-b.y)+rand(0,260)+(own[i]<0?0:60);if(d<bs){bs=d;best=i;stand=s}}});
      if(best<0)return null;br.tile=best;br.stand=stand;br.goalT=rand(3,5);
      return{x:stand.x,y:stand.y};
    },
  },
  corre:{
    name:'Corre Pra Loja',unit:'pontos',
    tip:'Chegue primeiro na porta da loja indicada. Empurre quem estiver no caminho!',
    area:w=>({x:w.plaza.x-60,y:w.plaza.y+40,w:BS+120,h:BS*2}),
    PTS:[10,7,5,3,1],
    start(m){m.ms.target=-1;m.ms.first=true;this.newTarget(m)},
    newTarget(m){
      const w=m.w,prev=m.ms.target>=0?w.buildings[m.ms.target]:null;
      let opts=w.buildings.map((b,i)=>i).filter(i=>w.buildings[i].loja&&i!==m.ms.target);
      const mine=w.buildings.findIndex(b=>b.loja&&b.loja.mine);
      let t;
      if(m.ms.first&&mine>=0)t=mine;
      else{if(prev){const far=opts.filter(i=>{const d=w.buildings[i].door;return Math.hypot(d.x-prev.door.x,d.y-prev.door.y)>420});if(far.length)opts=far}t=pick(opts)}
      m.ms.first=false;m.ms.target=t;m.ms.arrived=0;m.ms.timer=-1;
      for(const p of m.players)p.arrived=false;
      m.emit({t:'target',b:t});
      m.botSay(pick(m.players.filter(p=>p.bot)),'target',.5);
    },
    update(m,dt){
      const d=m.w.buildings[m.ms.target].door,P=this.PTS;
      for(const p of m.players){if(p.arrived)continue;
        if(Math.hypot(p.x-d.x,p.y-d.y)<38){p.arrived=true;const v=P[m.ms.arrived]||0;m.ms.arrived++;p.score+=v;
          m.emit({t:'arrive',id:p.id,pts:v,place:m.ms.arrived,x:p.x|0,y:p.y|0});
          if(m.ms.timer<0){m.ms.timer=6;m.botSay(p,'first',.9)}}}
      if(m.ms.arrived>=P.length)m.ms.timer=Math.min(m.ms.timer,.8);
      if(m.ms.timer>0){m.ms.timer-=dt;if(m.ms.timer<=0)this.newTarget(m)}
    },
    goal(m,b){
      if(b.arrived)return null;
      const d=m.w.buildings[m.ms.target].door;let dash=0;
      const[o,od]=m.nearestOther(b);if(o&&od<70&&Math.random()<.5)dash=.25;
      if(Math.hypot(d.x-b.x,d.y-b.y)<140&&Math.random()<.2)dash=.3;
      return{x:d.x,y:d.y,dash};
    },
  },
};

/* ================= partida ================= */
// Uma sala: jogadores (pessoas e bots), rodadas, modos, bots e zoeira do chat.
// Tudo o que os clientes precisam mostrar sai como evento em m.ev.
export class Match{
  constructor(w,{size=ROOM,auto=false,simFila=false}={}){
    Object.assign(this,{w,size,auto,simFila});
    this.players=[];this.byId=new Map();this.nextId=1;this.ev=[];this.rosterV=0;
    this.tileOwner=new Int32Array(w.tiles.length).fill(-1);
    this.phase='idle';this.phaseT=0;this.timeLeft=0;this.roundIdx=0;this.order=[];this.modeKey=null;this.mode=null;this.ms={};
    this.pending=[];this.chatGap=0;this.leader=null;this.leadT=0;this.bragT=0;
    this.lastRound=null;this.final=null;this.hooks={};
  }
  emit(e){this.ev.push(e)}
  makePlayer(name,color,bot){
    return{id:this.nextId++,name,color,bot,x:0,y:0,vx:0,vy:0,r:PR,stun:0,spin:0,dashT:0,dashCd:0,lookX:0,lookY:1,
      score:0,total:0,passCd:0,arrived:false,knockImm:0,bonkCd:0,wob:Math.random()*6,skill:bot?rand(.8,.95):1,
      chatCd:rand(1,4),say:null,input:{x:0,y:0},brain:{t:0,goal:null,goalT:0,distract:0,tile:-1,stand:null}};
  }
  fillBots(){
    const names=botNames(this.size-this.players.length,this.players.map(p=>p.name));
    names.forEach(n=>{const p=this.makePlayer(n,botColor(this.nextId),true);const s=randomFreePoint(this.w,bigArea(this.w));p.x=s.x;p.y=s.y;
      this.players.push(p);this.byId.set(p.id,p)});
    this.rosterV++;
  }
  // Uma pessoa entra no lugar de um bot, herdando posição e pontos.
  addHuman(name,color){
    const bots=this.players.filter(p=>p.bot);
    let p;
    if(bots.length)p=pick(bots);
    else if(this.players.length<this.size){p=this.makePlayer(name,color,false);const s=randomFreePoint(this.w,bigArea(this.w));p.x=s.x;p.y=s.y;this.players.push(p);this.byId.set(p.id,p)}
    else return null;
    Object.assign(p,{bot:false,name,color,skill:1,input:{x:0,y:0},say:null});
    const clash=this.players.filter(q=>q!==p&&q.bot&&q.name.toLowerCase()===name.toLowerCase());
    if(clash.length){const fresh=botNames(clash.length,this.players.map(q=>q.name));clash.forEach((q,i)=>{q.name=fresh[i]})}
    this.rosterV++;this.emit({t:'join',id:p.id});
    return p;
  }
  // Quem sai vira bot de novo, com outro nome.
  humanLeft(p){
    if(!p||p.bot)return;
    Object.assign(p,{bot:true,name:botNames(1,this.players.map(q=>q.name))[0],skill:rand(.8,.95),input:{x:0,y:0}});
    p.brain.goal=null;p.chatCd=rand(2,5);this.rosterV++;
  }
  humans(){return this.players.filter(p=>!p.bot)}
  spawnAll(area){
    for(const p of this.players){const s=randomFreePoint(this.w,area);
      Object.assign(p,{x:s.x,y:s.y,vx:0,vy:0,stun:0,dashT:0,score:0,arrived:false,passCd:0,say:null});p.brain.goal=null;p.brain.tile=-1}
  }
  startMatch(){
    for(const p of this.players)p.total=0;
    this.order=shuffle(['batata','picha','corre']);this.roundIdx=0;this.final=null;this.startRound();
  }
  startRound(){
    this.modeKey=this.order[this.roundIdx];this.mode=MODES[this.modeKey];this.ms={};
    this.spawnAll(this.mode.area(this.w));this.tileOwner.fill(-1);
    this.phase='intro';this.phaseT=INTRO_TIME;this.timeLeft=ROUND_TIME;this.leader=null;this.leadT=0;this.pending=[];
    this.emit({t:'round',ri:this.roundIdx,mk:this.modeKey});
  }
  ranking(){return this.players.slice().sort((a,b)=>b.score-a.score)}
  step(dt){
    const live=this.phase==='intro'||this.phase==='play'||this.phase==='roundEnd';
    if(live)this.chatTick(dt);
    if(this.phase==='intro'){
      this.phaseT-=dt;if(this.phaseT<=0){this.phase='play';this.mode.start(this)}
    }else if(this.phase==='play'){
      this.timeLeft-=dt;
      for(const p of this.players)if(p.bot)this.think(p,dt);
      for(const p of this.players)stepPlayer(this.w,p,dt,this);
      this.collidePlayers();this.mode.update(this,dt);
      if(this.timeLeft<=0)this.endRound();
    }else if(this.phase==='roundEnd'){
      for(const p of this.players)stepPlayer(this.w,p,dt,null,true);
      this.phaseT-=dt;if(this.phaseT<=0){this.roundIdx++;if(this.roundIdx<ROUNDS)this.startRound();else this.endMatch()}
    }else{
      for(const p of this.players){if(p.bot)this.think(p,dt);stepPlayer(this.w,p,dt,null,false)}
      this.collidePlayers(true);
      if(this.phase==='results'){this.phaseT-=dt;if(this.auto&&this.phaseT<=0){this.hooks.beforeNext?.(this);this.startMatch()}}
    }
  }
  endRound(){
    this.phase='roundEnd';this.phaseT=ROUND_END_TIME;
    const ranked=this.ranking();
    ranked.forEach((p,i)=>p.total+=ranked.length-i);
    this.lastRound=ranked.map(p=>({id:p.id,score:Math.max(0,Math.round(p.score))}));
    this.emit({t:'rend'});
    this.botSay(ranked[0],'win',.9);this.botSay(ranked[ranked.length-1],'lose',.9);this.botSay(ranked[ranked.length-2],'lose',.4);
  }
  endMatch(){
    this.phase='results';this.phaseT=RESULTS_TIME;
    this.final=this.players.slice().sort((a,b)=>b.total-a.total).map(p=>({id:p.id,total:p.total}));
    this.hooks.onResults?.(this);
    this.emit({t:'results'});
  }
  // Nos resultados, os bots do fim da tabela dão a vez (offline e sem fila no servidor).
  rotateBots(k){
    const out=this.final.map(f=>this.byId.get(f.id)).filter(p=>p&&p.bot).slice(-k);
    const fresh=botNames(out.length,this.players.map(p=>p.name)),names=out.map(p=>p.name);
    out.forEach((p,i)=>{p.name=fresh[i]});if(out.length)this.rosterV++;
    return{out:names,in:fresh};
  }
  nearestOther(b,filter){
    let best=null,bd=1e9;for(const p of this.players){if(p===b||(filter&&!filter(p)))continue;const d=Math.hypot(p.x-b.x,p.y-b.y);if(d<bd){bd=d;best=p}}
    return[best,bd];
  }
  think(b,dt){
    const br=b.brain;br.t-=dt;br.goalT-=dt;br.distract-=dt;
    if(br.t>0)return;br.t=rand(.12,.24);
    if(br.distract>0)return;
    if(Math.random()<.012){br.distract=rand(.5,1.1);const a=rand(0,6.28);b.input={x:Math.cos(a),y:Math.sin(a)};return}
    let g=this.mode&&this.phase==='play'?this.mode.goal(this,b):null;
    if(!g){if(!br.goal||br.goalT<0||Math.hypot(br.goal.x-b.x,br.goal.y-b.y)<30){br.goal=randomFreePoint(this.w);br.goalT=rand(3,6)}g=br.goal}
    const d=g.flee?dirAway(this.w,b,g.flee):dirTo(this.w,b,g.x,g.y);
    b.input={x:d[0]+rand(-.25,.25),y:d[1]+rand(-.25,.25)};
    if(g.dash&&Math.random()<g.dash&&this.phase==='play')dash(b,this);
  }
  collidePlayers(calm){
    const P=this.players,n=P.length,contact=!calm&&this.mode&&this.mode.contact;
    for(let i=0;i<n;i++){const a=P[i];
      for(let j=i+1;j<n;j++){const b=P[j];
        let dx=b.x-a.x;if(dx>30||dx<-30)continue;let dy=b.y-a.y;if(dy>30||dy<-30)continue;
        const d=Math.hypot(dx,dy),mn=a.r+b.r;
        if(d>=mn+2)continue;
        if(contact)this.mode.contact(this,a,b);
        if(d>=mn||d===0)continue;
        const nx=dx/d,ny=dy/d,ov=(mn-d)/2;a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;
        if(calm)continue;
        const ad=a.dashT>0,bd=b.dashT>0;
        if(ad&&!bd)this.knock(b,nx,ny,a);
        else if(bd&&!ad)this.knock(a,-nx,-ny,b);
        else{const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
          if(vn<0){const imp=-vn*(ad&&bd?1.4:.8);a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny;
            if(ad&&bd){a.stun=b.stun=.5;this.emit({t:'ft',x:((a.x+b.x)/2)|0,y:((a.y+b.y)/2-24)|0,text:'TOC!',c:'#ffffff'})}
            if(-vn>120&&(!a.bot||!b.bot))this.emit({t:'bump',a:a.id,b:b.id})}}
      }
    }
  }
  knock(v,nx,ny,att){
    if(v.knockImm>0)return;
    v.vx=nx*440+att.vx*.25;v.vy=ny*440+att.vy*.25;v.stun=.8;v.knockImm=.35;att.dashT=0;att.vx*=.25;att.vy*=.25;
    this.emit({t:'knock',v:v.id,a:att.id,x:v.x|0,y:v.y|0,text:pick(['TOMBO!','SAI DA FRENTE!','OPA!','VAPT!','LÁ VAI!'])});
    this.botSay(att,'knockA',.45);this.botSay(v,'knockV',.55);
  }
  /* chat e zoeira */
  say(p,text){
    text=cleanChat(text);if(!text)return;
    p.say={text,t:3};this.emit({t:'say',id:p.id,text});
  }
  humanSay(p,text){
    if(!p||!String(text).trim())return;
    this.say(p,text);
    const brag=BRAG.has(cleanChat(text).toLowerCase());
    if(brag||Math.random()<.7){const b=pick(this.players.filter(q=>q.bot));if(b){b.chatCd=0;this.botSay(b,brag?'answerBrag':'reply',1)}}
  }
  botSay(p,key,prob=.5){
    if(!p||!p.bot||p.chatCd>0||this.pending.length>=5||Math.random()>prob)return;
    p.chatCd=rand(4,8);const L=this.leader||this.currentLeader();
    this.pending.push({p,text:pick(ZOEIRA[key]).replace('{L}',L?L.name:'líder'),t:rand(.3,1.1)});
  }
  currentLeader(){
    const r=this.ranking();
    return r.length>1&&Math.floor(r[0].score)>=Math.floor(r[1].score)+1&&r[0].score>=1?r[0]:null;
  }
  leaderTick(dt){
    this.leadT-=dt;this.bragT-=dt;if(this.leadT>0)return;this.leadT=.5;
    const L=this.currentLeader(),bots=this.players.filter(p=>p.bot);
    if(L&&L!==this.leader){
      const old=this.leader;this.leader=L;this.bragT=rand(5,8);this.emit({t:'lead',id:L.id});
      if(L.bot){L.chatCd=0;this.botSay(L,'lead',.85)}else this.botSay(pick(bots),'chase',.9);
      if(old)this.botSay(old,'lostLead',.6);
    }else if(L&&this.bragT<=0){
      this.bragT=this.timeLeft<12?rand(3,5):rand(5,8);
      if(L.bot){L.chatCd=0;this.botSay(L,this.timeLeft<12?'leadEnd':'lead',.8)}else this.botSay(pick(bots),'chase',.5);
    }
  }
  chatTick(dt){
    for(const p of this.players){p.chatCd-=dt;if(p.say){p.say.t-=dt;if(p.say.t<=0)p.say=null}}
    this.chatGap-=dt;
    for(const q of this.pending)q.t-=dt;
    const ready=this.pending.filter(q=>q.t<=0);this.pending=this.pending.filter(q=>q.t>0);
    for(const q of ready){
      if(this.chatGap>0){q.t=this.chatGap+.15;this.pending.push(q);continue}
      if(q.p&&this.byId.get(q.p.id)===q.p&&q.p.bot){this.say(q.p,q.text);this.chatGap=.6}
    }
    if(this.phase==='play'){
      this.leaderTick(dt);
      if(Math.random()<dt*.18){const bots=this.players.filter(p=>p.bot);if(bots.length)this.botSay(pick(bots),'idle',.8)}
      if(this.simFila&&Math.random()<dt*.05)this.emit({t:'fila',who:pick(NAMES),text:pick(ZOEIRA.fila)});
    }
  }
}
