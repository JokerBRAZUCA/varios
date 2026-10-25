import {verifyJws} from './tse.mjs';

export const BASE = 'https://resultados.tse.jus.br/oficial/ele2026/6258/';
export const GEO_URLS = Object.freeze({
  states: `${BASE}dados/br/br-e006258-ab.jws`,
  abroad: `${BASE}dados/zz/zz-e006258-ab.jws`,
  places: `${BASE}config/mun-e006258-cm.jws`,
});
export function officialTime(raw) {
  if (!/^\d{2}\/\d{2}\/2026$/.test(raw.dg ?? '') || !/^\d{2}:\d{2}:\d{2}$/.test(raw.hg ?? '')) throw Error('Data oficial inválida.');
  const [day, month, year] = raw.dg.split('/');
  const time = Date.parse(`${year}-${month}-${day}T${raw.hg}-03:00`);
  if (!Number.isFinite(time)) throw Error('Data oficial inválida.');
  return time;
}
function count(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw Error('Contagem geográfica inválida.');
  return Number(value);
}
export function normalizeGeography(raw, scope) {
  if (!['states','abroad'].includes(scope) || raw.ele !== '6258' || raw.t !== '2' || raw.f !== 'o' || !Array.isArray(raw.abr)) throw Error('Abrangência geográfica não reconhecida.');
  const seen = new Set();
  const entries = raw.abr.filter(row => !(scope === 'states' ? row.tpabr === 'br' && row.cdabr === 'br' : row.tpabr === 'uf' && row.cdabr === 'zz'));
  const regions = entries.map(row => {
    const id = row.cdabr;
    if (scope === 'states' ? row.tpabr !== 'uf' || !/^(ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to|zz)$/.test(id) : !['mun','mu'].includes(row.tpabr) || !/^\d{5}$/.test(id)) throw Error('Localidade inesperada no arquivo geográfico.');
    if (seen.has(id)) throw Error('Localidade duplicada na fonte.');
    seen.add(id);
    const total = count(row.s?.ts), sections = count(row.s?.st);
    if (sections > total || typeof row.s?.pst !== 'string' || !/^\d+(?:[,.]\d+)?$/.test(row.s.pst)) throw Error('Seções geográficas inconsistentes.');
    const progress = Number(row.s.pst.replace(',','.'));
    if (progress > 100) throw Error('Percentual geográfico inválido.');
    return {id, sections, totalSections:total, progress, final:row.and === 'f'};
  });
  if (!regions.length || (scope === 'states' && seen.size !== 28)) throw Error('Cobertura geográfica incompleta.');
  return {regions, generatedAt:officialTime(raw), updated:`${raw.dg} às ${raw.hg} (Brasília)`, scope};
}
export async function fetchSigned(url) {
  const source = new URL(url);
  source.searchParams.set('nocache', String(Date.now()));
  const response = await fetch(source, {credentials:'omit', signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw Error(`O TSE respondeu com HTTP ${response.status}.`);
  const token = await response.text();
  if (token.length > 5_000_000) throw Error('Resposta oficial muito grande.');
  return {token, raw:await verifyJws(token)};
}
