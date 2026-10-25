import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyJws,normalize,normalizeState,stateResultsUrl} from '../public/tse.mjs';
import {normalizeGeography} from '../public/geography.mjs';
import {UpdateSound} from '../public/sound.mjs';
import {collect} from '../archive/collect.mjs';
const fixture=async name=>(await readFile(new URL(`fixtures/${name}.jws`,import.meta.url),'utf8')).trim();
test('official signed geographic sources cover all 27 UFs, exterior and 186 foreign locations',async()=>{
 const states=normalizeGeography(await verifyJws(await fixture('states')),'states');
 const abroad=normalizeGeography(await verifyJws(await fixture('abroad')),'abroad');
 assert.equal(states.regions.length,28);assert.equal(abroad.regions.length,186);
 const places=JSON.parse(await readFile(new URL('../public/assets/places.json',import.meta.url)));
 const maps=JSON.parse(await readFile(new URL('../public/assets/maps.json',import.meta.url)));
 assert.deepEqual(new Set(places.map(p=>p.id)),new Set(abroad.regions.map(r=>r.id)));
 assert.equal(new Set(maps.countries.map(c=>c.id)).size,maps.countries.length);
 for(const place of places)assert.ok(maps.countries.some(c=>c.id===place.country));
 assert.equal(maps.states.length,27);
});
test('geography rejects switched scopes, invalid sections and duplicate locations',async()=>{
 const raw=await verifyJws(await fixture('states'));
 assert.throws(()=>normalizeGeography(raw,'abroad'));
 const bad=structuredClone(raw);bad.abr[0].s.st='999999';assert.throws(()=>normalizeGeography(bad,'states'));
 const duplicate=structuredClone(raw);duplicate.abr.push(duplicate.abr[0]);assert.throws(()=>normalizeGeography(duplicate,'states'));
 assert.throws(()=>normalizeGeography({...raw,ele:'6257'},'states'));
});
test('archive deduplicates, rejects tampered data, and preserves valid backups through source failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'eleicao-archive-test-'));
 const tokens=Object.fromEntries(await Promise.all(['national','states','abroad'].map(async k=>[k,await fixture(k)])));
 const request=async url=>new Response(tokens[String(url).includes('br-c0001')?'national':String(url).includes('/dados/br/')?'states':'abroad']);
 const coreSources={national:'https://test/dados/br/br-c0001',states:'https://test/dados/br/states',abroad:'https://test/abroad'};
 const first=await collect(dir,request,coreSources);assert.equal(first.index.entries.length,1);assert.equal(Object.keys(first.resources).length,3);assert.deepEqual(first.failures,{});
 const same=await collect(dir,request,coreSources);assert.equal(same.index.entries.length,1);assert.equal(same.changed,false);
 const invalid=await collect(dir,async()=>new Response(tokens.national.replace(/.$/,'!')),coreSources);
 assert.equal(invalid.changed,false);assert.equal(Object.keys(invalid.failures).length,3);assert.deepEqual(invalid.resources,first.resources);
 const outage=await collect(dir,async()=>{throw Error('Simulated connection failure');},coreSources);
 assert.deepEqual(outage.resources,first.resources);assert.equal(outage.index.entries.length,1);
 for(const ref of Object.values(first.resources))await verifyJws(await readFile(join(dir,'tokens',`${ref.hash}.jws`),'utf8'));
});
test('confirmation sound only fires once for new versions after explicit activation',()=>{
 let count=0;const sound=new UpdateSound(()=>count++);
 sound.observe({national:'one'});assert.equal(count,0);
 sound.enabled=true;sound.observe({national:'one'});assert.equal(count,0);
 sound.observe({national:'two'});assert.equal(count,1);
 sound.observe({national:'two'});assert.equal(count,1);
 sound.observe({national:null});assert.equal(count,1);
 sound.observe({national:'two'});assert.equal(count,1);
 sound.enabled=false;sound.observe({national:'three'});assert.equal(count,1);
});

test('state votes validate the exact UF and archive independently from map progress',async()=>{
 const token=await fixture('am');const raw=await verifyJws(token);const d=normalizeState(raw,'am');
 assert.equal(d.uf,'am');assert.equal(d.totalSections,8157);assert.equal(d.validVotes,0);
 assert.throws(()=>normalize(raw));assert.throws(()=>normalizeState(raw,'sp'));assert.throws(()=>stateResultsUrl('../br'));
 const dir=await mkdtemp(join(tmpdir(),'eleicao-state-test-'));
 const saved=await collect(dir,async()=>new Response(token),{'uf-am':stateResultsUrl('am')});
 assert.equal(saved.index.entries[0].complete,false);assert.ok(saved.resources['uf-am']);
 const unchanged=await collect(dir,async()=>{throw Error('Offline');},{'uf-am':stateResultsUrl('am')});
 assert.deepEqual(unchanged.resources,saved.resources);assert.equal(unchanged.index.entries.length,1);
});

test('blank and null percentages use the total-ballot fields, including historical signed files',async()=>{
 const raw=await verifyJws(await fixture('national'));const data=normalize(raw);
 assert.deepEqual(data.blankVotes,{votes:4158,percent:1.21});
 assert.deepEqual(data.nullVotes,{votes:5153,percent:1.49});
 assert.equal(data.totalVotes,345054);assert.notEqual(data.nullVotes.percent,Number(raw.v.pvn.replace(',','.')));
 const state=normalizeState(await verifyJws(await fixture('am')),'am');
 assert.deepEqual(state.blankVotes,{votes:0,percent:0});assert.deepEqual(state.nullVotes,{votes:0,percent:0});
 const invalid=structuredClone(raw);invalid.v.tv='1';assert.throws(()=>normalize(invalid));
 const missing=structuredClone(raw);delete missing.v.vb;assert.throws(()=>normalize(missing));
});

test('timeline distinguishes captures from national versions and identifies missing map sources',async()=>{
 const {timelineSummary}=await import('../public/timeline.mjs');
 const first={nationalHash:'a'.repeat(64),complete:false,availableSources:['national']};
 const second={nationalHash:'a'.repeat(64),complete:true,availableSources:['national','states','abroad']};
 const initial=timelineSummary([first,second],0);
 assert.equal(initial.versions,1);assert.equal(initial.sameNational,true);assert.equal(initial.partial,true);
 assert.match(initial.count,/2 capturas · 1 versão nacional/);
 assert.match(initial.note,/percentuais dos candidatos são iguais/);
 assert.match(initial.note,/mapas ainda não estavam arquivados/);
 const changed=timelineSummary([second,{...second,nationalHash:'b'.repeat(64)}],1);
 assert.equal(changed.versions,2);assert.equal(changed.sameNational,false);assert.equal(changed.partial,false);
});
