// Public verification key shipped by the official TSE app, build 26.10.17 (7216371).
// Source: https://resultados.tse.jus.br/oficial/app/main.f31aece23cbbdd2d.js
export const TSE_KEY = Object.freeze({kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', kid: 'sNbt9Q_fLS65zE1_ZLNV-XRRwPY', x: 'kWlpNHjuws1csyQZwzn3Fhzbi3RD435RbpThtSr4hMc', use: 'sig', key_ops: ['verify']});
export const RESULTS_URL = 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.jws';
export const OFFICIAL_PAGE = 'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6258/uf/br/cargo/1/vis/nominal/resultados';
const decode = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(decode(s)));
export async function verifyJws(token, key = TSE_KEY) {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('Resposta oficial não está no formato JWS esperado.');
  const header = json(parts[0]);
  if (header.alg !== 'EdDSA' || header.kid !== key.kid || header.crit || header.b64 === false) throw new Error('Assinatura oficial usa uma chave ou formato não reconhecido.');
  const publicKey = await crypto.subtle.importKey('jwk', key, {name: 'Ed25519'}, false, ['verify']);
  const valid = await crypto.subtle.verify('Ed25519', publicKey, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('Não foi possível validar a assinatura digital do TSE.');
  return json(parts[1]);
}
function number(value, label, max = Infinity) {
  if (typeof value !== 'string' || !/^\d+(?:[,.]\d+)?$/.test(value)) throw new Error(`Campo oficial inválido: ${label}.`);
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n) || n > max) throw new Error(`Campo oficial inválido: ${label}.`);
  return n;
}
function count(value, label) {
  const n = number(value, label);
  if (!Number.isSafeInteger(n)) throw new Error(`Contagem oficial inválida: ${label}.`);
  return n;
}
export function normalize(raw) {
  if (raw.ele !== '6258' || raw.t !== '2' || raw.f !== 'o' || raw.tpabr !== 'br' || raw.cdabr !== 'br') throw new Error('A fonte não corresponde ao segundo turno presidencial de 2026 no Brasil.');
  return normalizeVotes(raw, RESULTS_URL);
}
export const STATE_CODES = Object.freeze('ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to'.split(' '));
export function stateResultsUrl(uf) {
  if (!STATE_CODES.includes(uf)) throw Error('UF inválida.');
  return RESULTS_URL.replace('/br/br-', `/${uf}/${uf}-`);
}
export function normalizeState(raw, uf) {
  const source = stateResultsUrl(uf);
  if (raw.ele !== '6258' || raw.t !== '2' || raw.f !== 'o' || raw.tpabr !== 'uf' || raw.cdabr !== uf) throw Error('O resultado não corresponde à UF selecionada.');
  return {...normalizeVotes(raw, source), uf};
}
export const EXTERIOR_URL=RESULTS_URL.replace('/br/br-','/zz/zz-');
export function normalizeExterior(raw){if(raw.ele!=='6258'||raw.t!=='2'||raw.f!=='o'||raw.tpabr!=='uf'||raw.cdabr!=='zz')throw Error('Abrangência exterior inválida.');return normalizeVotes(raw,EXTERIOR_URL);}
export function placeResultsUrl(id){if(!/^\d{5}$/.test(id))throw Error('Local inválido.');return EXTERIOR_URL.replace('/zz-c','/zz'+id+'-c');}
export function normalizePlace(raw,id){const source=placeResultsUrl(id);if(raw.ele!=='6258'||raw.t!=='2'||raw.f!=='o'||raw.tpabr!=='mu'||raw.cdabr!==id)throw Error('Local de votação incorreto.');return {...normalizeVotes(raw,source),place:id};}
export function municipalResultsUrl(uf,id){if(!STATE_CODES.includes(uf)||!/^\d{5}$/.test(id))throw Error('Município inválido.');return stateResultsUrl(uf).replace('/'+uf+'-c','/'+uf+id+'-c');}
export function normalizeMunicipal(raw,uf,id){const source=municipalResultsUrl(uf,id);if(raw.ele!=='6258'||raw.t!=='2'||raw.f!=='o'||raw.tpabr!=='mu'||raw.cdabr!==id)throw Error('Município incorreto na fonte.');return {...normalizeVotes(raw,source),uf,municipality:id};}
function normalizeVotes(raw, source) {
  const cargos = raw.carg?.filter(c => c.cd === '1');
  if (cargos?.length !== 1) throw new Error('Cargo de presidente ausente ou ambíguo.');
  const candidates = [];
  for (const group of cargos[0].agr ?? []) for (const party of group.par ?? []) for (const candidate of party.cand ?? []) {
    if (typeof candidate.nmu !== 'string' || !candidate.nmu.trim()) throw new Error('Nome do candidato ausente na fonte.');
    candidates.push({id:/^\d{12}$/.test(candidate.sqcand ?? '')?candidate.sqcand:null, name: candidate.nmu, party: party.sg ?? '', votes: count(candidate.vap, 'votos do candidato'), percent: number(candidate.pvap, 'percentual do candidato', 100)});
  }
  if (!candidates.length) throw new Error('Ainda não há candidatos na resposta oficial.');
  const sections = count(raw.s?.st, 'seções totalizadas');
  const totalSections = count(raw.s?.ts, 'seções totais');
  if (sections > totalSections) throw new Error('Contagem de seções inconsistente.');
  const date = /^(\d{2})\/(\d{2})\/(2026)$/.exec(raw.dg ?? '');
  if (!date || !/^\d{2}:\d{2}:\d{2}$/.test(raw.hg ?? '')) throw new Error('Data de geração oficial ausente ou inválida.');
  // The official file gives Brazilian election time (UTC−03:00).
  const generatedAt = Date.parse(`${date[3]}-${date[2]}-${date[1]}T${raw.hg}-03:00`);
  if (!Number.isFinite(generatedAt)) throw new Error('Horário oficial inválido.');
  const category = (votes, share, label) => raw.v?.[votes] === undefined && raw.v?.[share] === undefined ? null : {votes:count(raw.v?.[votes], label),percent:number(raw.v?.[share], `percentual de ${label}`,100)};
  const blankVotes = category('vb','pvb','votos brancos');
  // tvn is the total of null ballots; pvn is a percentage *within* null ballots.
  const nullVotes = category('tvn','ptvn','votos nulos');
  const totalVotes = raw.v?.tv === undefined ? null : count(raw.v.tv,'total de votos');
  if (totalVotes !== null && ((blankVotes?.votes??0)+(nullVotes?.votes??0)>totalVotes)) throw Error('Contagem de brancos e nulos inconsistente.');
  const electorate = raw.e ? {eligible:count(raw.e.te,'eleitores aptos'),sectionElectors:count(raw.e.est,'eleitores nas seções totalizadas'),attended:count(raw.e.c,'comparecimento'),absent:count(raw.e.a,'abstenção')} : null;
  if(electorate&&(electorate.sectionElectors>electorate.eligible||electorate.attended+electorate.absent>electorate.sectionElectors))throw Error('Eleitorado inconsistente.');
  return {electorate, year: 2026, round: 2, progress: number(raw.s.pst, 'percentual de seções', 100), sections, totalSections, validVotes: count(raw.v?.vv, 'votos válidos'), blankVotes, nullVotes, totalVotes, updated: `${raw.dg} às ${raw.hg} (Brasília)`, generatedAt, checked: new Date().toISOString(), candidates, source, final: raw.tf === 's'};
}
export async function fetchResults() {
  const url = new URL(RESULTS_URL);
  url.searchParams.set('nocache', String(Date.now()));
  const response = await fetch(url, {credentials: 'omit', signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`O TSE respondeu com HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error('Resposta oficial excedeu o tamanho esperado.');
  return normalize(await verifyJws(text));
}
