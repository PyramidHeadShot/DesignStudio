# PROJECT — DesignStudio (сайт дизайн-студии)

> Карточка проекта. Заполняется агентом при онбординге (`.ai/playbooks/bootstrap.md`).
> Помечай неизвестное `?`, не выдумывай. Обновляй при изменениях.

## Назначение

Сайт дизайн-студии в стиле pentagram.com: портфолио-сетка, кейсы, минимализм,
типографика вместо декора. Аудитория — клиенты студии; сайт = витрина работ.

## Репозиторий

- origin: `https://github.com/PyramidHeadShot/DesignStudio.git`
- Коммитов пока нет; первый коммит — точечным `git add` (см. `playbooks/release.md`).

## Стек

Выбор зафиксирован 2026-01 (обоснование — `.ai/standards/design-principles.md`):

| Слой | Технология |
|------|-----------|
| Язык | TypeScript (strict) в Astro-компонентах |
| Frontend | Astro 5 (static), MDX для кейсов; JS — точечные islands (фильтр сетки); motion-слой — anime.js (правило 4 design-principles.md) |
| Стили | чистый CSS Grid, без Tailwind/UI-библиотек |
| Backend | нет — статика |
| БД | нет — контент кейсов: MDX-файлы в `site/src/content/cases/` |
| Тесты | нет; проверка = `npm run build` + Lighthouse 90+ |

## Команды

Рабочая папка сайта — `site/`:

| Действие | Команда (из `site/`) |
|----------|---------------------|
| Установка зависимостей | `npm install` |
| Dev-запуск | `npm run dev` (astro dev, localhost:4321) |
| Сборка | `npm run build` → `site/dist/` |
| Превью сборки | `npm run preview` |
| Тесты / линтер | нет |

## Структура

```
site/            — сайт (Astro): src/pages, src/layouts, src/content/cases (MDX), src/styles
site/src/config.ts — заглушки данных студии (название, герой, контакты) — заменить реальными
site/src/content.config.ts — схема коллекции кейсов (title, client?, year?, category, order…)
AGENTS.md        — роутер агента (универсальный; можно заменить проектным по templates/AGENTS-project.md)
.ai/             — правила, плейбуки, шаблоны, standards/design-principles.md, эта карточка
.agents/         — скиллы агента (deploy-checklist, keenetic, plc-vision, skill-installer)
.pi/             — субагенты, MCP-серверы (chrome-devtools, ssh/sftp), промпты
scripts/         — утилиты комплекта (kit-*.mjs, wol*, model-*) — к сайту не относятся
УСТАНОВКА.md     — инструкция комплекта (не сайта)
```

> Папка — одновременно мастер-копия комплекта agent-starter-kit.
> `kit-install.mjs`/`kit-sync.mjs` в саму себя не запускать.

## Окружение

- Файлы env: `.env` (gitignored), шаблон: `.env.example` (сейчас — только SSH-креды комплекта)
| Переменная | Назначение |
|------------|-----------|
| ? | ? (сайт пока без секретов; появятся при интеграциях) |

## Стандарты кода

- Conventional Commits, английские сообщения: `feat|fix|docs|chore(scope): кратко` (`playbooks/release.md`).
- Минимальный дифф; не переформатировать чужой код; мусор в коммит не брать.
- Изменил стек/команды/структуру → обнови эту карточку тем же коммитом.
- Комментарии — по стилю существующего кода; UI-тексты — ? (ru/en, `?`).
- Дизайн и вёрстка: чек-лист в `.ai/standards/design-principles.md` — сверяться при любой
  работе над UI. Референс: pentagram.com (плотная сетка, крупная типографика, монохром + акцент).
- JS только islands; кейсы — MDX со frontmatter по схеме `content.config.ts`.

## Деплой

- Пока нет. Кандидат: GitHub Pages — `astro.config.mjs` уже настроен под
  `https://pyramidheadshot.github.io/DesignStudio/` (site + base; сменить на `/` при кастомном домене).
- Для деплоя на свой сервер есть скилл `.agents/skills/deploy-checklist/`.

## Открытые вопросы

1. ~~Язык интерфейса~~ — **RU** (решено 2026-01, `lang="ru"` в `Base.astro`)
2. Все данные студии — ЗАГЛУШКИ в едином месте: `site/src/config.ts` (название, герой,
   email, телефон). Заменяются по мере появления реальных данных.
3. Кейсы — **тест-данные из pentagram.com** (6 шт., факты: клиент, дисциплины, партнёр;
   описания пересказаны по-русски). Это временный контент для оценки работы сетки и страниц:
   заменить реальными кейсами (~20 шт.). Не показывать как своё портфолио.
   pentagram год не публикует — `year` в схеме optional, сортировка по `order`.

## Известные проблемы / подводные камни

- Корень занят файлами комплекта (`kit-*`, `.pi/`, `.ai/`) — код сайта только в `site/`.
- npm 12 блокирует install-scripts (предупреждение про esbuild postinstall) — сборка при этом
  проходит; если на чистой машине упадёт esbuild — `npm install-scripts approve esbuild`.
- Креды ssh/sftp в `.env` — не коммитить.
