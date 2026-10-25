export function timelineSummary(entries, selectedIndex = null) {
  const known = entries.filter(entry => /^[a-f0-9]{64}$/.test(entry.nationalHash ?? ''));
  const versions = new Set(known.map(entry => entry.nationalHash)).size;
  const completeMetadata = known.length === entries.length;
  const entry = selectedIndex === null ? null : entries[selectedIndex];
  const sameNational = completeMetadata && entries.length > 1 && versions === 1;
  const partial = entry && !entry.complete;
  const count = completeMetadata && entries.length
    ? `${entries.length} ${entries.length===1?'captura':'capturas'} · ${versions} ${versions===1?'versão nacional':'versões nacionais'}`
    : `${entries.length} ${entries.length===1?'captura arquivada':'capturas arquivadas'}`;
  const notes = [];
  if (sameNational) notes.push('As capturas disponíveis contêm o mesmo arquivo nacional do TSE. Os percentuais dos candidatos são iguais nessas capturas.');
  else if (entry) notes.push('Votos, percentuais e seções exibidos correspondem ao arquivo nacional preservado nesta captura.');
  else notes.push('A barra carrega votos, percentuais, seções e mapas dos arquivos preservados em cada captura.');
  if (partial) {
    const available = entry.availableSources;
    if (available?.includes('national') && !available.includes('states') && !available.includes('abroad')) notes.push('Captura parcial: os arquivos dos mapas ainda não estavam arquivados. A diferença no mapa não indica avanço da apuração.');
    else notes.push('Captura parcial: nem todas as fontes estavam arquivadas. Dados ausentes não são reconstruídos.');
  }
  return {count, note:notes.join(' '), sameNational, partial:Boolean(partial), versions};
}
