// Общие помощники motion-слоя (импортируются скриптами страниц).
// Правила: .agents/skills/animejs/SKILL.md (железные правила 1–2).

/** Разбить текст элемента на слова-обёртки для кинетического появления.
 *  Слова остаются обычным текстом в DOM (a11y: скринридер читает связно). */
export function splitWords(el: HTMLElement): HTMLElement[] {
  // Волна N: идемпотентность — повторный вызов на уже разбитом тексте
  // возвращает существующие .wi, не пересобирая DOM (без двойных масок).
  const existing = [...el.querySelectorAll<HTMLElement>('.wi')];
  if (existing.length) return existing;
  const parts = (el.textContent ?? '').split(/(\s+)/);
  el.textContent = '';
  const inners: HTMLElement[] = [];
  for (const part of parts) {
    if (part === '') continue;
    if (/^\s+$/.test(part)) {
      el.appendChild(document.createTextNode(part));
      continue;
    }
    const outer = document.createElement('span');
    outer.className = 'w'; // маска: overflow:hidden
    const inner = document.createElement('span');
    inner.className = 'wi'; // анимируемая часть
    inner.textContent = part;
    outer.appendChild(inner);
    el.appendChild(outer);
    inners.push(inner);
  }
  return inners;
}

/** Живое состояние prefers-reduced-motion (обновляется при смене настройки). */
export function reduceMotion(): MediaQueryList {
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}
