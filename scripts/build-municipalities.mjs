import {readFile,writeFile} from 'node:fs/promises';
import {verifyJws} from '../public/tse.mjs';
const url='https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=minima';
const token=await(await fetch('https://resultados.tse.jus.br/oficial/ele2026/6258/config/mun-e006258-cm.jws')).text();const catalog=await verifyJws(token);if(catalog.f!=='o'||!Array.isArray(catalog.abr))throw Error('Catálogo inválido.');
const rows=catalog.abr.filter(a=>a.cd!=='zz').flatMap(a=>a.mu.map(m=>({id:'mun:'+a.cd+':'+m.cd,code:m.cd,uf:a.cd,name:m.nm,ibge:m.cdi})));
const raw=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):await(await fetch(url,{signal:AbortSignal.timeout(120000)})).json();const byIbge=new Map(rows.map(row=>[row.ibge,row]));
const shapes=raw.features.flatMap(f=>{const row=byIbge.get(f.properties.codarea);return row?[{...row,municipal:true,geometry:f.geometry}]:[];});
if(shapes.length<5500||new Set(shapes.map(r=>r.id)).size!==shapes.length)throw Error('Malha municipal incompleta.');
await writeFile(new URL('../public/assets/municipalities.json',import.meta.url),JSON.stringify(shapes));await writeFile(new URL('../public/assets/municipal-catalog.json',import.meta.url),JSON.stringify(rows));console.log(JSON.stringify({catalog:rows.length,shapes:shapes.length,source:url}));
