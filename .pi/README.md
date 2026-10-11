# .pi — субагенты и MCP-серверы для pi

Эта папка настраивает [pi coding-agent](https://github.com/badlogic/pi-mono) для работы с проектом.
Она читается **только pi** — другие агенты (Codex, Cursor и т.п.) её игнорируют; им достаточно `AGENTS.md` и `.ai/`.

## Требования

Нужен пакет pi-subagents; MCP-поддержка встроена в pi 0.99+ (отдельный пакет не нужен):

```bash
pi install npm:pi-subagents     # субагенты (subagent-инструмент, discovery .pi/agents/)
```

После установки перезапусти pi. При первом запуске в проекте pi спросит доверие к папке (trust) — это нормально: папка содержит проектные расширения и конфиги.

## Состав

| Файл | Назначение |
|------|-----------|
| `mcp.json` | MCP-серверы проекта (встроенный MCP pi 0.99+; проектный override глобального `~/.pi/agent/mcp.json`) |
| `settings.json` | Настройки pi проекта: сессии хранятся здесь же (`.pi/sessions/`, gitignored) |
| `agents/*.md` | Определения субагентов (pi-subagents: frontmatter + системный промпт) |
| `prompts/*.md` | Промпт-шаблоны: слэш-команды `/onboard`, `/tasks`, `/test`, `/fix-tests`, `/deploy`, `/page` |
| `scripts/ssh.sh`, `scripts/sftp.sh` | Обёртки MCP: читают `.env` (SSH_HOST/PORT/USER/PASSWORD) и запускают `ssh-mcp` / `sftp-ssh-mcp` |

> **Универсальные скиллы живут не здесь, а в `.agents/skills/`** — pi читает обе папки,
> но `.agents/skills/` понимают и другие харнессы. `.pi/skills/` оставьте для
> pi-специфичных скиллов, если появятся.

## MCP-серверы

| Сервер | Обёртка | Зачем |
|--------|---------|-------|
| `chrome-devtools` | `npx chrome-devtools-mcp` (подключение к Chrome CDP на `127.0.0.1:9222`) | Инспекция браузера: снапшоты, консоль, сеть |
| `ssh-connect` | `scripts/ssh.sh` → `npx ssh-mcp` | Shell на удалённом сервере |
| `sftp-connect` | `scripts/sftp.sh` → `npx sftp-ssh-mcp` | Передача файлов на/с сервера |

- Для ssh/sftp скопируй `.env.example` → `.env` и заполни креды, затем сними `"enabled": false` у `ssh-connect`/`sftp-connect` в `mcp.json`. `.env` gitignored.
- Chrome CDP: Chrome должен быть запущен с `--remote-debugging-port=9222` (или агент запустит его сам, если это поддерживает твой сценарий).
- `exposure: "direct"` объявляет инструменты сервера модели напрямую (замена `directTools: true` из pi-mcp-adapter). Другие режимы: `codemode` (доступны из codemode-скриптов), `deferred` (подгрузка через `tool_search`), `hidden` (модели не видны).
- `"enabled": false` у сервера держит запись в конфиге без подключения (по умолчанию так отключены ssh/sftp).
- Проект может переопределить глобальный сервер (pi 1.0.1+): запись в `.pi/mcp.json` БЕЗ `command`/`url` меняет только `enabled`/`exposure`/`toolExposure` сервера из `~/.pi/agent/mcp.json`; `/mcp` умеет включать/выключать сервер для текущего проекта.

## Субагенты

Формат frontmatter (pi-subagents) — ключевые поля:

```yaml
---
name: my-agent
description: Что делает и когда вызывать   # попадает в каталог субагентов
advertise: true                              # показать в системном промпте родителя
tools: read, grep, bash, mcp:ssh-connect     # СТРОГИЙ allowlist; mcp:<server> — весь MCP-сервер
excludeTools:                                # deny-поверх allowlist (опционально)
  - sftp_exec
model: <provider>/<model-id>                 # опционально: закрепить модель
systemPromptMode: replace                    # replace (по умолчанию) | append
inheritProjectContext: true                  # передавать ли AGENTS.md проекта в контекст ребёнка
inheritSkills: false
defaultContext: fresh                        # fresh | fork
defaultReads: docs/SOME-GUIDE.md             # файлы, читаемые перед запуском (опционально)
---
```

Правила, проверенные на практике:

- **Allowlist вместо deny-списка**: перечисли только нужные `tools` — всё остальное (включая `subagent` и чужие MCP) отсечётся само. `excludeTools` — только для точечных запретов внутри разрешённого сервера.
- `mcp:<server>` даёт ребёнку весь сервер; `mcp:<server>/<tool>` — отдельный инструмент. Точные имена инструментов зависят от MCP-сервера — сверяйся через `pi mcp list` или `tool_search`.
- Не давай субагентам доступа к `.env` и секретам; креды живут в обёртках `scripts/*.sh`.
- «Исполнитель не интерпретирует»: субагенты возвращают stdout/факты, решения принимает главный агент.

## Сессии — в проекте, не глобально

`.pi/settings.json` задаёт `"sessionDir": ".pi/sessions"` — истории переписки pi складываются
в `.pi/sessions/` этого проекта (путь резолвится от корня проекта) и переносятся вместе с ним (YandexDisk/перенос папки).
`pi -c`, `pi -r`, `/resume` работают как обычно — pi смотрит в проектную папку.

- В git сессии **не коммитятся** (`.pi/sessions/` в `.gitignore`): лог чата может содержать
  секреты и чувствительные данные.
- `kit-sync` сессии не трогает (копирует только комплектные файлы).
- Глобальные старые сессии остаются в `~/.pi/agent/sessions/` — их можно продолжать,
  запустив pi с `--session-dir ~/.pi/agent/sessions`, либо вручную переложить файлы
  в `.pi/sessions/` проекта.
- **Перенос на другой ПК**: `/resume` сравнивает cwd сессии с текущей папкой как строку,
  а абсолютные пути на разных машинах разные. После переноса запусти один раз
  `node scripts/session-cwd.mjs` в проекте (или мастер → пункт 5) — сессии перепривяжутся
  к новому пути. Если сессия открыта с несуществующим cwd, pi сам предложит «Continue».

## Адаптация под проект

1. Удали неиспользуемые серверы из `mcp.json` и ненужных агентов из `agents/`.
2. Замени плейсхолдеры (`<PROJECT>`, `<USER>`, `<SSH_PORT>`, `<SERVICE>`, `<SERVER_IP>`) в `agents/server-deployer.md` на значения проекта (или держи их в `.ai/PROJECT.md`).
3. При необходимости закрепи `model:` у агентов.
