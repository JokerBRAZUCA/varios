import {fetchResults} from './tse.mjs';
const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('pt-BR');
const percent = (n) => `${n.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
let lastData = null;
let busy = false;
let timer;
function message(text, error = false) {
  $('notice').textContent = text;
  $('notice').classList.toggle('error', error);
}
function render(data) {
  $('progress').textContent = percent(data.progress);
  $('progress-bar').style.width = `${data.progress}%`;
  $('sections').textContent = `${format.format(data.sections)} de ${format.format(data.totalSections)} seções`;
  $('valid-votes').textContent = format.format(data.validVotes);
  $('updated').textContent = data.updated;
  $('checked').textContent = `Consulta: ${new Date(data.checked).toLocaleString('pt-BR', {timeZoneName: 'short'})}`;
  $('candidates').replaceChildren();
  for (const candidate of data.candidates) {
    const card = document.createElement('article');
    card.className = 'candidate';
    const party = document.createElement('small'); party.textContent = candidate.party;
    const name = document.createElement('h3'); name.textContent = candidate.name;
    const share = document.createElement('strong'); share.textContent = percent(candidate.percent);
    const votes = document.createElement('p'); votes.textContent = `${format.format(candidate.votes)} votos válidos`;
    const track = document.createElement('div'); track.className = 'track';
    const fill = document.createElement('div'); fill.style.width = `${candidate.percent}%`; track.append(fill);
    card.append(party, name, share, track, votes);
    $('candidates').append(card);
  }
  const link = document.createElement('a');
  link.href = data.source; link.textContent = 'Dados oficiais do TSE ↗';
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  $('source').replaceChildren('Fonte: ', link, '. Data e hora acima conforme informadas pela fonte.');
}
async function refresh() {
  if (busy) return;
  clearTimeout(timer);
  busy = true;
  $('refresh').disabled = true;
  $('refresh').textContent = 'Consultando…';
  try {
    const data = await fetchResults();
    if (lastData && data.generatedAt < lastData.generatedAt) throw new Error('O TSE retornou uma versão anterior à última recebida; mantendo os dados mais recentes.');
    lastData = data;
    render(data);
    message(data.final ? 'Totalização final informada pelo TSE. Assinatura digital verificada. Consulta a cada 30 segundos.' : 'Conexão direta com o TSE · assinatura digital verificada. Atualização automática a cada 30 segundos.');
  } catch (error) {
    message(`${lastData ? 'ATUALIZAÇÃO INTERROMPIDA. Os números exibidos são da última consulta bem-sucedida. ' : ''}${error.name === 'TimeoutError' ? 'A consulta ao TSE excedeu o tempo limite.' : error instanceof TypeError ? 'Não foi possível conectar diretamente ao TSE. Confira sua conexão e use um navegador atualizado.' : error.message} Nova tentativa em 30 segundos.`, true);
  } finally {
    busy = false;
    $('refresh').disabled = false;
    $('refresh').textContent = '↻ Atualizar';
    timer = setTimeout(refresh, 30000);
  }
}
$('refresh').addEventListener('click', refresh);
refresh();
