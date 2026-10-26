#!/usr/bin/env bash
# Разовая подготовка сервера: Node.js 22, systemd-сервис, nginx и сертификат.
# Повторный запуск безопасен. После него выкладка — ./deploy/deploy.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-root@denisenkosergey.ru}"
NODE_VERSION="${NODE_VERSION:-v22.23.2}"

cd "$(dirname "$0")"
scp -q planpoker.service "$HOST:/etc/systemd/system/planpoker.service"
scp -q nginx/planpoker.conf "$HOST:/tmp/planpoker.conf"

ssh "$HOST" "
  set -e
  # Node ставим из официального архива в /opt/node, без apt и чужих репозиториев
  if [ \"\$(/opt/node/bin/node -v 2>/dev/null)\" != '$NODE_VERSION' ]; then
    curl -fsSL https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz -o /tmp/node.tar.xz
    rm -rf /opt/node && mkdir -p /opt/node
    tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1
    rm /tmp/node.tar.xz
  fi
  mkdir -p /opt/planpoker /var/www/planpoker
  systemctl daemon-reload
  systemctl enable planpoker

  # Конфиг nginx ставим, только пока certbot его не дополнил
  if [ ! -f /etc/nginx/sites-available/planpoker ]; then
    mv /tmp/planpoker.conf /etc/nginx/sites-available/planpoker
    ln -sf /etc/nginx/sites-available/planpoker /etc/nginx/sites-enabled/planpoker
    nginx -t && systemctl reload nginx
    certbot --nginx -d planpoker.denisenkosergey.ru --non-interactive --redirect
  fi
"
echo "Сервер готов, теперь ./deploy/deploy.sh"
