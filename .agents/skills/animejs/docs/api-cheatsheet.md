# anime.js v4 — API-справочник (cheatsheet)

Сверено с типами npm `animejs@4.5.0` (`dist/modules/**/*.d.ts`) и кодом репозитория
`juliangarnier/anime` (master = v4). Всё, что не подтвердилось в типах/примерах,
вынесено в раздел «Требует проверки» в конце.

## animate()

```ts
function animate(targets: TargetsParam, parameters: AnimationParams): JSAnimation;
```

### Targets (TargetsParam)

| Тип | Пример |
|---|---|
| CSS-селектор | `'.card'`, `'#hero h1'` |
| DOM-элемент | `document.querySelector('.card')` |
| NodeList / HTMLCollection | `document.querySelectorAll('.card')` |
| JS-объект | `const state = { count: 0 }` |
| Смешанный массив | `[el, '.selector', { prop: 0 }]` |

### Значения свойств (values)

```js
animate('.card', {
  // transform-поля v4 (НЕ составной transform-строкой):
  translateX: 250,          // px по умолчанию
  translateY: '50%',
  rotate: '1turn',          // или deg/rad
  scale: [0, 1],            // fromTo: массив [from, to]
  opacity: { from: 0, to: 1 }, // явный from/to объектом
  // CSS-свойства и цвета:
  backgroundColor: '#FFF',
  borderRadius: '50%',
  clipPath: 'inset(0% 0% 0% 0%)',
  // CSS-переменные:
  '--accent-shift': 100,
  // относительные значения:
  translateX: '+=100',      // также -=, *=
  // function-based:
  translateY: (el, i, total) => i * 20,
});
```

Единицы: число → px (для углов deg); строка → `'10rem'`, `'30%'`, `'1turn'`;
конвертация единиц работает (`width: ['50%', '200px']`).

### Per-property параметры

```js
animate('.card', {
  translateX: {
    to: 250,
    from: 0,          // либо fromTo-массивом
    duration: 500,
    delay: 100,
    ease: 'outExpo',
    composition: 'blend', // 'none' | 'replace' | 'blend'
    modifier: v => Math.round(v),
  },
});
```

### Keyframes

```js
// массив — равные доли длительности:
animate('.card', { translateX: [0, 100, 50, 200] });

// объекты — с длительностями:
animate('.card', {
  translateX: [
    { to: 100, duration: 500 },
    { to: 50, duration: 300 },
  ],
});

// percentage-keyframes (проценты от общей duration):
animate('.card', {
  keyframes: { '0%': { translateX: 0 }, '50%': { translateX: 100 } },
  duration: 2000,
});
```

Формат `keyframes: { '0%': {...}, '50%': {...} }` — PercentageKeyframes (Record
процентов от общей `duration`); DurationKeyframes — массив объектов
`[{ to, duration, ease?, ... }]` с per-keyframe параметрами. Оба задаются в
`animate(..., { keyframes, duration })`.

### Общие параметры (defaults из globals.cjs v4.5.0)

| Параметр | Тип | Default | Смысл |
|---|---|---|---|
| `duration` | number / fn | `1000` | мс |
| `delay` | number / fn | `0` | мс |
| `ease` | string / fn | `'out(2)'` | easing каждого твина |
| `playbackEase` | string / fn | `null` | easing хода playback (замедляет кадры) |
| `loop` | number / bool | `0` | число повторов, `true` — бесконечно |
| `loopDelay` | number | `0` | пауза между повторами |
| `alternate` | boolean | `false` | разворот направления на повторе |
| `reversed` | boolean | `false` | играть в обратную сторону |
| `autoplay` | boolean / ScrollObserver | `true` | `false` или `onScroll(...)` |
| `composition` | string | `'replace'` | `'none' \| 'replace' \| 'blend'` |
| `frameRate` | number | maxFps | лимит FPS |
| `playbackRate` | number | `1` | скорость |
| `persist` | boolean | `false` | хранить состояние после завершения |
| `modifier` | fn | — | функция-модификатор значения твина |
| `id` | number / string | `null` | идентификатор |

### Callbacks

