import {createServer} from 'node:http';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {SOURCES,fetchNews} from './news.mjs';
export class Presence {
 constructor(now=()=>Date.now()){this.now=now;this.sessions=new Map();}
 count(){const now=this.now();for(const [id,last]of this.sessions)if(now-last>=60000)this.sessions.delete(id);return this.sessions.size;}
 touch(id){this.count();if(!/^[a-f0-9]{32}$/.test(id??''))throw Error('Sessão inválida.');if(this.sessions.size>=20000&&!this.sessions.has(id))throw Error('Capacidade temporariamente atingida.');this.sessions.set(id,this.now());return this.count();}
}
export async function startLive(directory,port=8791){
 await mkdir(directory,{recursive:true});let news={version:1,sources:{}};try{const stored=JSON.parse(await readFile(directory+'/news.json','utf8'));if(stored.version===1)news=stored;}catch{}
 const presence=new Presence();let updating=false;
 const update=async()=>{if(updating)return;updating=true;try{const records=await Promise.all(SOURCES.map(async source=>{try{return[source.id,{name:source.name,home:source.home,checkedAt:new Date().toISOString(),receivedAt:new Date().toISOString(),items:await fetchNews(source),failed:false}];}catch{return[source.id,{...news.sources[source.id],name:source.name,home:source.home,checkedAt:new Date().toISOString(),failed:true}];}}));news={version:1,sources:Object.fromEntries(records)};await writeFile(directory+'/news.json.tmp',JSON.stringify(news));await rename(directory+'/news.json.tmp',directory+'/news.json');}catch(e){console.error('News cache update failed:',e.message);}finally{updating=false;}};
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const server=createServer(async(req,res)=>{
  if(req.url==='/health'&&req.method==='GET')return send(res,200,{ok:true});
  if(req.url==='/news'&&req.method==='GET')return send(res,200,news);
  if(req.url!=='/presence')return send(res,404,{error:'Não encontrado.'});
  if(req.method==='GET')return send(res,200,{active:presence.count(),windowSeconds:60});
  if(req.method!=='POST')return send(res,405,{error:'Método inválido.'});
  if(req.headers.origin!=='https://eleicaopresidente.close4us.com')return send(res,403,{error:'Origem inválida.'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return send(res,415,{error:'Formato inválido.'});
  let body='';try{for await(const part of req){body+=part;if(body.length>512){send(res,413,{error:'Requisição muito grande.'});return;}}const data=JSON.parse(body);send(res,200,{active:presence.touch(data.session),windowSeconds:60});}catch{if(!res.headersSent)send(res,400,{error:'Sessão inválida.'});}
 });
 server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 update();const timer=setInterval(update,300000);timer.unref();
 return {server,close:()=>{clearInterval(timer);server.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const dir=process.argv[2];if(dir!=='/var/lib/eleicaopresidente-live')throw Error('Diretório inválido.');const service=await startLive(dir);process.on('SIGTERM',()=>{service.close();process.exit(0);});}
