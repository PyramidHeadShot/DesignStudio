# Рецепты анимаций сайта (anime.js v4)

Все вызовы сверены с `docs/api-cheatsheet.md` (npm animejs@4.5.0 `.d.ts`).
Общие константы ритма: появления 300–700 мс, stagger 40–120 мс, ease `out(2)`…`out(4)`.
Каждый рецепт — progressive enhancement: без JS контент виден, начальные состояния
ставятся из JS.

## 1. Кинетический hero: слова с stagger, единый ритм

```js
import { animate, createTimeline, stagger, text, utils } from 'animejs';

const scopeEl = document.querySelector('.hero');

// прогрессивное улучшение: стартовые состояния ставим из JS, не из CSS
utils.set('[data-hero-fade]', { opacity: 0, translateY: 24 });

const split = text.split('.hero-title', { words: true });

createTimeline({
  defaults: { ease: 'out(3)', duration: 600 },
})
  .add(split.words, {
    translateY: ['100%', '0%'],
    opacity: [0, 1],
    delay: stagger(70),
    duration: 550,
  })
  .add('.hero-subtitle', { opacity: [0, 1], translateY: [16, 0] }, '<<+=250')
  .add('.hero-cta', { opacity: [0, 1], scale: [0.92, 1] }, '<')  // конец предыдущего
  .add('[data-hero-fade]', { opacity: [0, 1], translateY: [24, 0] }, '<');
```

**Почему так:** одна timeline держит единый «такт» (150–900 мс) и порядок волны
слова → подзаголовок → CTA; `text.split` даёт готовые массивы `words/chars/lines`
без ручной обёртки в span.

## 2. FLIP-анимация сетки при фильтрации категорий

### 2а. Канонично: createLayout (v4.5+)

```js
import { createLayout } from 'animejs';

const grid = document.querySelector('.cases-grid');
const layout = createLayout(grid, {
  children: '.case-card',
  duration: 400,
  ease: 'out(3)',
  enterFrom: { opacity: 0, scale: 0.85 },
  leaveTo:   { opacity: 0, scale: 0.85 },
});

filterButtons.addEventListener('click', (e) => {
  const cat = e.currentTarget.dataset.category;
  layout.update(() => {            // мутация DOM внутри update — дельты посчитаются сами
    for (const card of grid.querySelectorAll('.case-card')) {
      card.hidden = cat !== 'all' && card.dataset.category !== cat;
    }
  });
});
```

### 2б. Ручной FLIP (если не тянуть layout-модуль +13 КБ gzip)

```js
import { animate } from 'animejs';

function filterGrid(grid, cards, predicate) {
  const first = new Map(cards.map(el => [el, el.getBoundingClientRect()]));

  for (const el of cards) el.hidden = !predicate(el);   // мутация DOM

  cards.filter(el => !el.hidden).forEach((el, i) => {
    const f = first.get(el);
    const last = el.getBoundingClientRect();
    animate(el, {
      translateX: [f.left - last.left, 0],
      translateY: [f.top - last.top, 0],
      scale: [f.width / last.width, 1],
      duration: 350,
      ease: 'out(3)',
      delay: 50 + i * 30,   // ручной stagger
    });
  });
}
```

**Почему так:** FLIP = snapshot → мутация → обратные трансформации → анимация в ноль.
v4 fromTo-массивы и function-based values дают это без библиотечных хаков;
`translateX/Y/scale` — только compositor-свойства, layout не дёргается в кадре.

## 3. SVG-draw: подчёркивания и иконки

```js
import { animate, svg, onScroll, stagger } from 'animejs';

const strokes = svg.createDrawable('.draw-underline, .icon-stroke'); // SVG path/line/circle

animate(strokes, {
  draw: ['0 0', '0 1'],            // 'start end' — доли длины пути 0..1
  duration: 600,
  ease: 'out(3)',
  delay: stagger(120, { start: 200 }),
  autoplay: onScroll({ target: '.about', enter: 'bottom-=120' }),
});
```

**Почему так:** `createDrawable` оборачивает геометрию SVG в управляемый атрибут
`draw` (начало/конец видимой доли пути) — рисование без ручного расчёта
`stroke-dasharray/dashoffset`; под углы точности подставляй `'0.02 0.98'`.

## 4. Scroll-reveal: IntersectionObserver + timeline

```js
import { animate, createTimeline, stagger, utils } from 'animejs';

function revealSection(section) {
  const items = section.querySelectorAll('[data-reveal]');
  utils.set(items, { opacity: 0, translateY: 28 });

  const tl = createTimeline({ defaults: { ease: 'out(3)', duration: 550 } })
    .add(items, { opacity: [0, 1], translateY: [28, 0], delay: stagger(80) });

  section.__revealTl = tl; // держим ссылку для cleanup
}

const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    revealSection(entry.target);
    io.unobserve(entry.target);
  }
}, { rootMargin: '0px 0px -120px 0px' });

document.querySelectorAll('[data-reveal-section]').forEach(s => io.observe(s));
```

**Почему так:** IO не требует бандл-кода scroll-подписок и точен по вьюпорту;
если reveal привязан к прогрессу скролла (не «вошёл/в��шел»), бери нативный
`autoplay: onScroll({ target, sync: true })` вместо IO.

## 5. prefers-reduced-motion через createScope

```js
import { createScope, animate, createTimeline } from 'animejs';

const scope = createScope({
  root: '.hero',
  mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' },
}).add(self => {
  if (self.matches.reduce) {
    // фриз: мгновенно конечные состояния, без анимаций
    utils.set('.hero-title, .hero-cta', { opacity: 1, translateY: 0 });
    return;
  }
  // ... обычная инициализация анимаций (рецепты 1–4)
  animate('.hero-cta', { opacity: [0, 1], scale: [0.92, 1], duration: 400, ease: 'out(2)' });
});

// при уходе со страницы / astro:after-swap:
scope.revert();
```

**Почему так:** `scope.matches` обновляется на resize — изменение настройки
доступности подхватывается живьём; одно место определяет политику всей секции.

## 6. Интеграция в Astro-island

Анимационный код живёт в `<script>` компонента Astro (ES-модуль, исполнится после
парсинга страницы — дополнительный defer не нужен). Один script на страницу.

```astro
---
// Hero.astro
---
<section class="hero">...</section>

<script>
  import { createScope, animate, stagger, text } from 'animejs';

  const init = () => {
    const scope = createScope({
      root: '.hero',
      mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' },
    }).add(self => {
      if (self.matches.reduce) return;
      const split = text.split('.hero-title', { words: true });
      return createTimeline()
        .add(split.words, { translateY: ['100%', '0%'], delay: stagger(70) });
    });
    return scope;
  };

  let current = init();

  // Astro View Transitions: пересоздание scope на каждую навигацию
  document.addEventListener('astro:after-swap', () => {
    current?.revert();
    current = init();
  });
</script>
```

**Почему так:** scope гарантирует revert listeners/inline-стилей при каждом
swap, `astro:after-swap` — точка пересоздания после View Transitions; скрипт
не дублируется на повторных рендерах, потому что Astro дедуплицирует модули.