```js
animate('.card', {
  translateX: 250,
  onBegin: self => {},        // старт
  onBeforeUpdate: self => {}, // до каждого кадра
  onUpdate: self => {},       // каждый кадр
  onLoop: self => {},         // каждый повтор
  onPause: self => {},
  onComplete: self => {},
  onRender: self => {},       // renderables (animate/timeline)
}).then(self => {});          // Promise-then тоже работает
```

### Управление (Timer-методы, есть у JSAnimation и Timeline)

```js
const anim = animate('.card', { translateX: 250 });
anim.play();      anim.pause();     anim.resume();   anim.restart();
anim.reverse();   anim.alternate(); anim.complete(); anim.reset();
anim.cancel();    anim.revert();    // revert — откатить inline-стили
anim.seek(500);   // только число (мс), строку не принимает
anim.stretch(2000);                 // растянуть на новую длительность
anim.refresh();

anim.currentTime; // number, мс (getter/setter)
anim.progress;    // number 0..1 (getter/setter)
anim.paused; anim.began; anim.completed; anim.duration;
```

## createTimeline()

```ts
function createTimeline(parameters?: TimelineParams): Timeline;
```

`TimelineParams` = `TimerOptions` (id, duration, delay, loop, loopDelay, reversed,
alternate, autoplay, frameRate, playbackRate) + `{ defaults, playbackEase }` + callbacks.

```js
const tl = createTimeline({
  defaults: { duration: 500, ease: 'out(2)' },
  loop: false,
});

tl.add('.title',   { translateY: [40, 0], opacity: [0, 1] })
  .add('.subtitle',{ translateY: [30, 0], opacity: [0, 1] }, '<<+=150') // от начала предыдущего +150
  .add('.cta',     { scale: [0.8, 1], opacity: [0, 1] }, '<')           // конец предыдущего
  .set('.badge',   { opacity: 1 }, '+=200')
  .call(() => startCount(), '+=100')
  .label('outro')  // позиция по умолчанию — конец текущей
  .add('.fancy', { rotate: 360 }, 'outro');
```

### Позиции (TimelinePosition, из types/index.d.ts)

| Позиция | Смысл |
|---|---|
| `500` | абсолютные мс |
| `'+=100'` / `'-=100'` | от конца предыдущего +100 / −100 мс |
| `'*=.5'` | доля от общей длительности |
| `'<'` | **конец** предыдущего |
| `'<<'` | **начало** предыдущего |
| `'<<+=250'`, `'<<-=250'` | от начала предыдущего ±250 |
| `'myLabel'` | позиция лейбла |
| `stagger(...)` | разъезд по элементам |

### Методы Timeline

```ts
add(targets, params, position?): this;      // анимация
add(timerParams, position?): this;          // вложенный таймер
sync(tickable | WAAPIAnimation, position?): this;
set(targets, params, position?): this;      // мгновенная установка
call(fn, position?): this;
label(name, position?): this;
remove(targets, propertyName?): this;
stretch(ms): this; refresh(): this; revert(): this;
// + все playback-методы Timer
```

## createTimer()

```ts
function createTimer(parameters?: TimerParams): Timer;
```

Замена `setTimeout`/`setInterval`, синхронизированная с движком анимаций:

```js
const t = createTimer({
  duration: 1000, delay: 250, loop: 3, loopDelay: 100,
  onUpdate: self => console.log(self.currentTime),
  onComplete: () => console.log('done'),
});
t.play(); // таймеры с autoplay: true стартуют сами; созданный с autoplay: false — по play()
```

Методы: `play, pause, resume, restart, reverse, alternate, seek(time: number),
complete, reset(softReset?), cancel, revert, stretch, refresh` + `.then(cb)`.

## stagger()

```ts
function stagger(val: number | string | [number, number] | [string, string],
                 params?: StaggerParams): StaggerFunction;
```

`StaggerParams` (из types): `start`, `from: number | 'first' | 'center' | 'last' |
'random' | number[]`, `reversed`, `grid: [cols, rows] | boolean`, `axis: 'x'|'y'|'z'`,
`use: string | fn`, `total`, `ease`, `modifier`.

