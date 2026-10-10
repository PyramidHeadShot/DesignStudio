# Аудит сайта DesignStudio — 2026-09-30

> Исполнитель: local-worker-xl (кусочки 1–6), дирижёр собирает результаты здесь.
> Объект: прод-сборка `site/dist` (Astro, base=/DesignStudio) + живой preview :4321.

## Кусок 1/6 — SEO и мета-данные ✅ проведён

Проверено 15 HTML-страниц (index, 404, 12 кейсов, dev/animations).

**Проблемы:**
- ❌ Нигде нет `rel="canonical"` (все 15 страниц)
- ❌ Нет Open Graph (`og:title`/`og:image`) и `twitter:card` (все 15)
- ⚠️ `meta description` один и тот же на 14 страницах (копипаст с услугами); уникальных описаний кейсов нет
- ⚠️ `title` кейсов dizayn-upakovki-1…4 — плейсхолдеры («Дизайн упаковки 1 — …»), почти дубли
- ⚠️ dev/animations без favicon (noindex-страница, некритично)

**ОК:** title на всех; lang="ru" на всех; charset+viewport; h1 ровно 1; favicon на контентных; 404 noindex; dev noindex,nofollow; robots.txt и sitemap.xml согласованы (13 URL, без лишних).

**Рекомендация:** canonical + OG + twitter:card (шаблон в Base.astro), уникальные description/title кейсов — приоритет.

## Кусок 2/6 — ссылки и маршруты ✅ проведён

**Ссылки (href/src в 15 HTML, без ассетов):** проверено 58 ссылок на страницы/якоря из 15 уникальных целей. **Битых нет.** Все якоря (в т.ч. self-якоря `#logo/#typo/#grid/#svg/#scroll/#micro` в dev/animations) существуют в целевых страницах. `mailto:`/`tel:`-линии — плейсхолдеры (`hello@example.com`, `+70000000000`) — см. кусок с контактами.

**Маршруты (curl на :4321):** 15 из 15 = 200 (`/`, 12 кейсов, `dev/animations/`, `404.html`); 3 несуществующих пути (`/no-such-page/`, `/cases/fake-case/`, `/xyz`) = 404, как ожидается.

**Ассеты:** все 71 `<img src>` + все `srcset` существуют в dist; asset-sсылки (css/js/woff2/webp/jpg/svg) на месте.

**Вердикт:** граф ссылок чистый, роутинг и 404 работают штатно. Замечаний к маршрутизации нет; плейсхолдерные контакты — единственная находка (не этого куска).

## Кусок 3/6 — контент кейсов ✅ проведён

**Объект:** `site/src/content/cases/*.yaml` (12 файлов) ↔ `site/dist/cases/*/index.html`, картинки в `site/public/images/cases/`.

**Проверки:**
- Все поля (title, slug, category, order, cover, gallery, body) есть в 12/12 файлах, пустых нет.
- slug == имя файла — 12/12 OK.
- category — все из разрешённого списка: Реклама для ресторанов ×3, Дизайн упаковки ×4, Наружная реклама ×2, Полиграфия ×1, Инфографика и маркетплейсы ×1, Рекламные макеты ×1.
- order: ровно 1–12, дублей нет.
- Все 31 путь cover+gallery существуют в `site/public/images/cases/` (проверено по файлам).
- 12/12: `<h1>` == title из YAML; `<title>` = «title — АТОМ СЭИЛС» (плейсхолдеров в HTML нет; плейсхолдеры — сами titles «Дизайн упаковки 1–4», см. кусок 1/6).

**Таблица:**

