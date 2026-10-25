export function stateLeader(data){
 if(!data)return {color:'#e1e6df',label:'Arquivo de votos indisponível'};
 if(data.validVotes===0)return {color:'#e1e6df',label:'Sem votos válidos nesta versão'};
 const flavio=data.candidates.find(c=>c.id==='280002551544'),lula=data.candidates.find(c=>c.id==='280002542548');
 if(!flavio||!lula)return {color:'#e1e6df',label:'Candidaturas não identificadas'};
 if(flavio.percent===lula.percent)return {color:'#abb5ae',label:'Empate nos percentuais publicados'};
 return flavio.percent>lula.percent?{color:'#427bb5',label:'FLAVIO BOLSONARO',percent:flavio.percent}:{color:'#b65050',label:'LULA',percent:lula.percent};
}
