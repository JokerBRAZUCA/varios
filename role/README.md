# Rolê

Party game para celular: rodadas de 1 minuto numa cidade cheia de muros, outdoors e fachadas que funcionam como espaço de anúncio. Endereço planejado: https://role.close4us.com

Este diretório é independente do painel da eleição. Não compartilha arquivos, serviços nem configuração do Nginx com ele.

## Como funciona
- Salas de 15 jogadores numa cidade de 4×5 quarteirões. Quem entra ocupa o lugar de um bot, herdando posição e pontos; quem sai vira bot de novo. Uma sala nunca fica vazia de bonecos.
- Modos: Batata Quente (uma bomba a cada 8 jogadores), Picha a Cidade e Corre Pra Loja (os 5 primeiros pontuam: 10, 7, 5, 3 e 1). Três rodadas por partida; cada rodada vale de 15 pontos (1º) a 1 ponto (15º). Depois de 12 s de resultado, a próxima partida começa sozinha.
- Sala de amigos: "Criar sala com código" gera um código de 5 caracteres (sem letras que se confundem, como O e 0). Quem cria é o anfitrião e vê o botão "Começar partida"; os outros entram digitando o código ou abrindo o link `https://role.close4us.com/#CODIGO`, que já preenche o campo. Enquanto esperam, todos andam pela cidade. Bots completam as vagas que sobrarem. Se o anfitrião sair, outra pessoa da sala assume. A sala some 60 s depois que todos saem. Salas de amigos não recebem gente da fila pública.
- Placar ao vivo com os 3 primeiros e a posição do jogador. No fim, os 8 melhores e a posição do jogador, se estiver fora deles.
- Fila de espera: quando todas as salas estão cheias (`MAX_ROOMS` × `ROOM_SIZE`), quem chega assiste à sala mais cheia, pode reagir e conversar, e entra quando abre vaga. No fim de cada partida, até 3 pessoas do fim da tabela dão a vez a quem está na fila.
- Chat com balões e feed. Os bots comentam o jogo e respondem. O servidor limpa palavrões e links (`cleanChat`) e limita o ritmo: uma mensagem a cada 1,2 s por pessoa. O jogador pode esconder o chat.
- Sem servidor (ou na prévia do claude.ai), o mesmo jogo roda no navegador só com bots.
- A tela "Coloque seu recado na cidade" é demonstração: o anúncio fica salvo só no navegador de quem enviou e não cobra nada.

## Arquivos
- `public/game.mjs`: regras, cidade, física, bots, modos e zoeira. Usado pelo servidor e pelo navegador.
- `public/client.mjs`: desenho, controles, telas e rede. Online, prevê o próprio boneco e suaviza os outros com 110 ms de atraso.
- `public/index.html`, `og.png`, `favicon.svg`: página, imagem de prévia de link e ícone.
- `server/server.mjs`: salas públicas e de amigos, fila, rodízio, chat e envio de estado (30 passos/s; 15 atualizações/s por jogador com só quem está perto). Sem dependências npm.
- `server/ws.mjs`: WebSocket mínimo (RFC 6455), só texto, até 4 KB por mensagem.
- `server/loadtest.mjs`: teste de carga com conexões reais.
- `deploy/nginx-role.conf`, `deploy/role-server.service`: Nginx e systemd.
- `tests/server.test.mjs`: testes.

## Rodar localmente
Node.js 22 ou mais novo, sem `npm install`:
```sh
node role/server/server.mjs --dev
```
Abra http://127.0.0.1:8090 em duas abas (ou no celular, na mesma rede, trocando `HOST=0.0.0.0`). Para ver a fila com poucas pessoas: `MAX_ROOMS=1 ROOM_SIZE=2 node role/server/server.mjs --dev` e abra três abas. Para a sala de amigos: numa aba toque em "Criar sala com código" e, na outra, abra `http://127.0.0.1:8090/#CODIGO`.

Testes:
```sh
node --test role/tests/*.test.mjs
```

### Configuração do servidor (variáveis de ambiente)
| Variável | Padrão | O que faz |
|---|---|---|
| `PORT` / `HOST` | `8090` / `127.0.0.1` | Endereço local; o Nginx repassa `/ws` para cá |
| `MAX_ROOMS` | `50` | Salas simultâneas (públicas e de amigos); acima disso, fila, e não dá pra criar sala de amigos |
| `ROOM_SIZE` | `15` | Jogadores por sala (pessoas + bots) |
| `MAX_PER_IP` | `6` | Conexões por IP |
| `ALLOWED_ORIGINS` | vazio (aceita qualquer) | Origens aceitas no WebSocket, separadas por vírgula |
| `TRUST_PROXY` | ligado | Usa `X-Forwarded-For` só quando a conexão vem do próprio servidor (Nginx) |