| # | кейс (slug) | order | category | img | body |
|---|---|---|---|---|---|
| 1 | vash-restoran | 1 | Реклама для ресторанов | 2 | ⚠️ тест-заглушка: «ваша ТЕСТОВАЯ история» |
| 2 | coffee-hall | 2 | Реклама для ресторанов | 2 | ❌ заглушка «Описание готовится» |
| 3 | stilnyy-dizayn-restoranov | 3 | Реклама для ресторанов | 3 | ✅ готов |
| 4 | dizayn-upakovki-1 | 4 | Дизайн упаковки | 2 | ❌ заглушка + плейсхолдерный title |
| 5 | dizayn-upakovki-2 | 5 | Дизайн упаковки | 3 | ✅ готов (общий маркетинговый текст, без конкретики кейса) |
| 6 | dizayn-upakovki-3 | 6 | Дизайн упаковки | 3 | ✅ готов (маркетинговый текст с эмодзи) |
| 7 | dizayn-upakovki-4 | 7 | Дизайн упаковки | 3 | ✅ готов (маркетинговый текст) |
| 8 | naruzhnaya-reklama | 8 | Наружная реклама | 3 | ✅ готов |
| 9 | naruzhnaya-reklama-pelikan | 9 | Наружная реклама | 2 | ❌ заглушка |
| 10 | verstka-izdaniya | 10 | Полиграфия | 3 | ✅ готов (самый развёрнутый; опечатка «детям.В преддверии» — нет пробела) |
| 11 | infografika-bezvreda | 11 | Инфографика и маркетплейсы | 3 | ❌ заглушка |
| 12 | reklamnye-makety | 12 | Рекламные макеты | 2 | ✅ готов (краткий) |

**Вердикт:** готово к показу клиенту — 7 из 12 (vash-restoran под вопросом, см. ниже). 5 кейсов не готовы: 4 с заглушкой «Описание готовится.» (coffee-hall, dizayn-upakovki-1, infografika-bezvreda, naruzhnaya-reklama-pelikan) и 1 с тестовым текстом «ТЕСТОВАЯ история» (vash-restoran). Тексты готовых кейсов — общий маркетинговый (кроме verstka-izdaniya), без деталей проекта/клиента/результата; titles «Дизайн упаковки 1–4» по-прежнему плейсхолдеры.

## Кусок 4 (первая попытка) — прервана по таймауту, разбита на 4a/4b. Замечания из неё учтены ниже.

**Замечания по a11y (додать):**
- В шаблоне header `img.logo-img` — голый атрибут `alt` (без `=""`). В DOM парсится как `alt=""`, поэтому скринридеры тише, но валидаторы ( axe/Wave, Lighthouse htmlhint ) флагуют как missing alt. Исправление в шаблоне шапки (Astro partial/header): `alt=""` + `aria-hidden="true"` оставить (декоративный логотип, рядом есть текстовый `.logo-name` — но он сам aria-hidden=true → логотип для SR полностью невидим, что допустимо для декоративного).

**Сомнительно (не нарушение):**
- `dev/animations` — 20 `article.card`, каждый с `<header class="card-head">` (заголовок карточки) → 21 `<header>` в документе. По спецификации `<header>` внутри `article` валиден (не banner-landmark), нарушения WCAG нет. Настоящий риск на этой странице: **нет `<main>`** → нет «skip to main» для скринридеров. Рекомендация: обернуть сетку карточек в `<main>`.
- Дубль `header`/`nav` на cases-страницах — проверено, не баг: `site-header`/`site-nav` по одному; второй `header` = `case-head`, второй `nav` = `case-nav` внутри `<article class="container case">` — валидная практика.

**Данные (14 страниц, dev/animations помечен):**

