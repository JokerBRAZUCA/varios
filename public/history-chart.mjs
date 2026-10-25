import {archiveJson,archivedResource} from './archive.mjs';
const NS='http://www.w3.org/2000/svg',colors=['#28765c','#ad8130'];
const pct=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const clock=iso=>new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
const svg=(name,attrs={},text)=>{const e=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
export class HistoryChart{
 constructor(onSelect){this.onSelect=onSelect;this.cache=new Map();this.tokens=new Map();this.entries=[];this.points=[];this.selected=null;this.revision=0;}
 async update(entries){const key=entries.map(e=>e.id).join(',');if(key===this.key&&(this.loading||this.complete))return;this.key=key;this.loading=true;this.entries=entries;const revision=++this.revision;const pending=entries.map((entry,index)=>({entry,index})),points=[];
  const worker=async()=>{while(pending.length){const {entry,index}=pending.shift();try{let saved=this.cache.get(entry.id);if(!saved){const snapshot=await archiveJson('snapshots/'+entry.id+'.json');const record=snapshot.resources?.national;if(!record)continue;let promise=this.tokens.get(record.hash);if(!promise){promise=archivedResource(snapshot.resources,'national').catch(error=>{this.tokens.delete(record.hash);throw error;});this.tokens.set(record.hash,promise);}saved={entry,index,result:await promise};this.cache.set(entry.id,saved);}points.push({...saved,index});}catch{}}};
  await Promise.all(Array.from({length:4},worker));if(revision!==this.revision)return;this.loading=false;this.complete=points.length===entries.filter(e=>e.nationalHash).length;this.points=points.sort((a,b)=>a.index-b.index);this.draw();
 }
 select(index){this.selected=index;this.draw();}
 draw(){const target=document.getElementById('history-chart');target.replaceChildren();const legend=document.getElementById('chart-legend');legend.replaceChildren();if(!this.points.length){document.getElementById('chart-note').textContent='Aguardando capturas nacionais verificadas. O gráfico começa no primeiro arquivo preservado.';return;}
  const w=960,h=290,left=55,right=28,top=20,bottom=48,first=Date.parse(this.entries[0].observedAt),last=Date.parse(this.entries.at(-1).observedAt),x=time=>first===last?(w+left-right)/2:left+(Date.parse(time)-first)/(last-first)*(w-left-right),y=value=>top+(100-value)/100*(h-top-bottom);
  const chart=svg('svg',{viewBox:`0 0 ${w} ${h}`,role:'group','aria-label':'Evolução dos percentuais nacionais dos candidatos, somente capturas verificadas'});
  for(const value of [0,25,50,75,100]){chart.append(svg('line',{x1:left,x2:w-right,y1:y(value),y2:y(value),stroke:'#dfe6d8','stroke-width':1}));chart.append(svg('text',{x:left-12,y:y(value)+4,'text-anchor':'end',class:'chart-axis'},value+'%'));}
  const candidates=this.points.at(-1).result.data.candidates;const current=this.points.find(p=>p.index===this.selected)??this.points.at(-1);
  for(const [order,candidate]of candidates.entries()){
   const id=candidate.id??candidate.name;let path='',previous=-2;const color=colors[order%colors.length];
   for(const point of this.points){const c=point.result.data.candidates.find(c=>(c.id??c.name)===id);if(!c)continue;const px=x(point.entry.observedAt),py=y(c.percent);path+=(point.index===previous+1?'L':'M')+px.toFixed(2)+','+py.toFixed(2);previous=point.index;chart.append(svg('circle',{cx:px,cy:py,r:3.5,fill:color}));}
   chart.append(svg('path',{d:path,fill:'none',stroke:color,'stroke-width':2.4,'stroke-linejoin':'round'}));
   const item=document.createElement('span');item.className='chart-series';const dot=document.createElement('i');dot.style.background=color;const value=current.result.data.candidates.find(c=>(c.id??c.name)===id);item.append(dot,candidate.name+' · '+(value?pct(value.percent):'—'));legend.append(item);
  }
  for(const index of [...new Set([0,Math.floor((this.entries.length-1)/2),this.entries.length-1])]){const entry=this.entries[index];chart.append(svg('text',{x:x(entry.observedAt),y:h-17,'text-anchor':index===0?'start':index===this.entries.length-1?'end':'middle',class:'chart-axis'},clock(entry.observedAt)));}
  const selectionX=x(current.entry.observedAt);chart.append(svg('line',{x1:selectionX,x2:selectionX,y1:top,y2:h-bottom,stroke:'#8c9f85','stroke-dasharray':'4 5'}));
  for(const point of this.points){const hit=svg('rect',{x:x(point.entry.observedAt)-6,y:top,width:12,height:h-top-bottom,fill:'transparent',class:'chart-hit',role:'button',tabindex:0,'data-history-index':point.index,'aria-label':'Abrir captura de '+clock(point.entry.observedAt)});const title=svg('title',{},'Captura '+clock(point.entry.observedAt)+' · '+point.result.data.candidates.map(c=>c.name+': '+pct(c.percent)).join(' · '));hit.append(title);hit.onclick=()=>this.onSelect(point.index);hit.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();this.onSelect(point.index);}};chart.append(hit);}
  target.append(chart);document.getElementById('chart-selected').textContent=(this.selected===null?'Última captura arquivada: ':'Captura selecionada: ')+clock(current.entry.observedAt)+' · arquivo do TSE: '+current.result.data.updated;
  document.getElementById('chart-note').textContent=this.points.length+' de '+this.entries.length+' capturas nacionais verificadas. Desde '+new Date(this.entries[0].observedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília). Linhas unem observações; valores intermediários e versões anteriores não são estimados. Clique em um ponto para abrir a captura.';
 }
}
