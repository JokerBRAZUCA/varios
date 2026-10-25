const number=new Intl.NumberFormat('pt-BR');
export function renderElectorate(data){
 for(const [id,key]of [['electorate-total','eligible'],['electorate-attended','attended'],['electorate-absent','absent']])document.getElementById(id).textContent=data?.electorate?.[key]===null||data?.electorate?.[key]===undefined?'—':number.format(data.electorate[key]);
 document.getElementById('electorate-scope').textContent=data?.electorate?.sectionElectors===null||data?.electorate?.sectionElectors===undefined?'Aguardando o arquivo oficial.':'Comparecimento e abstenção referem-se somente às seções já totalizadas: '+number.format(data.electorate.sectionElectors)+' eleitores aptos nessas seções. Não representam o total final do país.';
}
