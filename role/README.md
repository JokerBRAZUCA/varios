# Rolê

Party game para celular: rodadas de 1 minuto numa cidade cheia de muros, outdoors e fachadas que funcionam como espaço de anúncio. Endereço planejado: https://role.close4us.com

Este diretório é independente do painel da eleição. Não compartilha arquivos, serviços nem configuração do Nginx com ele.

## Estado atual (protótipo)
- Uma página estática (`public/index.html`), sem dependências nem build. Fontes vêm do Google Fonts.
- Modos: Batata Quente, Picha a Cidade e Corre Pra Loja. Três rodadas por partida.
- Os outros jogadores são bots. A fila de espera e a plateia são simuladas.
- Os anúncios mostrados são negócios e recados fictícios. A tela "Coloque seu recado na cidade" salva o anúncio só no navegador de quem enviou e não cobra nada.

## Rodar localmente
```sh
python3 -m http.server 8010 --bind 127.0.0.1 --directory role/public
```
Abra http://127.0.0.1:8010 (no celular, use as ferramentas de dispositivo do navegador).

## Publicar em role.close4us.com

### 1. DNS
No painel do domínio close4us.com, crie um registro **A** com nome `role` apontando para o IP da VPS (o mesmo de `eleicaopresidente.close4us.com`). Se houver IPv6, crie também o **AAAA**. Confira com:
```sh
dig +short role.close4us.com
```

### 2. Primeira instalação na VPS
Na sessão SSH, a partir de um checkout atualizado deste repositório:
```sh
(
set -eu
cd /root/eleicao-deploy-20261025
test -z "$(git status --porcelain)"
git pull --ff-only origin main
install -d -m 755 /var/www/role
cp -a role/public/. /var/www/role/
cp role/deploy/nginx-role.conf /etc/nginx/sites-available/role
ln -s /etc/nginx/sites-available/role /etc/nginx/sites-enabled/role
nginx -t
systemctl reload nginx
)
certbot --nginx -d role.close4us.com
```
O `certbot --nginx` emite o certificado e altera apenas o arquivo `/etc/nginx/sites-available/role`. As configurações dos outros sites não são alteradas.

### 3. Atualizar a versão publicada
```sh
(
set -eu
cd /root/eleicao-deploy-20261025
test -z "$(git status --porcelain)"
git pull --ff-only origin main
backup_dir=$(mktemp -d /root/role-backup-XXXXXXXX)
cp -a /var/www/role/. "$backup_dir/"
cp -a role/public/. /var/www/role/
printf 'Backup anterior: %s\n' "$backup_dir"
)
```
Publicar **somente `role/public/`**. Não precisa reiniciar o Nginx.

### Conferir depois de publicar
- https://role.close4us.com abre o jogo com cadeado (HTTPS).
- Colar o link numa conversa do WhatsApp mostra a imagem de prévia (`og.png`). O WhatsApp guarda prévias em cache; uma mudança na imagem pode demorar a aparecer.

## Próximas etapas
1. Multiplayer real: servidor Node.js com WebSocket, salas de 8, fila e bots que saem quando entra uma pessoa. Exigirá um serviço systemd e um `location` de proxy neste mesmo arquivo do Nginx.
2. Anúncios de verdade: envio de imagem, moderação antes de publicar, pagamento via Pix e contador de visualizações.
