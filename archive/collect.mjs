import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {normalize, normalizeState, stateResultsUrl, STATE_CODES, verifyJws, RESULTS_URL} from '../public/tse.mjs';
import {GEO_URLS, normalizeGeography} from '../public/geography.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
async function readJson(path, fallback) {try {return JSON.parse(await readFile(path,'utf8'));} catch(e) {if(e.code === 'ENOENT') return fallback; throw e;}}
async function atomic(path, value) {await writeFile(`${path}.tmp`,JSON.stringify(value)); await rename(`${path}.tmp`,path);}
const sources = {national:RESULTS_URL, states:GEO_URLS.states, abroad:GEO_URLS.abroad};
export const ALL_SOURCES = Object.freeze({...sources,...Object.fromEntries(STATE_CODES.map(uf=>[`uf-${uf}`,stateResultsUrl(uf)]))});
export async function collect(directory, request=fetch, sourceUrls=ALL_SOURCES) {
  await mkdir(`${directory}/tokens`, {recursive:true});
  await mkdir(`${directory}/snapshots`, {recursive:true});
  const index = await readJson(`${directory}/index.json`, {version:1,startedAt:new Date().toISOString(),entries:[]});
  let enrichedIndex = false;
  for (const entry of index.entries) {
    if (entry.nationalHash !== undefined && Array.isArray(entry.availableSources)) continue;
    const saved = await readJson(`${directory}/snapshots/${entry.id}.json`, null);
    entry.nationalHash = saved?.resources?.national?.hash ?? null;
    entry.availableSources = Object.keys(saved?.resources ?? {});
    enrichedIndex = true;
  }
  const previous = await readJson(`${directory}/latest.json`, {version:1,resources:{}});
  const resources = {...previous.resources};
  const failures = {};
  let changed = false;
  let nationalSummary;
  const pending = Object.entries(sourceUrls);
  async function capture() { while (pending.length) {
    const [key,url] = pending.shift();
    try {
      const source = new URL(url); source.searchParams.set('nocache',String(Date.now()));
      const response = await request(source, {signal:AbortSignal.timeout(20000),redirect:'error'});
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const token = (await response.text()).trim();
      if (token.length > 5_000_000) throw Error('Arquivo excedeu o limite.');
      const raw = await verifyJws(token);
      const data = key === 'national' ? normalize(raw) : key.startsWith('uf-') ? normalizeState(raw,key.slice(3)) : normalizeGeography(raw,key);
      if (key === 'national') nationalSummary = {progress:data.progress,sections:data.sections,validVotes:data.validVotes};
      if (resources[key] && data.generatedAt < resources[key].generatedAt) throw Error('Versão oficial anterior à última arquivada.');
      const digest = hash(token);
      const now = new Date().toISOString();
      if (resources[key]?.hash !== digest) {
        await writeFile(`${directory}/tokens/${digest}.jws`,token,{flag:'wx'}).catch(e=>{if(e.code !== 'EEXIST')throw e;});
        resources[key] = {hash:digest,source:url,generatedAt:data.generatedAt,capturedAt:now};
        changed = true;
      }
    } catch(e) {failures[key] = e.message;}
  }}
  await Promise.all(Array.from({length:4},capture));
  const observedAt = new Date().toISOString();
  if (changed) {
    const snapshot = {version:1,observedAt,resources};
    const id = hash(JSON.stringify(snapshot));
    await atomic(`${directory}/snapshots/${id}.json`,snapshot);
    const national = resources.national;
    index.entries.push({id,observedAt,nationalHash:national?.hash??null,availableSources:Object.keys(resources),generatedAt:national?.generatedAt ?? null,complete:Object.keys(sources).every(key=>resources[key]),...nationalSummary});
    await atomic(`${directory}/index.json`,index);
  }
  if (enrichedIndex && !changed) await atomic(`${directory}/index.json`,index);
  await atomic(`${directory}/latest.json`,{version:1,startedAt:index.startedAt,checkedAt:observedAt,resources,failures});
  console.log(JSON.stringify({checkedAt:observedAt,changed,versions:index.entries.length,failures}));
  return {changed,resources,failures,index};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.argv[2];
  if (!directory?.startsWith('/var/lib/eleicaopresidente-archive')) throw Error('Diretório de arquivo não autorizado.');
  await collect(directory);
}
