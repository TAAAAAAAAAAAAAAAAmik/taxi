#!/usr/bin/env bash
# Установка бэкенда Kinetix на чистый RU VPS (Ubuntu 22.04/24.04, root).
# Делает всё: Node 22, код, systemd-сервис с автоперезапуском, HTTPS через
# Caddy (домен-по-IP sslip.io — свой домен не обязателен).
#
# Запуск на сервере (под root):
#   REPO_URL=https://github.com/TAAAAAAAAAAAAAAAAmik/taxi.git \
#   ADMIN_PASSWORD='твой_пароль_админки' \
#   CARD_NUMBER='2200XXXXXXXXXXXX' CARD_HOLDER='Иванов Иван' \
#   bash setup-vps.sh
#
# Если репозиторий приватный — в REPO_URL подставь токен:
#   https://<GITHUB_TOKEN>@github.com/TAAAAAAAAAAAAAAAAmik/taxi.git
set -euo pipefail

REPO_URL="${REPO_URL:?Укажи REPO_URL=https://github.com/.../taxi.git}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Укажи ADMIN_PASSWORD=пароль_админки}"
CARD_NUMBER="${CARD_NUMBER:-}"
CARD_HOLDER="${CARD_HOLDER:-}"
APP_DIR=/opt/kinetix
DATA_DIR=/var/lib/kinetix
BRANCH="${BRANCH:-claude/github-taxi-project-ho7q97}"

echo "==> Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates

echo "==> Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "==> Код приложения ($BRANCH)"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin "$BRANCH" && git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
npm ci --omit=dev

echo "==> Данные и окружение"
mkdir -p "$DATA_DIR"
cat > /etc/kinetix.env <<ENV
PORT=3100
MVP_DB_PATH=$DATA_DIR/db.json
MVP_ADMIN_PASSWORD=$ADMIN_PASSWORD
MVP_PAYMENT_PROVIDER_MODE=manual
MVP_PAYMENT_PROVIDER=manual-card
PAYMENT_CARD_NUMBER=$CARD_NUMBER
PAYMENT_CARD_HOLDER=$CARD_HOLDER
EXPO_PUBLIC_APP_ENV=production
ENV
chmod 600 /etc/kinetix.env

echo "==> systemd-сервис"
cat > /etc/systemd/system/kinetix.service <<'UNIT'
[Unit]
Description=Kinetix taxi backend
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/kinetix.env
WorkingDirectory=/opt/kinetix
ExecStart=/usr/bin/node scripts/mvp-backend.mjs
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now kinetix

echo "==> HTTPS-домен"
PUBLIC_IP="$(curl -4 -s ifconfig.me)"
DOMAIN="${DOMAIN:-${PUBLIC_IP//./-}.sslip.io}"
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    reverse_proxy 127.0.0.1:3100
}
CADDY
systemctl restart caddy

sleep 3
echo
echo "=================================================================="
echo "Готово! Бэкенд: https://$DOMAIN"
echo "Проверка:      https://$DOMAIN/health"
echo "Пришли этот URL Claude — он пересоберёт приложение под сервер."
echo "Логи:          journalctl -u kinetix -f"
echo "Обновление:    cd $APP_DIR && git pull && systemctl restart kinetix"
echo "=================================================================="
