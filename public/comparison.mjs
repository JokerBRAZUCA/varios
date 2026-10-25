export function renderComparison(data){
 const root=document.getElementById('comparison');root.replaceChildren();if(!data)return;
 const left=data.candidates.find(c=>c.id==='280002542548'),right=data.candidates.find(c=>c.id==='280002551544');if(!left||!right)return;
 const fmt=n=>n.toLocaleString('pt-BR'),pct=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
 const title=document.createElement('p'),gap=Math.abs(left.votes-right.votes);title.className='comparison-lead';title.textContent=gap?(left.votes>right.votes?left.name:right.name)+' lidera por '+fmt(gap)+' votos válidos':'Empate em votos válidos';
 const track=document.createElement('div');track.className='comparison-track';track.setAttribute('aria-label','Comparação dos percentuais oficiais dos votos válidos');
 for(const [c,side]of [[left,'left'],[right,'right']]){const part=document.createElement('div');part.className='comparison-'+side;part.style.width=c.percent+'%';part.textContent=c.name+' · '+pct(c.percent);track.append(part);}
 const marker=document.createElement('span');marker.className='comparison-marker';marker.textContent='50%';track.append(marker);const note=document.createElement('small');note.textContent='Votos totalizados nesta versão · acompanha a linha do tempo';root.append(title,track,note);
}
