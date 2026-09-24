---
name: deploy-checklist
description: Чек-лист и подводные камни нативного деплоя Node.js-приложения на Linux (tar.gz-пакет, SFTP+SSH, systemd+nvm, UFW, npm ci, Vite dist). Читай перед планированием и исполнением деплоя.
---

# Чек-лист нативного деплоя

Плейсхолдеры: `<USER>` — юзер на сервере, `<APP_PATH>` — путь приложения, `<SERVICE>` — имя systemd unit, `<PORT>` — порт приложения.

## 1. Упаковка (tar.gz) — локально

```bash
mkdir -p .tmp && cd <repo-root>
tar --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./dist' \
    --exclude='./logs' \
    --exclude='./data' \
    --exclude='./.env' \
    --exclude='./playwright-report' \
    --exclude='./test-results' \
    --exclude='./.idea' \
    --exclude='./.tmp' \
    -czf .tmp/release.tar.gz .
tar -tzf .tmp/release.tar.gz | wc -l      # sanity-check
sha256sum .tmp/release.tar.gz             # зафиксировать для сверки
```

Исключения обязательны, потому что: `node_modules` ~270 МБ; `.env` содержит **чужие** секреты (локальные SSH-креды, не продовые); `dist` пересоберётся на сервере; `data` — продовая БД, затирать нельзя; `.tmp` — каталог с самим архивом (иначе tar в tar).

## 2. Заливка и распаковка

- Заливка — через SFTP одним файлом: `.tmp/release.tar.gz` → `<APP_PATH>/release.tar.gz`.
- На сервере (от `<USER>`, shell — только через SSH, не SFTP):

```bash
cd <APP_PATH> && \
  echo "--- SHA ---" && sha256sum release.tar.gz && \
  echo "--- распаковка поверх (НЕ удаляя .env, data, logs) ---" && \
  tar -xzf release.tar.gz && \
  echo "--- file count ---" && find . -type f -not -path './data/*' -not -path './node_modules/*' | wc -l && \
  rm -f release.tar.gz && echo "OK"
```

- **Проверка целостности**: `sha256sum` на сервере сравнить с локальным SHA. Расхождение = стоп, доложить.
- Обходные пути (`scp`, `rsync`, `tar | ssh`, `curl file://`) запрещены — ломают разделение SFTP (данные) / SSH (действия) и аудит логов.

## 3. systemd unit — специфика

- Путь к `node` в `ExecStart` — **абсолютный** (`/home/<USER>/.nvm/versions/node/vXX/bin/node`). nvm не подхватывается systemd без интерактивного shell; `bash -lc` в `ExecStart` — тоже не решение.
- `EnvironmentFile=<APP_PATH>/.env` — иначе приложение не увидит секретов и настроек БД (systemd не читает shell-профиль).
- `WorkingDirectory=<APP_PATH>` (не `apps/backend`!) — если билд использует относительные пути (`dist/main.js` → `apps/backend/data/...`).
- `WantedBy=multi-user.target` — без него автозапуск не сработает. После `systemctl enable` проверь симлинк: `ls /etc/systemd/system/multi-user.target.wants/`.
- `ProtectHome=read-only` — НЕ использовать, если приложение в `/home/<USER>` (сломает запись). Либо дефолт, либо перенос приложения в `/opt/` (тогда меняй пути).
- После правок юнита — `systemctl daemon-reload`.

## 4. UFW — обязательный шаг

`ufw` по умолчанию `deny (incoming)`. Без `ufw allow <PORT>/tcp` всё работает на сервере (`curl 127.0.0.1:<PORT>` = 200), но снаружи — `Connection refused`. Тихая проблема. Всегда: `ufw allow <PORT>/tcp` → проверка `ufw status verbose`.

## 5. nvm под sudo

Команды nvm — только под юзером: `sudo -u <USER> bash -lc 'nvm install 22 && nvm alias default 22'`. Без `bash -lc` HOME=/root и nvm ставится не тому пользователю.

## 6. npm ci vs npm install

Всегда `npm ci`: точно следует `package-lock.json`, не правит его, быстрее. На проде — воспроизводимость.

## 7. rm -rf dist перед билдом — обязательно на update

Vite при старом `dist/` переиспользует кэш роутера: новые чанки (lazy-views, компоненты) **молча не попадут в сборку** — build вернёт exit 0, сервис `active`, healthcheck 200, а приложение не изменилось.

```bash
sudo -u <USER> bash -lc 'cd <APP_PATH> && rm -rf apps/frontend/dist apps/backend/dist && npm run build'
```

Признак успешного обновления — **новые хеши** ассетов в логе билда (`dist/assets/NewView-XXXX.js`).

## 8. Запуск и проверка

```bash
systemctl start <SERVICE>   # затем sleep 2 (Node стартует 1-2 сек)
systemctl status <SERVICE>  # Active: active (running)
ss -tlnp | grep <PORT>      # слушает все интерфейсы, не только localhost
curl http://127.0.0.1:<PORT>/<healthcheck-endpoint>
```

`failed` → НЕ ретраить: вернуть `journalctl -xeu <SERVICE> -n 30` тому, кто принимает решение.