```js
// задержки:
animate('.item', { translateY: [20, 0], delay: stagger(60) });           // 0, 60, 120...
animate('.item', { delay: stagger(60, { start: 300, from: 'center' }) });

// значения (разброс):
animate('.dot', { scale: stagger([0.5, 1.5]) });
animate('.dot', { rotate: stagger([-30, 30]) });

// сетка:
animate('.cell', {
  scale: [0, 1],
  delay: stagger(50, { grid: [8, 6], from: 'center', ease: 'outQuad' }),
});

// позиционная stagger-строка в timeline:
createTimeline().add('.cell', {...}, stagger([0, 800], { start: 0, from: 'first' }));
```

## Eases

Строковые (проверены в официальных examples): `'out(2)'`…`'out(4)'`, `'inOut(3)'`,
`'in(3)'`, `'outIn(3)'` (power-параметр), плюс именованные: `'inQuad'`, `'outQuad'`,
`'inOutQuad'`, `'outInQuad'`, …Cubic/Quart/Quint/Sine/Expo/Circ/Back/Elastic/Bounce
(доступны и как `eases.outQuad`, и строкой).

Фабрики:

```ts
cubicBezier(mX1?, mY1?, mX2?, mY2?): EasingFunction;
steps(steps?: number, fromStart?: boolean): EasingFunction;
spring(parameters?: SpringParams): Spring;   // также createSpring — алиас
irregular(length?: number, randomness?: number): EasingFunction;
linear(...args): EasingFunction;
```

```js
import { eases, spring, cubicBezier } from 'animejs';
animate('.card', { scale: 1.05, ease: spring({ stiffness: 120, damping: 14 }) });
animate('.card', { opacity: 1, ease: cubicBezier(.16, 1, .3, 1) });
```

## onScroll() / ScrollObserver

```ts
function onScroll(parameters?: ScrollObserverParams): ScrollObserver;
```

`ScrollObserverParams`: `container`, `target`, `axis: 'x'|'y'|fn`, `enter`, `leave`,
`repeat`, `sync: boolean|number|string|EasingParam`, `debug`, и callbacks
`onEnter, onLeave, onEnterForward, onLeaveBackward, onUpdate, onResize, onSyncComplete`.

```js
// 1) автоплей при входе в вьюпорт:
animate('.reveal', {
  translateY: [40, 0], opacity: [0, 1],
  autoplay: onScroll({ target: '.reveal', enter: 'bottom-=100', leave: 'top+=100' }),
});

// 2) синхронизация прогресса со скроллом:
animate('.bar', {
  scaleX: [0, 1],
  autoplay: onScroll({ container: 'body', target: '.section', sync: 0.5 }),
});

// 3) линковка с уже созданной анимацией:
const anim = animate('.card', {...});
onScroll({ target: '.section', enter: 'top', leave: 'bottom', sync: .1 }).link(anim);
```

Пороги `enter/leave` — строки вида `'top'`, `'bottom-=100'`, `'middle'` (официальный
формат порогов v4; см. примеры в рецепте №4 и на animejs.com/docs/scroll).

## createScope()

```ts
function createScope(params?: ScopeParams): Scope;
// ScopeParams: { root?: DOMTargetSelector | ReactRef | AngularRef,
//                defaults?: DefaultsParams, mediaQueries?: Record<string, string> }
```

```js
const scope = createScope({
  root: '.hero',
  defaults: { ease: 'out(3)', duration: 500 },
  mediaQueries: {
    isDesktop: '(min-width: 1024px)',
    reduce: '(prefers-reduced-motion: reduce)',
  },
}).add(self => {
  if (self.matches.reduce) return;               // ничего не анимируем
  if (self.matches.isDesktop) animateDesktop(); else animateMobile();
  return () => { /* cleanup при scope.revert() */ };
});

// после размонтирования секции / astro:after-swap:
scope.revert();
```

`scope.add(fn)` — конструктор с опциональной cleanup-функцией; `addOnce(fn)`;
`add(name, method)` — именованные методы; `keepTime(cb)`; `scope.matches` — маппинг
mediaQueries → boolean (обновляется на resize).

## utils