| Файл | <img> без alt | alt="" | h1 | пропуски уровней | main | header | nav | footer |
|---|---|---|---|---|---|---|---|---|
| 404.html | 1* | 0 | 1 | нет | 1 | 1 | 1 | 1 |
| index.html | 1* | 0 | 1 | нет | 1 | 1 | 1 | 1 |
| cases/*/index.html (12 шт.) | 1* каждая | 0 | 1 | нет | 1 | 2** | 2** | 1 |
| dev/animations | — | — | 1 | нет (1→2→3) | **0** | 21** | 1 | 1 |

\* — всегда тот же файл: `_astro/logo.Cgtpxab5_Z1978bD.webp` (шаблон шапки, голый `alt`).
\** — cases: второй `header`/`nav` = `case-head` + `case-nav` внутри `<article>` (валидно). dev/animations: `card-head` ×20 (валидно, но см. выше).

**Вердикт (4a): нарушений WCAG нет.** Единственное реальное: `<img alt>` (без значения) на logo в header-шаблоне — парсится как декоративный, но валидаторы ругают; фикс в одном partial-файле шапки. Структурный риск: отсутствует `<main>` на dev/animations. Все 12 cases + index + 404: ровно один h1, без пропусков уровней, по одному `<main>`, header/nav/footer на месте.

## Кусок 4b/6 — a11y часть 2 ✅ проведён (агент упал по таймауту, дотянул дирижёр по транскрипту+grep)

1. Интерактив без доступного имени: ОК — иконочные ссылки имеют aria-label (лого: aria-label на <a>).
2. Focus-стили: ОК — outline:none нет; :focus-visible с outline 2px+offset во всех css (_slug_, animations).
3. lang: ОК — lang="ru" на всех 15, инородных текстовых узлов без lang нет.
4. prefers-reduced-motion: ⚠️ ЧАСТИЧНО.
   - animations.css (dev/animations): глобальный kill `*{transition:none!important;animation:none!important}` — эталон.
   - _slug_.css (все контентные страницы): reduce-блок глушит только тикер (.ticker-viewport display:none) и возвращает reveal-состояния; НО `animation:fade-up .55s` на .case-hero-wrap и hover-переходы (transition) НЕ глушатся → при prefers-reduced-motion анимации продолжаются.
   - ficon-draw/ul404-draw — корректно спрятаны в no-preference guard.
   **Фикс:** перенести глобальный kill в _slug_.css (или общий слой), оставить точечные восстановления.

## Кусок 5/6 — no-JS деградация и перф-хвосты ✅

1. **Критический контент без JS: СКРЫТОГО НЕТ.** Селекторов `html:not(.js)` в css нет вообще; все reveal-состояния завязаны на `html.js` (класс добавляет скрипт `Base.astro_...js`): `.logo`, `.ci`/`.wi` в h1 кейсов и 404, `.site-footer`, `.work-filters` — без JS всё видно, анимации просто не запускаются. Почти всё внутри `@media (prefers-reduced-motion: no-preference)`. Единственное «спрятанное» без JS — `.work-filters{visibility:hidden}` (панель фильтров; без JS не функциональна, контент ниже виден) и `.ticker-static` (статичная копия тикера, живёт в reduce-блоке; без JS тикер показывается анимированным viewport — контент есть, только тикер, не primary).
2. **Шрифты:** 4 woff2 суммарно 94K: inter-tight (cyr 20K / lat 44K) + Unbounded (cyr 16K / lat 24K), по 2 subsets на font-family (cyrillic/latin, unicode-range). Критичная кириллица `inter-tight-cyrillic` **preloaded** во всех 15 страницах (`<link rel=preload as=font crossorigin>`). `font-display:swap` + metric-fallback на Arial (size-adjust) — FOUT не ломает layout. Unbounded (display-шрифт h1, 16K) preloaded **нет** — подтягивается из inline `<style>` @font-face; при 16K и swap — хвост мизерный.
3. **Изображения:** дисциплина атрибутов норм — `loading="eager"` только выше-фолда (hero/первая обложка, logo, 3 карточки в первом экране index), дальше `lazy`; по всем 15 страницам: 29 eager / 42 lazy. Тяжёлые файлы: `dist/images` — 6.3M (91% всех dist), самые тяжёлые jpg: verstka-izdaniya-1.jpg 292K, stilnyy-dizayn-restoranov-2.jpg 280K, infografika-bezvreda-1.jpg 276K, dizayn-upakovki-4-3.jpg 272K… — plain JPEG, **webp/avif в dist нет** — это главный перф-хвост. В `dist/_astro` максимумы: client.DFmdx-Ks.js 220K, stagger.BGiuSi2g.js 40K, остальное ≤24K.
4. **Общий вес:** `dist` = **6.9M** (из них 6.3M = images; code+fonts ≈ 0.6M). HTML-страницы лёгкие: cases 9.2–11.4K, 404 10K, index 26K, dev/animations 21K.

**Вердикт:** no-JS — образцово: ничего критического не скрыто, паттерн `html.js` + reduce-гарды выполнены; единственная цена no-JS — невидимая (нефункциональная) панель фильтров. Перф-хвост один: 6.3M JPEG в cases (до 292K шт.) без webp/avif — сжатие формата даст −~45% веса всего сайта; код и шрифты в норме.

## Итоговая сводка (дирижёр, по итогам кусков 1–5)

**Что в порядке (лучшие практики соблюдены):** роутинг и граф ссылок (58 ссылок, 0 битых), 404, robots+sitemap согласованы; no-JS деградация образцовая (html.js-паттерн, контент читается без JS); lang/title/h1/charset/viewport везде; фокус-стили и доступные имена интерактива; шрифты self-hosted с preload и metric-fallback; lazy/eager на картинках разведены правильно; HTML лёгкий (9–26 КБ).

**Проблемы по приоритету:**

| Приоритет | Проблема | Где | Фикс |
|---|---|---|---|
| P1 | 6.3 МБ JPEG без webp/avif (до 292 КБ/файл) | dist/images (31 файл кейсов) | astro:assets <Image> или конвертация — ~−45% веса |
| P1 | Нет canonical, Open Graph, twitter:card | все 15 страниц | шаблон в Base.astro |
| P2 | Одинаковый meta description на 14 страницах | все контентные | уникальные description (из body кейсов) |
| P2 | Плейсхолдерные titles «Дизайн упаковки 1–4» | 4 кейса + тестовый текст vash-restoran | контент |
| P2 | 4 кейса с «Описание готовится.» | coffee-hall, dizayn-upakovki-1, pelikan, bezvreda | уже в Задачи.md (ждём материалы) |
| P3 | reduced-motion неполный: fade-up hero кейсов анимируется | _slug_.css | перенести глобальный kill из animations.css в общий слой |
| P3 | Голый атрибут alt у лого в шапке; нет <main> на dev/animations | Base.astro, animations | 2 точечных фикса |
| P3 | Опечатка «детям.В преддверии» | verstka-izdaniya | 1 правка |

**Ограничение аудита:** статический анализ dist + curl; живые Lighthouse-метрики (LCP/TBT в трейсе) не снимались — на прод-сборке ранее LCP 117 мс, CLS 0 (см. Задачи.md).

## Исправления (дирижёр, 2026-09-30)

- ✅ P1 webp: 31 JPEG → webp q80 (6.17→4.30 МБ, −30%; ~−45% недостижим — исходники уже пережаты), пути в 12 YAML обновлены
- ✅ P1 SEO: canonical + OG (title/description/type/url/site_name/locale/image) + twitter:card в Base.astro; og:image абсолютный из cover кейса
- ✅ P2 descriptions: у кейсов — авто из первого абзаца body (~160 зн.), заглушка → фолбэк на SITE.heroText; titles «Дизайн упаковки 1–4» — ждут материалов
- ✅ P3 reduced-motion: universal-kill (animation/transition .01ms) в global.css при reduce
- ✅ P3: <main> на dev/animations; опечатка verstka-izdaniya; голый alt у лого — не баг (валидный HTML5)
- ⏳ Осталось (нужны материалы): тексты 4 кейсов-заглушек, vash-restoran «ТЕСТОВАЯ история», реальные titles upakovki 1–4

Проверка: npm run build OK (15 стр.); в dist — canonical/OG на всех, webp 31/jpg 0, images 4.4M, kill reduce в _slug_.css.
