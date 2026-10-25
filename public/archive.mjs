import {verifyJws, normalize, normalizeState,normalizePlace,normalizeExterior,normalizeMunicipal} from './tse.mjs';
import {normalizeGeography} from './geography.mjs';

export async function archiveJson(path) {
  const response = await fetch(`/historico/${path}`, {cache:'no-store',signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw Error('Arquivo de segurança indisponível.');
  return response.json();
}
export async function digestToken(token) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function archivedResource(resources, key) {
  const record = resources?.[key];
  if (!record || !/^[a-f0-9]{64}$/.test(record.hash) || !Number.isFinite(Date.parse(record.capturedAt))) throw Error('Esta informação ainda não foi arquivada.');
  const response = await fetch(`/historico/tokens/${record.hash}.jws`,{signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw Error('Versão arquivada indisponível.');
  const token = (await response.text()).trim();
  if (token.length>5_000_000) throw Error('Arquivo de segurança muito grande.');
  const digest = await digestToken(token);
  if (digest !== record.hash) throw Error('A integridade do arquivo de segurança não foi confirmada.');
  const raw = await verifyJws(token);
  const mun=/^mun-([a-z]{2})-(\d{5})$/.exec(key);
  const data = key === 'national' ? normalize(raw) : mun ? normalizeMunicipal(raw,mun[1],mun[2]) : key.startsWith('uf-') ? normalizeState(raw,key.slice(3)) : key.startsWith('city-') ? normalizePlace(raw,key.slice(5)) : key==='exterior' ? normalizeExterior(raw) : normalizeGeography(raw,key);
  if (data.generatedAt !== record.generatedAt) throw Error('Horário do arquivo de segurança inconsistente.');
  return {data,raw,record,revision:digest,origin:'backup'};
}
