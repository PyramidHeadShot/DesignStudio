#!/usr/bin/env node
// Перепривязка cwd ВЫБРАННОЙ сессии pi к текущей папке.
// Зачем: /resume ("Current Folder") сравнивает cwd сессии с process.cwd()
// КАК СТРОКИ. После переноса проекта на другой ПК (или переименования папки)
// абсолютный путь в заголовке сессии перестаёт совпадать — скрипт чинит это.
//
// Запуск из папки проекта:
//   node scripts/session-cwd.mjs                 — интерактивно: список сессий → выбор номера
//   node scripts/session-cwd.mjs <путь>          — то же для указанного проекта
//   node scripts/session-cwd.mjs . <файл.jsonl>  — перепривязать конкретную сессию
//   node scripts/session-cwd.mjs . --all         — ПЕРЕпривязать все (осторожно!)
//
// Внимание: после привязки сессии к одной машине на другой машине /resume её
// не увидит, пока там не выполнен этот же скрипт (заголовок — один).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { isDir, readText, writeText } from './kit-lib.mjs';

const all = process.argv.includes('--all');
const rest = process.argv.slice(2).filter(a => a !== '--all');
const root = path.resolve(rest[0] || process.cwd());
const targetFile = rest[1];
const dir = path.join(root, '.pi', 'sessions');
if (!isDir(dir)) { console.log('.pi/sessions/ не найдена — сессий нет, чинить нечего.'); process.exit(0); }
const cwdNew = root;

function headerOf(p) {
  try {
    const first = (readText(p).split('\n')[0] || '');
    if (!first.startsWith('{"type":"session"')) return null;
    return JSON.parse(first);
  } catch { return null; }
}

function rebind(p) {
  const h = headerOf(p);
  if (!h) return { ok: false, why: 'нет заголовка сессии' };
  if (!h.cwd) return { ok: false, why: 'в заголовке нет cwd' };
  if (h.cwd === cwdNew) return { ok: false, why: 'уже привязана к ' + cwdNew };
  const from = h.cwd;
  const lines = readText(p).split('\n');
  h.cwd = cwdNew;
  lines[0] = JSON.stringify(h);
  writeText(p, lines.join('\n'));
  return { ok: true, from };
}

const sessions = fs.readdirSync(dir).filter(x => x.endsWith('.jsonl'))
  .map(f => path.join(dir, f))
  .map(p => ({ p, st: fs.statSync(p), h: headerOf(p) }))
  .filter(x => x.h)
  .sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);

if (!sessions.length) { console.log('Сессий с корректным заголовком не найдено.'); process.exit(0); }

// Режим: конкретный файл
if (targetFile) {
  const p = path.resolve(rest[1].endsWith('.jsonl') ? rest[1] : path.join(dir, rest[1]));
  if (!isFileSafe(p)) { console.log('✗ файл не найден: ' + p); process.exit(1); }
  const r = rebind(p);
  console.log(r.ok ? `✓ перепривязана: ${path.basename(p)} (${r.from} → ${cwdNew})` : `• пропущено: ${r.why}`);
  process.exit(0);
}

// Режим: все (явно запрошено)
if (all) {
  let fixed = 0;
  for (const s of sessions) { const r = rebind(s.p); if (r.ok) { fixed++; console.log(`✓ ${path.basename(s.p)} (${r.from} → ${cwdNew})`); } }
  console.log(`\nПерепривязано ${fixed} из ${sessions.length}.`);
  process.exit(0);
}

// Режим: интерактивный выбор
console.log(`Проект: ${cwdNew}\nСессии (по свежести):`);
sessions.forEach((s, i) => {
  const when = s.st.mtime.toISOString().replace('T', ' ').slice(0, 16);
  const kb = Math.round(s.st.size / 1024);
  const cur = s.h.cwd === cwdNew ? ' [уже здесь]' : ` [${s.h.cwd}]`;
  console.log(`  ${i + 1}. ${when}  ${kb} КБ  ${path.basename(s.p)}${cur}`);
});
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('\nНомер сессии (Enter — отмена): ', answer => {
  rl.close();
  const n = parseInt(answer.trim(), 10);
  if (!answer.trim() || !Number.isInteger(n) || n < 1 || n > sessions.length) { console.log('Отменено.'); process.exit(0); }
  const s = sessions[n - 1];
  const r = rebind(s.p);
  console.log(r.ok ? `✓ перепривязана: ${path.basename(s.p)} (${r.from} → ${cwdNew})` : `• пропущено: ${r.why}`);
});

function isFileSafe(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
