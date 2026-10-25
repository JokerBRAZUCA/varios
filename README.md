# Apura Brasil

Dashboard para acompanhar o **segundo turno presidencial brasileiro de 2026**, eleição **6258**, cargo **1**. Funciona no navegador do celular e computador. Não usa backend, banco de dados, chave de API, analytics, CDN de bibliotecas ou API intermediária: as consultas saem do navegador diretamente para o TSE. Precisa apenas de uma hospedagem estática HTTPS para os arquivos da interface.

## Fonte oficial verificada

Página do TSE:
https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6258/uf/br/cargo/1/vis/nominal/resultados

Requisição de resultados usada pelo aplicativo oficial:

```text
GET https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.jws?nocache=<timestamp-em-milissegundos>
```

A captura de rede após clicar em **Atualizar** no aplicativo oficial confirmou HTTP 200 nessa URL, com alteração de `nocache`. O aplicativo consulta um arquivo unificado **JWS**, não o antigo `-r.json`. O painel usa a mesma URL e acrescenta `nocache` em cada consulta. A chave pública Ed25519 foi obtida do JavaScript do próprio TSE, build `26.10.17 (7216371)`, e está documentada em `public/tse.mjs`. O painel verifica a assinatura antes de exibir qualquer resultado. Se o TSE trocar a chave, é necessário conferir a nova chave no aplicativo oficial e atualizar o painel; não há fallback que ignore assinatura.

O catálogo oficial é `https://resultados.tse.jus.br/oficial/comum/config/ele-c.jws`. A associação de 6258 com Presidência, segundo turno e ciclo ele2026 foi conferida no catálogo. O arquivo unificado contém candidatos em `carg[].agr[].par[].cand[]`, seções em `s` e votos em `v`. O painel usa `s.pst`, `s.st`, `s.ts`, `v.vv`, `dg` e `hg`.

Acesso com origem externa foi testado e o TSE retornou `Access-Control-Allow-Origin` para a origem solicitante. Não há proxy público ou serviço intermediário. O navegador precisa suportar módulos JavaScript, Fetch e verificação Ed25519 via Web Crypto, em contexto seguro HTTPS (ou localhost para desenvolvimento).

## Comportamento

- Consulta inicial, botão Atualizar e consultas automáticas a cada 30 segundos, sem requisições sobrepostas.
- Percentuais dos candidatos sobre votos válidos, nomes e partidos vindos da fonte.
- Data de geração do arquivo oficial em horário de Brasília e horário da consulta no fuso do navegador.
- Rejeição de outra eleição, abrangência, turno ou assinatura inválida.
- Preservação dos últimos números da sessão em caso de erro, com aviso de atualização interrompida.
- Rejeição de arquivos com data de geração anterior à última recebida.
- Distinção entre progresso arredondado de 100% e totalização final indicada por `tf`.

A frequência de consulta não garante dados novos a cada 30 segundos: o TSE controla a geração e o cache dos arquivos. O painel é independente e não declara vencedor por conta própria.

## Desenvolvimento

Sem instalação de dependências. Use o checkout existente, sem criar worktree:

```sh
cd /workspace/varios
python3 -m http.server 8000 --bind 0.0.0.0 --directory public
```

O Python serve somente os arquivos locais; não consulta nem retransmite dados eleitorais. Não abra `index.html` por `file://`, pois a página usa módulos JavaScript.

Testes do adaptador e da assinatura (Node.js 24):

```sh
node --test tests/tse.test.mjs
```

Os testes unitários usam candidatos fictícios isolados e não fazem parte dos arquivos publicados. Uma resposta oficial real também foi verificada e a interface foi exercitada no Chromium, preservando validação TLS e os cabeçalhos CORS recebidos. Nesse ambiente, a automação precisou usar o transporte HTTPS do Python com a CA configurada, pois o Chromium não reconheceu a CA do proxy da sessão. Isso é uma particularidade da validação no ambiente, não uma dependência da aplicação.

## Publicar com GitHub Pages

1. Envie os arquivos para a branch `main` de `JokerBRAZUCA/varios`.
2. No GitHub, em **Settings → Pages → Build and deployment**, escolha **GitHub Actions**.
3. Em **Actions → Publicar dashboard → Run workflow**, execute o workflow incluído.
4. Abra o endereço HTTPS informado pelo GitHub Pages e confirme que o painel mostra “assinatura digital verificada”.

O workflow é manual: não publica automaticamente ao alterar código. O código foi enviado à branch `main`. A ativação do Pages e a execução do workflow ainda estão pendentes: o ambiente bloqueou o acesso à API do GitHub. Nenhuma publicação pública foi confirmada. A disponibilidade de Pages depende do plano e da visibilidade do repositório. Não há servidor de aplicação a manter.
