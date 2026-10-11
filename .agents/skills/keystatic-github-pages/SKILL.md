---
name: keystatic-github-pages
description: Полный опыт настройки Keystatic-админки для статического Astro-сайта на GitHub Pages — dev/prod режимы, base-пути, OAuth-колбэки, Keystatic Cloud, деплой через Actions. Читай при любой задаче «сделать админку для клиента на статическом сайте», «настроить Keystatic», «деплой Astro на GitHub Pages».
---

# Keystatic + GitHub Pages: админка для статического сайта

Опыт реального проекта (DesignStudio, Astro 5 + Keystatic 0.6.9, репо в подпапке `site/`, Pages по пути `/DesignStudio`). Все грабли здесь — настоящие, каждая была найдена отладкой вживую.

## 0. Выбор архитектуры (решать ДО кода)

| Режим | Где контент | Нужен сервер | Когда выбирать |
|---|---|---|---|
| `local` | файлы на диске | да (dev-сервер) | контент правит разработчик |
| `github` | GitHub-репо | **да** (API-роуты SSR) | клиент правит сам, есть VPS |
| `cloud` | БД Keystatic Cloud + синк-коммиты в репо | **нет** (статика!) | клиент правит сам, хостинг статический |

**Критично:** `github`-режим НЕ работает на чистой статике — API-роуты требуют Node-процесс. Для GitHub Pages единственный клиентский вариант — `cloud` (Keystatic Cloud, бесплатно до 3 юзеров/команда).

**Подводный камень cloud-режима:** Keystatic Cloud хранит контент в СВОЕЙ БД — существующий контент из репо в админке НЕ виден (будет «0 entries»). Cloud коммитит пути **от корня репо** — если сайт в подпапке (`site/`), пути разъедутся. Решения: сайт в корень репо, или тестовый период на local + перенос контента руками.

**Проверенный workflow для «клиент одобряет → потом сам правит»:**
1. Разработчик правит в local-админке на своём ПК → коммит+пуш → Pages обновляется
2. Клиент смотрит прод-URL и даёт правки
3. После одобрения: VPS + `github`-режим (или cloud, если пути разрулены) → админка клиенту

## 1. Dev-режим: инжект роутов и base-путь

Keystatic-роуты инжектятся **только в dev** (static build без adapter не может иметь SSR-роутов — официальный плагин ломает билд):

```js
// astro.config.mjs
function keystaticDev() {
  return {
    name: 'keystatic-dev-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig, command, config }) => {
        if (command === 'dev') {
          updateConfig({ vite: { plugins: [/* резолвер + мост, см. ниже */] } });
          injectRoute({ entrypoint: './src/pages/keystatic.astro', pattern: '/keystatic/[...params]', prerender: false });
          injectRoute({ entrypoint: './src/keystatic/keystatic-api.ts', pattern: '/api/keystatic/[...params]', prerender: false });
        }
      },
    },
  };
}
```

- Паттерн страницы — **`/keystatic/[...params]`** (официальный): роутер Keystatic жёстко зашит на путь `/keystatic` (RouterProvider стрипает `/^\/keystatic\/?/` от `location.pathname`). Паттерн `/admin/...` даёт «Not found».
- API — **catch-all `/api/keystatic/[...params]`**: UI дергает не только `tree`/`update`, но и `blob/<sha>/<filepath>` (без него карточки падают с «Could not fetch blob»). Роутинг по суффиксу делает `makeGenericAPIRouteHandler`.
- Резолвер `virtual:keystatic-config` нужен и в dev, и в build (если страница админки собирается статически):

```js
{ name: 'keystatic-config-resolver',
  resolveId(id) { return id === 'virtual:keystatic-config' ? this.resolve('./keystatic.config', './a') : null; } }
```

### 1.1. Astro dev с `base` ≠ '/': три ловушки

1. **baseMiddleware 404-ит html-запросы вне base** ДО всех интеграционных мидлварей. `astro:server:setup` + `server.middlewares.use()` НЕ работает — Astro unshift-ит свой baseMiddleware в начало стека через post-hook `configureServer`, и любой интеграционный мидлварь оказывается после него → двойная обработка URL → **ломаются ВСЕ роуты** (проверено). Решение — свой Vite-плагин с таким же post-hook unshift (он выполнится после Astro-хука и встанет перед baseMiddleware):

```js
{ name: 'keystatic-base-bridge',
  configureServer(server) {
    return () => {  // post-hook!
      server.middlewares.stack.unshift({
        route: '',
        handle(req, res, next) {
          const u = req.url || '';
          if (u === '/keystatic' || u.startsWith('/keystatic/') ||
              u === '/api/keystatic' || u.startsWith('/api/keystatic/')) {
            req.url = base + u;  // base = '/DesignStudio'
          }
          next();
        },
      });
    };
  } }
```

