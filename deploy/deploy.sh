#!/usr/bin/env bash
# Сборка и выкладка PlanPoker на https://planpoker.denisenkosergey.ru
# Нужен SSH-доступ по ключу: root@denisenkosergey.ru. На сервере нет rsync — передаём архивом.
# Сервер один раз готовится скриптом deploy/setup-server.sh.
set -euo pipefail

HOST="${DEPLOY_HOST:-root@denisenkosergey.ru}"
WEB=/var/www/planpoker
APP=/opt/planpoker

cd "$(dirname "$0")/.."
npm run build

# Статика: новая версия распаковывается рядом и подменяет старую одним mv
COPYFILE_DISABLE=1 tar --no-xattrs -czf - -C dist . | ssh "$HOST" "
  set -e
  rm -rf $WEB.new && mkdir -p $WEB.new
  tar -xzf - -C $WEB.new --no-same-owner
  chown -R www-data:www-data $WEB.new
  rm -rf $WEB.old
  if [ -d $WEB ]; then mv $WEB $WEB.old; fi
  mv $WEB.new $WEB
  rm -rf $WEB.old
"

# Сервер комнат — один файл без node_modules. Перед перезапуском он сохраняет комнаты в базу,
# клиенты переподключатся сами и заново займут места
scp -q dist-server/index.cjs "$HOST:$APP/index.cjs.new"
ssh "$HOST" "mv $APP/index.cjs.new $APP/index.cjs && systemctl restart planpoker && sleep 1 && curl -fsS http://127.0.0.1:8787/health"
echo
echo "Готово: https://planpoker.denisenkosergey.ru"
