# Apura Brasil

Painel independente da apuração presidencial de 2026 (eleição 6258, cargo 1). Interface estática em `public/`, publicada na VPS em https://eleicaopresidente.close4us.com.

## Uso
- Consulta direta do navegador ao TSE, com verificação Ed25519 dos arquivos JWS. TLS e assinaturas não são ignorados.
- Mapa do Brasil com 27 UFs; mapa-múndi com países e territórios agrupando os 186 locais de votação no exterior presentes no catálogo verificado.
- As cores mostram **seções totalizadas**, sem atribuir cores a candidatos ou projetar resultados. Percentuais por país são ponderados pela soma das seções.
- Clique em uma UF para ver os percentuais e votos de cada candidato abaixo da totalização. O arquivo de votos tem seu próprio horário e assinatura; se estiver zerado ou tiver uma totalização diferente do mapa, isso fica explícito. Os valores não são inferidos do progresso das seções. A consulta dos candidatos continua disponível mesmo quando falta o progresso do mapa.
- Fotos oficiais do TSE nos cartões nacionais e nas UFs, associadas pelo identificador de candidatura do JWS verificado. Cópias das imagens ficam em `public/assets/candidates/`, com procedência em `sources.json`; falhas de imagem exibem iniciais sem afetar os resultados.
- Votos brancos e nulos aparecem no resumo nacional e na UF selecionada, com quantidades e percentuais oficiais sobre o total de votos (`vb/pvb` e `tvn/ptvn`). Os percentuais dos candidatos usam votos válidos. Esses dados também seguem a captura selecionada e os backups; arquivos sem esses campos mostram ausência, sem inventar zeros. Um resultado de UF já verificado fica preservado na sessão caso falhem tanto o TSE quanto o arquivo da VPS.
- Linha do tempo logo abaixo dos dados dos candidatos. O contador distingue capturas de versões nacionais diferentes; capturas parciais são identificadas. Se duas capturas preservam o mesmo arquivo nacional, os percentuais permanecem iguais. Uma seleção carrega a captura inteira: candidatos, votos, percentuais, seções, mapas e respectivos horários. O botão Ao vivo retorna às consultas atuais.
- A reprodução percorre apenas capturas reais. Não há interpolação nem reconstrução de versões anteriores à primeira captura.
- O botão Ativar som habilita um tom sintetizado inspirado na confirmação da urna. O navegador exige interação para liberar áudio. Uma nova versão verificada pode tocar; consultas idênticas, abertura inicial e reprodução do histórico ficam silenciosas.
- Se o TSE falhar, a interface consulta o arquivo da VPS e verifica novamente hash e assinatura. O modo BACKUP e o horário de captura ficam visíveis. Sem backup acessível, preserva os últimos dados já recebidos na sessão; nunca inventa resultados.

## Fontes
- Nacional: https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.jws
- Votos por UF: `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/{uf}/{uf}-c0001-e006258-u.jws`, com código de duas letras em minúsculas.
- Progresso por UF e consolidado exterior: https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-e006258-ab.jws
- Progresso dos locais no exterior: https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz/zz-e006258-ab.jws
- Catálogo oficial de localidades: https://resultados.tse.jus.br/oficial/ele2026/6258/config/mun-e006258-cm.jws
- Aplicativo oficial: https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6258/uf/br/cargo/1/vis/nominal/resultados

A chave pública do aplicativo oficial, build 26.10.17 (7216371), está documentada em `public/tse.mjs`. Uma chave desconhecida ou assinatura inválida é rejeitada, inclusive nos backups.

As fontes têm gerações independentes. Se o detalhamento internacional divergir do consolidado do exterior, há aviso visível; os valores não são completados por estimativa. Zero seções e ausência de dados são estados diferentes. O resumo nacional inclui votos no exterior, enquanto Brasil no mapa-múndi representa apenas seções no território brasileiro.

Malhas simplificadas: [IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3) e [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/). O arquivo `public/assets/places.json` associa os códigos e nomes do catálogo do TSE aos agrupamentos geográficos; as posições dos pontos no mapa-múndi são referências dos países/territórios, e não coordenadas dos locais de votação.

## Arquivo na VPS
A interface permanece estática e as consultas ao vivo continuam diretas ao TSE. Um coletor Node.js separado arquiva os JWS para continuidade e histórico; ele não fornece uma API intermediária.

- Código do coletor: `/opt/eleicaopresidente-archive/archive/collect.mjs`, com seus módulos em `../public/`.
- Dados: `/var/lib/eleicaopresidente-archive/public/`.
- Serviço: `eleicaopresidente-archive.service`; agendamento: `eleicaopresidente-archive.timer`, com intervalo de 30 segundos após cada execução.
- São consultadas as três fontes de acompanhamento e os 27 arquivos de votos das UFs, com no máximo quatro consultas simultâneas. O navegador consulta apenas a UF selecionada; no histórico, carrega o arquivo referenciado na captura. Capturas anteriores à inclusão dos arquivos de UF indicam a ausência, sem usar dados atuais.
- Arquivos JWS são preservados por SHA-256. Capturas referenciam os últimos arquivos válidos de cada fonte e preservam o horário de geração de cada um. Repetições não geram cópias adicionais.
- Falha de rede, HTTP de erro, assinatura inválida e regressão de geração não substituem o último arquivo válido.
- `latest.json` informa a última tentativa, referências válidas e falhas; `index.json` lista capturas com novas versões; `snapshots/` e `tokens/` preservam conteúdo.
- Nginx publica o arquivo apenas para leitura em `/historico/`, sem listagem de diretórios. O coletor não abre portas.

