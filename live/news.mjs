export const SOURCES=Object.freeze([
 {id:'cnn',name:'CNN Brasil',feed:'https://admin.cnnbrasil.com.br/feed/',home:'https://www.cnnbrasil.com.br/politica/',host:'cnnbrasil.com.br'},
 {id:'g1',name:'g1',feed:'https://g1.globo.com/rss/g1/politica/',home:'https://g1.globo.com/politica/',host:'g1.globo.com'},
 {id:'uol',name:'UOL',feed:'https://rss.uol.com.br/feed/noticias.xml',home:'https://noticias.uol.com.br/politica/',host:'noticias.uol.com.br'}
]);
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function plain(text){return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,key)=>{if(key[0]!=='#')return entities[key.toLowerCase()]??all;const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/\s+/g,' ').trim();}
const field=(xml,name)=>plain(xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]??'');
export function newsDate(text){const months={Fev:'Feb',Abr:'Apr',Mai:'May',Ago:'Aug',Set:'Sep',Out:'Oct',Dez:'Dec'};return Date.parse(text.replace(/^[^,]+,\s*/,'').replace(/\b(Fev|Abr|Mai|Ago|Set|Out|Dez)\b/gi,x=>months[x[0].toUpperCase()+x.slice(1).toLowerCase()]));}
export function parseFeed(xml,source,now=Date.now()){
 if(xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<rss\b/i.test(xml))throw Error('Feed inválido.');
 const rows=[];const seen=new Set();
 for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
  const title=field(match[1],'title'),date=newsDate(field(match[1],'pubDate'));let url;
  try{url=new URL(field(match[1],'link'));}catch{continue;}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!(url.hostname===source.host||url.hostname.endsWith('.'+source.host)))continue;
  url.protocol='https:';url.hash='';for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_'))url.searchParams.delete(key);
  const topic=(title+' '+url.pathname).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const electoral=/\b(eleic(?:ao|oes)|eleitor\w*|urna\w*|apuracao|tse|tre|presidencia\w*|segundo.turno|2[ºo].turno)\b/i.test(topic)||(/votacao/i.test(topic)&&!/congresso|senado|camara|assembleia/i.test(topic));
  if(!electoral||!title||title.length>300||!Number.isFinite(date)||date>now+300000||now-date>172800000||seen.has(url.href))continue;
  seen.add(url.href);rows.push({title,url:url.href,publishedAt:new Date(date).toISOString(),source:source.id});
 }
 return rows.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,12);
}
export async function fetchNews(source,request=fetch){
 const response=await request(source.feed,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'ApuraBrasil/1.0 RSS reader','Accept':'application/rss+xml, application/xml, text/xml'}});
 if(!response.ok)throw Error('HTTP '+response.status);
 const reader=response.body.getReader();const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000){await reader.cancel();throw Error('Feed muito grande.');}chunks.push(value);}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 const charset=/charset\s*=\s*["']?([^;\s"']+)/i.exec(response.headers.get('content-type')??'')?.[1]??'utf-8';
 return parseFeed(new TextDecoder(charset).decode(data),source);
}
