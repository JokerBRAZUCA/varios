export function aggregateVotes(results){
 if(!results.length)throw Error('Nenhum resultado disponível.');
 const rows=results.map(r=>r.data),first=rows[0],sum=key=>rows.reduce((n,row)=>n+row[key],0),validVotes=sum('validVotes'),totalVotes=sum('totalVotes');
 const candidates=first.candidates.map(candidate=>{const votes=rows.reduce((n,row)=>{const c=row.candidates.find(c=>c.id===candidate.id);if(!c)throw Error('Candidaturas diferentes entre os arquivos.');return n+c.votes;},0);return {...candidate,votes,percent:validVotes?100*votes/validVotes:0};});
 const category=key=>rows.every(r=>r[key]&&r.totalVotes!==null)?{votes:rows.reduce((n,r)=>n+r[key].votes,0),percent:totalVotes?100*rows.reduce((n,r)=>n+r[key].votes,0)/totalVotes:0}:null;
 const oldest=Math.min(...rows.map(r=>r.generatedAt)),newest=Math.max(...rows.map(r=>r.generatedAt)),stamp=n=>new Date(n).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const sections=sum('sections'),totalSections=sum('totalSections');
 return {data:{candidates,validVotes,totalVotes,blankVotes:category('blankVotes'),nullVotes:category('nullVotes'),sections,totalSections,progress:totalSections?100*sections/totalSections:0,generatedAt:newest,updated:oldest===newest?stamp(newest)+' (Brasília)':stamp(oldest)+' a '+stamp(newest)+' (Brasília)',coverage:rows.length,aggregated:true},origin:results.some(r=>r.origin==='memory')?'memory':results.some(r=>r.origin==='backup')?'backup':'direct'};
}
export async function boundedMap(items,task){const pending=items.map((value,index)=>({value,index})),results=[];await Promise.all(Array.from({length:4},async()=>{while(pending.length){const {value,index}=pending.shift();results[index]=await task(value);}}));return results;}
