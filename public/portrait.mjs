// Official registration identifiers come from the verified JWS, never name matching.
const available=new Set(['280002551544','280002542548']);
export function candidatePortrait(candidate){
 const frame=document.createElement('span');frame.className='candidate-portrait';
 const fallback=document.createElement('span');fallback.className='portrait-fallback';fallback.setAttribute('aria-hidden','true');fallback.textContent=candidate.name.split(/\s+/).slice(0,2).map(word=>word[0]).join('');frame.append(fallback);
 if(available.has(candidate.id)){
  const img=document.createElement('img');img.alt='Foto oficial de '+candidate.name;img.width=72;img.height=90;img.decoding='async';img.src='assets/candidates/'+candidate.id+'.jpeg';img.addEventListener('error',()=>{img.remove();frame.title='Foto indisponível';},{once:true});frame.append(img);
 }
 return frame;
}
