---
name: animejs
description: >
  Анимации веб-интерфейсов через anime.js v4 (для любого проекта). Модель v4 API (animate,
  createTimeline, stagger, onScroll, createScope, utils, svg, text, createLayout),
  точные сигнатуры и рецепты: кинетический hero, FLIP-фильтрация сетки,
  SVG-draw, scroll-reveal, reduced-motion, интеграция в Astro-островки.
  Железные правила производительности и отключаемости. Читай, когда нужно
  анимировать что-либо на сайте: появление секций, stagger-сеток, подчёркивания,
  hover-микроанимации, синхронизацию со скроллом, или когда в коде уже есть
  import { animate } from 'animejs' и надо понять, как это устроено.
---

# animejs — анимации на сайте (v4)

## Когда применять

- Последовательные появления (hero: заголовок → подзаголовок → CTA с единым ритмом).
- Stagger-эффекты на множестве элементов (сетки карточек, списки, пункты меню).
- SVG: рисование линий/подчёркиваний (`createDrawable`), морфинг путей (`morphTo`),
  движение по траектории (`createMotionPath`).
- Анимации, синхронизированные со скроллом (`onScroll` + `autoplay`).
- FLIP-переходы при перестройке DOM (фильтрация сетки портфолио) — `createLayout` или вручную.
- Микроанимации с пружиной (`spring()`) и chained-твинами (`createAnimatable`).

**Когда НЕ нужен:** одиночный CSS-transition (`:hover`, `transition`), декоративные
CSS-keyframes, статичные появления, которые решает `@starting-style`. JS — только
для оркестрации, которую CSS не берёт.

## Установка и импорт

```bash
npm i animejs
```

```js
import { animate, createTimeline, createTimer, createScope,
         stagger, onScroll, utils, svg, text, createLayout } from 'animejs';
```

В Astro подключается внутри клиентского `<script>` компонента (см. `docs/recipes.md`,
рецепт «Astro-island»). Подпуть-экспорты (`'animejs/svg'`, `'animejs/text'`, …)
существуют, но об��чный named-import из `'animejs'` тоже tree-shake-ится — измеренный
вес для базового набора (animate/timeline/timer/stagger/onScroll/scope/utils):
**21,5 КБ gzip** (бюджет проекта ≤ 25 КБ — укладываемся; с `svg+text+layout` — 34,5 КБ,
всё сразу не импортировать).

## Модель v4 за 3 абзаца

**Targets → values → параметры.** `animate(targets, params)`: targets — CSS-селектор,
DOM-элемент, NodeList, массив (можно смешивать с JS-объектами) или `utils.$()`-кандидаты.
Values — CSS-свойства, индивидуальные transform-поля v4 (`translateX`, `rotate`, `scale`,
без составных `transform: '...'`), CSS-переменные (`'--var'`), SVG-атрибуты, свойства
JS-объектов. Значение — число (единица по умолчанию: px/deg), строка с единицей
(`'10rem'`, `'1turn'`), относительное (`'+=100'`, `'*=2'`), fromTo-массив `[0, 250]`,
функция `(el, i, total) => ...` или объект per-property `{ to, from, duration, delay, ease }`.

**Declarative playback.** Общие параметры (defaults v4.5.0): `duration: 1000`,
`ease: 'out(2)'`, `delay: 0`, `loop: 0`, `autoplay: true`, `composition: 'replace'`,
`alternate: false`, `reversed: false`, `frameRate: maxFps`, `playbackRate: 1`.
Callbacks: `onBegin/onBeforeUpdate/onUpdate/onLoop/onPause/onComplete/onRender`.
Всё анимируемое — «tickable» (Timer → JSAnimation | Timeline): единый движок,
управление `play/pause/restart/seek/alternate/reverse/complete/cancel/revert/stretch`.

**Timeline — хореография.** `createTimeline({ defaults, playbackEase })`, элементы
добавляются `.add(targets, params, position)`. Position: `500` (абс. мс), `'+=100'`,
`'-=100'`, `'*=.5'`, `'<'` (конец предыдущего), `'<<'` (начало предыдущего),
`'<<+=250'`, имя лейбла из `.label('name')`, или `stagger(...)`. Аналогично
`.set()`, `.call()`, `.sync()`, `.label()`, `.remove()`.

## Быстрые рецепты

