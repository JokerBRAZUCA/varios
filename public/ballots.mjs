const number=new Intl.NumberFormat('pt-BR');
const percent=value=>value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
export function ballotTotals(data){
 const section=document.createElement('section');section.className='ballot-totals';section.setAttribute('aria-label','Votos brancos e nulos');
 for(const [label,key] of [['Brancos','blankVotes'],['Nulos','nullVotes']]){
  const category=data[key];const card=document.createElement('article');card.className='ballot-category';
  const title=document.createElement('span');title.textContent=label;
  const share=document.createElement('strong');share.textContent=category?percent(category.percent):'—';
  const votes=document.createElement('small');votes.textContent=category?number.format(category.votes)+' votos':'Não informado nesta versão';
  card.append(title,share,votes);section.append(card);
 }
 const note=document.createElement('p');note.className='ballot-basis';note.textContent='Brancos e nulos: percentual do total de votos. Candidatos: percentual dos votos válidos.';section.append(note);return section;
}