2. **Astro middleware (`src/middleware.ts`) не спасает**: для несматченных html-роутов он не вызывается (404 отдаётся раньше).
3. **`optimizeDeps.entries` обязателен**: без скан-файла часть графа Keystatic (raw-subpath'ы react-aria/react-stately, CJS-транзитивки) грузится сырьём → дубли React-контекстов («Attempt to access context outside of KeystarProvider») в редакторе. Официальный плагин создаёт `.astro/keystatic-imports.js` с импортами `@keystatic/astro/ui` + `@keystatic/core/ui` (НЕ `@keystatic/astro/api` — тянет `astro:env/server`, который esbuild-сканер не резолвит) и прописывает `optimizeDeps.entries: ['keystatic.config.*', '.astro/keystatic-imports.js']`.

### 1.2. CJS-модули без ESM-обёртки

Симптом: `[astro-island] Error hydrating ... SyntaxError: The requested module '.../acorn-jsx/index.js' does not provide an export named 'default'`. Лечение: добавить модуль в `optimizeDeps.include`. Типичные жертвы графа Keystatic: `acorn-jsx`, `slate-dom`, `use-sync-external-store/shim`, `@braintree/sanitize-url`, `emulate`... Диагностика — по тексту ошибки в консоли браузера.

### 1.3. Схема коллекции

`path` коллекции обязан содержать маску слага: `path: 'src/content/cases/*'` (иначе «Collection path must end with /* or /**»). `fields.slug` рендерит ДВА инпута (имя + слаг) — при создании заполнять оба, иначе в YAML уедет пустой `slug`.

## 2. Прод: статическая страница админки + патчи base-пути

С GitHub-хранилищем (cloud) серверные роуты не нужны — страница админки собирается как обычная статика:

```astro
---
// src/pages/keystatic.astro
import { Keystatic } from '../keystatic/keystatic-entry.js';
---
<Keystatic client:only="react" />
<!-- + скрипт панели предпросмотра, стили инжектятся из скрипта -->
```

```js
// src/keystatic/keystatic-entry.js
import { makePage } from '@keystatic/astro/ui';
import config from 'virtual:keystatic-config';  // НЕ прямой импорт конфига!
export const Keystatic = makePage(config);
```

**Прямой импорт конфига в клиентский граф дублирует React/yjs** → «Invalid hook call», «Yjs was already imported». Только virtual-модуль.

### 2.1. Патч строк в dist @keystatic/core (build)

На Pages сайт живёт на `{base}/keystatic`, а роутер/ссылки Keystatic зашиты на `/keystatic`. Патчим через Vite `transform` (только `command === 'build'`):

```js
{ name: 'keystatic-base-patch',
  transform(code, id) {
    if (!id.includes('@keystatic/core/dist/')) return null;
    const baseRe = base.split('/').join('\\/');  // экранировать слэши для regex!
    let out = code
      .replaceAll('"/keystatic', `"${base}/keystatic`)   // двойные кавычки
      .replaceAll("'/keystatic", `'${base}/keystatic`)   // одинарные (basePath: '/keystatic')
      .replaceAll('}/keystatic/cloud/oauth/callback', '}' + base + '/keystatic/cloud/oauth/callback')  // шаблонные литералы ${origin}/...
      .replaceAll('`/keystatic', '`' + base + '/keystatic')  // push-редиректы после логина
      .split('/^\\/keystatic\\/?/').join(`/^(?:${baseRe})?\\/keystatic\\/?|\\/$/g`);  // regex роутера
    return out === code ? null : { code: out, map: null };
  } }
```

Грабли:
- **Regex-литерал ломается от неэкранированного слэша** в подстановке (`/^(?:/DesignStudio)?.../` → «Unknown regular expression flags»). Экранировать.
- **Альтернатива внутри regex**: `|\/$/g` вставляется ПОСЛЕ закрывающего `/` литерала → два литерала через `|` (синтаксис невалиден). Правильная точка: `\\/keystatic\\/?|\\/$/g` (до закрывающего слэша).
- **Зачем `|\/$`**: Pages редиректит `/keystatic` → `/keystatic/` (trailing slash), в params роутера появляется пустой сегмент → «Not found» на валидных маршрутах (включая OAuth-колбэк).
- **Проверять патч по факту**: `grep -o 'pathname.replace([^;]*' dist/_astro/keystatic-entry.*.js` и `grep -o 'basePath:"[^"]*"' dist/_astro/*.js`.
- Оставшийся непатченным `${origin}/keystatic` в github-флоу («created-app») — не страшно, если используешь cloud.

### 2.2. OAuth-колбэк Keystatic Cloud на Pages

`redirect_uri = {origin}/keystatic/cloud/oauth/callback` (только origin, без base — в настройках Cloud-проекта URL указывается **доменом без пути**). На Pages этот путь 404 → нужен **реальный файл**: копия `dist/keystatic/index.html` в `dist/keystatic/cloud/oauth/callback/index.html` через хук:

```js
'astro:build:done': ({ dir }) => {
  const admin = new URL('keystatic/index.html', dir);
  const dest = new URL('keystatic/cloud/oauth/callback/', dir);
  mkdirSync(dest, { recursive: true });
  copyFileSync(admin, new URL('index.html', dest));
},
```

Роутер админки сам обработает маршрут `cloud/oauth/callback` (проверено: с фейковым code отвечает «Invalid state» — значит маршрут распознан).

**SPA-редирект через 404.html** — для остальных keystatic-глубоких ссылок (F5 на `/keystatic/branch/master/...`): в 404-страницу инлайн-скрипт `location.replace(base + '/keystatic/' + search)`. ВНИМАНИЕ: редирект «на тот же путь» даёт бесконечный цикл — вести на корень админки.

### 2.3. Keystatic Cloud — настройка (веб-UI)

1. **keystatic.cloud** (не cloud.keystatic.com — не резолвится!) → Sign in with GitHub
2. Create team → Create project → «Install the GitHub app» → Only select repositories → выбрать репо
3. Project URLs: **Primary URL — только домен** (`https://user.github.io`), поле не принимает пути
4. «Allow local development» — включить, если dev-админка тоже должна ходить в Cloud
5. Проект выдаёт ключ `team/project` → в конфиг: `storage: { kind: 'cloud' }, cloud: { project: '...' }`

Проверка pipeline: Save в прод-админке → коммит от `keystatic-cloud[bot]` в репо → Actions пересобирает. Коммиты бота идут **от корня репо** (см. п. 0).

## 3. Деплой workflow (GitHub Pages)

```yaml
# .github/workflows/deploy.yml
on:
  push: { branches: [master] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
        with: { path: site }   # если сайт в подпапке
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - { id: deployment, uses: actions/deploy-pages@v4 }
```

Обязательные ручные шаги (один раз):
1. **Settings → Pages → Source: «GitHub Actions»** (для приватного репо Pages требует Pro — проще сделать репо публичным)
2. Первый прогон упадёт с «Ensure GitHub Pages has been enabled» (404 на create deployment), если Source ещё не выбран — просто Re-run jobs после включения
3. Проверка деплоя: `curl -s -o /dev/null -w "%{http_code}" https://user.github.io/repo/` (учти: preview-сервер Astro слушает только IPv6 `::1` — curl на `localhost` работает, на `127.0.0.1` нет)

## 4. Диагностика: с чего начинать

1. **Пустой RootWebArea** → консоль браузера: SyntaxError CJS-модуля → `optimizeDeps.include`; «Invalid hook call» → дубли React (прямой импорт конфига вместо virtual)
2. **«Not found» в оболочке админки** → роутер не распознал путь: проверить патч regex в dist (`pathname.replace(...)`) и trailing slash
3. **404 на /keystatic в dev** → baseMiddleware: мост не сработал или стоит после него (см. 1.1.1)
4. **«Could not fetch blob»** → API-роут не catch-all
5. **«Collection path must end with /*»** → маска в `path` конфига
6. **«0 entries» в cloud-режиме** → это норма для нового Cloud-проекта: контент из репо не импортируется
7. **Ломаются ВСЕ роуты в dev** → connect-мидлварь из интеграции стоит после baseMiddleware (см. 1.1.1) — убрать и заменить Vite-плагином с post-hook
8. **EPERM/rename ошибки у субагентов/инструментов** → файлы на Яндекс.Диске: синк блокирует rename; перезапустить операцию

## 5. Чек-лист приёма (прогонять после каждого изменения конфига)

- [ ] dev: `/keystatic` рендерит dashboard, список коллекций, карточка открывается
- [ ] dev: Save пишет файл на диск (проверить git status)
- [ ] build: `dist/keystatic/index.html` существует; `basePath:"{base}/keystatic"` в бандле; regex роутера с base и trailing-slash
- [ ] build: OAuth-колбэк страница существует (`dist/keystatic/cloud/oauth/callback/index.html`)
- [ ] prod: `/keystatic` рендерит «Log in with Keystatic Cloud»; вход проходит; после входа — dashboard с веткой
- [ ] prod: Save → коммит в репо (проверить `git log origin`) → Actions зелёный → сайт обновился
- [ ] `npm run build` без ошибок; сайт-страницы не сломаны