| Задача | Ядро решения | Подробно |
|---|---|---|
| Кинетический hero | `createTimeline` + `stagger(70)` по словам/строкам | `docs/recipes.md` №1 |
| FLIP-фильтр сетки | `createLayout(root, { children })` или ручной FLIP | `docs/recipes.md` №2 |
| SVG-подчёркивание | `svg.createDrawable()` + `draw: ['0 0', '0 1']` | `docs/recipes.md` №3 |
| Scroll-reveal | `autoplay: onScroll({ target, enter, leave })` | `docs/recipes.md` №4 |
| Reduced-motion | `createScope({ mediaQueries })` + `scope.matches` | `docs/recipes.md` №5 |
| Astro-островок | один `<script>`, scope + cleanup на `astro:after-swap` | `docs/recipes.md` №6 |

Точный справочник вызовов: `docs/api-cheatsheet.md`. Грабли: `docs/pitfalls.md`.

## Железные правила

1. **Progressive enhancement:** базовый контент виден без JS. Начальные состояния
   (`opacity: 0`) ставить ТОЛЬКО из JS (`utils.set(...)` или fromTo), не в CSS.
2. **prefers-reduced-motion — всегда.** Любая автоплей-анимация обёрнута в
   `createScope({ mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' } })`;
   при `scope.matches.reduce` — либо не запускать, либо мгновенно ставить конечные
   состояния. Не-dismissable исключений нет.
3. **transform/opacity/clip-path/color/filters** — бесплатные свойства. `width/height/
   top/left/margin` анимировать запрещено (layout + reflow каждый кадр) — исключение
   только через `createLayout` (он сам держит FLIP-снапшот).
4. **`scope.revert()` при демонтаже.** Всё, что создано в scope-островке, откатывается:
   listeners, inline-стили, контекст — иначе утечки и «залипшие» стили при
   View Transitions Astro.
5. **Один script на страницу** на вьюпорт-секцию; анимации навешиваются после
   готовности DOM (Astro-скрипты — ES-модули, исполнение после парсинга; явный
   `defer` не нужен, но и не мешает).
6. **Единый ритм:** durations 150–900 мс, eases из семейства `out(2..4)`/`outQuad…outExpo`,
   stagger 40–120 мс. Пружины (`spring()`) — только для интерактивных откликов.

## НЕ делать

- Не мигрировать код v3 вслепую: `anime({...})`, `anime.timeline()`, `anime.stagger`,
  `anime.random`, `easing: 'easeInOutQuad'` — это v3. В v4: `animate({...})`,
  `createTimeline()`, `stagger`, `utils.random`, `ease: 'inOutQuad'`.
- Не анимировать `width/height/top/left/margin/padding` напрямую (см. правило 3).
- Не читать/писать `transform: '...'` строкой — только отдельные поля
  (`translateX`, `rotate`, `scale`), иначе v4 не соберёт корректный transform.
- Не `seek()` строкой — `seek(time: number)` принимает только число (мс).
- Не держать `loop: true` на декоративных анимациях ниже вьюпорта — жгёт CPU;
  для скролл-привязанных используй `autoplay: onScroll(...)`.
- Не тащить анимационный скрипт в `<head>` без defer и не анимировать до
  `DOMContentLoaded`/готовности островка.
- Не копировать рецепты из чужих скиллов без сверки с `docs/api-cheatsheet.md` —
  в народных скиллах встречаются v3-остатки и ошибки позиций (`'<'` — это конец
  предыдущего, а не начало).

## Файлы

- `docs/api-cheatsheet.md` — все вызовы v4.5.0 с сигнатурами и примерами.
- `docs/recipes.md` — 6 рабочих рецептов под задачи сайта.
- `docs/pitfalls.md` — грабли, производительность, бюджет бандла.

## Источники

- Официальная документация: https://animejs.com/docs (доступ 2026-09-27; сайт за OVH-защитой
  отдаёт curl-у блок-страницу, HTML-доки не скрейпились — контент сверялся по первоисточникам ниже).
- Типы API: npm-пакет `animejs@4.5.0`, `dist/modules/**/*.d.ts` (первоисточник всех сигнатур в этом скилле).
- Код: репозиторий `juliangarnier/anime` (master = v4), файлы `src/`, `examples/` (stagger,
  onscroll-responsive-scope, svg-line-drawing), дефолты из `dist/modules/core/globals.cjs`.
- Заимствования (разрешены заказчиком; авторские упоминания сняты):
  - `github.com/BowTiedSwan/animejs-skills` — структура api-справочника, часть таблиц и примеров (v4; блоки переработаны и сверены с .d.ts).
  - `github.com/charlesdove977/animejs-claude-skill` — тот же материал (SKILL.md/сreferences байт-в-байт совпадают с предыдущим репо), MIT.
  - `github.com/yuzhang-ai/web-animation-skill` — идея секции «When to use» (их блок animejs описывает v3 — не использовался как источник API).
  - `github.com/lexs32/ultimate-design-engineer` — MIT; вдохновение для секции правил (их код-примеры — v3, не копировались).