A amostragem não garante capturar todas as publicações que o TSE possa substituir entre consultas. O histórico começa na primeira captura observada, identificada na interface. O arquivo está no mesmo servidor e protege contra indisponibilidade da fonte; não é uma cópia em outra máquina.

## Desenvolvimento e validação
Node.js 24, sem dependências npm:

```sh
node scripts/build-maps.mjs
node --test tests/tse.test.mjs tests/archive.test.mjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory public
```

A geração das malhas requer acesso HTTPS ao IBGE e ao repositório oficial do Natural Earth. `public/assets/maps.json` é gerado, não versionado. Os demais arquivos de `public/` estão no repositório. Não abra por `file://`, pois são usados módulos ES. Para histórico local, é necessário mapear `/historico/` a um arquivo de capturas; em produção isso já é feito pelo Nginx.

Os testes usam amostras oficiais assinadas preservadas em `tests/fixtures/` e dados sintéticos exclusivamente em testes isolados. Nenhuma fixture é publicada na área pública. Há testes para integridade, assinatura, cobertura geográfica, deduplicação, preservação em falha e comportamento do som.

## Atualizar a versão publicada
Na sessão SSH da VPS:

```sh
(
set -eu
cd /root/eleicao-deploy-20261025
test -z "$(git status --porcelain)"
git pull --ff-only origin main
node scripts/build-maps.mjs
node --test tests/tse.test.mjs tests/archive.test.mjs
backup_dir=$(mktemp -d /root/eleicaopresidente-v5-backup-XXXXXXXX)
cp -a /var/www/eleicaopresidente-v5/. "$backup_dir/"
cp -a public/. /var/www/eleicaopresidente-v5/
printf 'Backup anterior: %s\n' "$backup_dir"
)
```

Publicar **somente `public/`**, incluindo seus módulos e `assets/`. Não copiar checkout, `.git`, fixtures, scripts de desenvolvimento ou credenciais para a área pública. Atualizações estáticas não exigem reiniciar Nginx. Abra o HTTPS público, confirme origem, horários e assinatura e teste a linha do tempo. Uma atualização do coletor deve ser instalada separadamente em seu diretório, usando substituição atômica e conferindo os registros do serviço.

## Recuperação e serviços existentes
A configuração exclusiva deste subdomínio fica em `/etc/nginx/sites-available/eleicaopresidente`. O backup original completo do Nginx fica em `/root/eleicao-nginx-backup-20261025`. As configurações dos demais sites não foram alteradas.

A primeira versão foi preservada em `/var/www/eleicaopresidente`. Para recuperação da interface, é possível restaurar apenas o `root` do bloco HTTPS deste subdomínio para esse diretório, validar com `nginx -t` e recarregar Nginx. Não substitua a configuração global nem restaure todos os sites por causa deste painel. O diretório de desafios HTTP do Certbot deve continuar sendo o configurado na emissão original, para preservar a renovação.

## Painel ampliado (outubro de 2026)
A interface inclui notícias CNN Brasil/g1/UOL, sessões ativas nos últimos 60 segundos, eleitorado, participação parcial, gráfico histórico, percentuais no exterior e comparação nacional com marca de 50%. Todas as informações eleitorais selecionadas acompanham a captura da linha do tempo; notícias e acessos são atuais e identificados separadamente.

Gere as malhas com `node scripts/build-maps.mjs` e `node scripts/build-municipalities.mjs`. O segundo usa a malha municipal do IBGE e o catálogo assinado do TSE. Há 5.570 geometrias e 5.571 localidades no catálogo; a cobertura é explicitada na interface. Azul/vermelho indicam a maior participação publicada, sem declarar vencedor.

Os coletores `archive/municipal.mjs` e `archive/sections.py` são independentes do coletor nacional. O primeiro verifica assinaturas municipais e preserva os tokens e resumos imutáveis. O segundo baixa os arquivos oficiais de eleitorado por local e votação por seção, verifica o turno e publica conjuntos por UF com SHA-256. Seções agregadas usam a principal. Coordenadas inválidas são omitidas; os pontos de seções no mesmo local são separados visualmente e podem ser selecionados pela lista.

O arquivo consolidado por seção pode ser publicado somente ao fim do turno. Enquanto não houver linhas do segundo turno, os pontos ficam neutros e a interface informa a ausência. Os boletins individuais do aplicativo TSE não são decodificados por este coletor. O sistema não usa votos do primeiro turno para preencher essa lacuna. Na linha do tempo, detalhes que não estavam arquivados na captura permanecem indisponíveis.

`live/server.mjs` mantém notícias em cache e presença em memória, com sessões aleatórias e expiração de 60 segundos, sem nomes ou IPs no contador. Os títulos são links para os veículos e não são relacionados à captura histórica. Confira os diretórios do código e as unidades de serviço antes de uma nova instalação; o ambiente publicado utiliza versões preservadas e troca apenas a raiz HTTPS deste subdomínio.