`GET /healthz` no endereço local mostra salas (e quantas são de amigos), jogadores, fila, tempo por passo e banda. O Nginx não publica essa rota.

## Capacidade medida
`server/loadtest.mjs` com conexões que andam, empurram e conversam, servidor num núcleo (o gerador de carga rodava na mesma máquina):

| Jogadores | Salas de 15 | Tempo por passo (limite 33 ms) | CPU do processo | Banda por jogador |
|---|---|---|---|---|
| 500 | 34 | 4 ms | ~30% de um núcleo | ~4,5 KB/s |
| 1.000 | 67 | 7 ms | ~50% | ~3,6 KB/s |

O Node usa um núcleo. Para a VPS KVM 2 (2 vCPU, dividida com o painel e o Nginx), o padrão é `MAX_ROOMS=50`: até 750 jogadores, cerca de 3 MB/s (~25 Mbps) no pico. Dá para subir `MAX_ROOMS` depois de medir na própria VPS. Para medir na própria VPS, com o serviço parado ou numa porta de teste:
```sh
PORT=8099 MAX_PER_IP=5000 node role/server/server.mjs &
node role/server/loadtest.mjs 500 30 ws://127.0.0.1:8099/ws
```

## Publicar em role.close4us.com

### 1. DNS
No painel do domínio close4us.com, crie um registro **A** com nome `role` apontando para o IP da VPS (o mesmo de `eleicaopresidente.close4us.com`). Se houver IPv6, crie também o **AAAA**. Confira com:
```sh
dig +short role.close4us.com
```

### 2. Primeira instalação na VPS
Confira antes que `node -v` mostra 22 ou mais e que `/usr/bin/env node` encontra o Node fora do seu usuário (`sudo -u nobody /usr/bin/env node -v`).
```sh
(
set -eu
cd /root/eleicao-deploy-20261025
test -z "$(git status --porcelain)"
git pull --ff-only origin main
node --test role/tests/*.test.mjs
install -d -m 755 /var/www/role /opt/role
cp -a role/public/. /var/www/role/
cp -a role/public role/server /opt/role/
cp role/deploy/role-server.service /etc/systemd/system/role-server.service
systemctl daemon-reload
systemctl enable --now role-server
sleep 1; curl -s http://127.0.0.1:8090/healthz; echo
cp role/deploy/nginx-role.conf /etc/nginx/sites-available/role
ln -s /etc/nginx/sites-available/role /etc/nginx/sites-enabled/role
nginx -t
systemctl reload nginx
)
certbot --nginx -d role.close4us.com
```
O `certbot --nginx` emite o certificado e altera apenas `/etc/nginx/sites-available/role`. As configurações dos outros sites não são alteradas.

### 3. Atualizar a versão publicada
```sh
(
set -eu
cd /root/eleicao-deploy-20261025
test -z "$(git status --porcelain)"
git pull --ff-only origin main
node --test role/tests/*.test.mjs
backup_dir=$(mktemp -d /root/role-backup-XXXXXXXX)
cp -a /var/www/role "$backup_dir/www"; cp -a /opt/role "$backup_dir/opt"
cp -a role/public/. /var/www/role/
rm -rf /opt/role.new && install -d /opt/role.new && cp -a role/public role/server /opt/role.new/
rm -rf /opt/role.old && mv /opt/role /opt/role.old && mv /opt/role.new /opt/role
systemctl restart role-server
sleep 1; curl -s http://127.0.0.1:8090/healthz; echo
printf 'Backup anterior: %s\n' "$backup_dir"
)
```
Reiniciar o serviço derruba as partidas em andamento; quem estiver jogando volta pela tela inicial. Prefira horários de pouco movimento.

### Conferir depois de publicar
- https://role.close4us.com abre o jogo com cadeado (HTTPS).
- Duas abas (ou dois celulares) entram na mesma sala: o contador mostra "2 pessoas na sala".
- Sala de amigos: um celular cria, o outro abre o link com o código, e "Começar partida" leva os dois para a mesma rodada.
- `journalctl -u role-server -n 50` sem erros; `curl -s http://127.0.0.1:8090/healthz` com `tickMs` bem abaixo de 33.
- Colar o link numa conversa do WhatsApp mostra a imagem de prévia (`og.png`). O WhatsApp guarda prévias em cache; uma mudança na imagem pode demorar a aparecer.

## Próximas etapas
1. Anúncios de verdade: envio de imagem, moderação antes de publicar, pagamento via Pix e contador de visualizações; o servidor passaria a mandar os anúncios da cidade para todos.
2. Moderação do chat com denúncia e silenciar jogador.
3. Protocolo binário para reduzir a banda por jogador, se o tráfego pesar.