```ts
utils.set(targets, params);                    // мгновенно поставить значения (без анимации)
utils.get(targetSelector, propName, unit?);    // снять текущее значение
utils.remove(targets, renderable?, propertyName?);
utils.stagger(...)                             // реэкспорт stagger
utils.random(min, max, decimals?); utils.randomPick(items); utils.shuffle(items);
utils.roundPad(v, decimals); utils.padStart(v, len, padStr); utils.padEnd(...);
utils.wrap(v, min, max); utils.mapRange(v, inLow, inHigh, outLow, outHigh);
utils.degToRad(deg); utils.radToDeg(rad); utils.damp(start, end, dt, factor);
utils.sync(callback?): Timer; utils.keepTime(constructor);
```

Примеры:

```js
utils.set('.card', { opacity: 0, translateY: 24 }); // стартовое состояние до animate
const x = utils.get('.card', 'translateX');          // '250px' → можно распарсить
```

## svg

```ts
svg.createDrawable(selector: TargetsParam, start?: number, end?: number)
   : Array<DrawableSVGGeometry>;
// DrawableSVGGeometry: SVGGeometryElement & { draw: 'start end'; setAttribute('draw', v) }

svg.morphTo(path2: TargetsParam, precision?: number): FunctionValue;
svg.createMotionPath(path: TargetsParam, offset?: number)
   : { translateX: FunctionValue; translateY: FunctionValue; rotate: FunctionValue };
svg.getPath(path: TargetsParam): SVGGeometryElement | void;
```

```js
// рисование линии (значение draw — строка 'start end', доли 0..1):
const lines = svg.createDrawable('.underline');
animate(lines, { draw: ['0 0', '0 1'], ease: 'out(3)', duration: 600 });

// морфинг: morphTo возвращает FunctionValue, который вызывается с анимируемым
// элементом-путём ($path1) — т.е. значение кладётся в слот данных пути:
// для <path> это атрибут 'd' (поддержка: path/polygon/polyline — по src/svg/morphto.js):
import { svg } from 'animejs';
animate('#shape-a', { d: svg.morphTo('#shape-b', .33) });

// движение по траектории:
animate('.dot', { ...svg.createMotionPath('#route'), duration: 3000, ease: 'linear' });
```

## text

```ts
text.splitText(target: Element|NodeList|string|Element[], parameters?: TextSplitterParams)
    : TextSplitter;
text.split(...)  // алиас
// TextSplitterParams: { lines?, words?, chars?, accessible?, includeSpaces?, debug? }
// TextSplitter имеет массивы .lines, .words, .chars

text.scrambleText(params?: ScrambleTextParams): FunctionValue<ScrambleTextTween>;
```

```js
import { text } from 'animejs';
const split = text.split('.hero-title', { words: true, chars: true });
animate(split.words, { translateY: ['100%', '0%'], opacity: [0, 1], delay: stagger(60) });
```

## createLayout() — FLIP из коробки (v4.5+)

```ts
function createLayout(root: DOMTargetSelector, params?: AutoLayoutParams): AutoLayout;
// AutoLayoutParams = LayoutAnimationParams & { children?, properties? }
// LayoutAnimationParams: { delay, duration, ease, swapAt?, enterFrom?, leaveTo?, ...TimerParams }
```

```js
const layout = createLayout('.grid', { children: '.card', duration: 400, ease: 'out(3)' });
layout.record();                       // снять снапшот позиций
// ... перестроить DOM (фильтрация) ...
layout.animate({ enterFrom: { opacity: 0, scale: .8 }, leaveTo: { opacity: 0 } });
layout.revert();                       // при демонтаже
```

Также: `layout.update(mutateFn, params)` — снимает снапшот, выполняет мутацию DOM
в колбэке, анимирует дельты одним вызовом.

## Прочее

```ts
createAnimatable(targets, parameters): AnimatableObject; // chained-twins, hover-отклики
// waapi.animate(targets, params): WAAPIAnimation — прямой WAAPI-мост (namespace waapi)
```

## Требует проверки

- `scope.add(name, method)` — семантика именованных методов (есть в типах, пример
  в доках не найден).
- Точный формат строк порогов `enter/leave` у onScroll (`'top+=100'` и пр. —
  подтверждён формат в ScrollObserverParams как `ScrollThresholdValue = string|number`,
  конкретные литералы сверить на странице доков /scroll при первой возможности).
