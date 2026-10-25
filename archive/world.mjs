import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyJws,normalizePlace,placeResultsUrl} from '../public/tse.mjs';
const directory='/var/lib/eleicaopresidente-archive/public';
const places=JSON.parse(await readFile(new URL('../public/assets/places.json',import.meta.url),'utf8'));
await mkdir(directory+'/tokens',{recursive:true});let previous={resources:{}};try{previous=JSON.parse(await readFile(directory+'/world-latest.json','utf8'));}catch{}
const resources={...previous.resources},failures={},pending=[...places];
await Promise.all(Array.from({length:4},async()=>{while(pending.length){const place=pending.shift(),key='city-'+place.id;try{
 const url=placeResultsUrl(place.id);const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('HTTP '+r.status);const token=(await r.text()).trim();if(token.length>5000000)throw Error('Arquivo muito grande.');const data=normalizePlace(await verifyJws(token),place.id);if(resources[key]&&data.generatedAt<resources[key].generatedAt)throw Error('Regressão de geração.');const hash=createHash('sha256').update(token).digest('hex');if(resources[key]?.hash!==hash){await writeFile(directory+'/tokens/'+hash+'.jws',token,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});resources[key]={hash,generatedAt:data.generatedAt,capturedAt:new Date().toISOString(),source:url};}
 }catch(e){failures[key]=e.message;}}}));
const latest={version:1,checkedAt:new Date().toISOString(),resources,failures};await writeFile(directory+'/world-latest.json.tmp',JSON.stringify(latest));await rename(directory+'/world-latest.json.tmp',directory+'/world-latest.json');console.log(JSON.stringify({places:Object.keys(resources).length,failures}));
