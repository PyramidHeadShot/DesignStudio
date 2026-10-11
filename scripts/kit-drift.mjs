#!/usr/bin/env node
// Детектор дрейфа комплекта в проектах: находит проекты-соседи и сверяет
// комплектные файлы с мастер-копией кита. ТОЛЬКО чтение — безопасен на любой машине.
// Запуск из корня комплекта:  node scripts/kit-drift.mjs [путь-к-проекту ...]
//   без аргументов — авто-поиск проектов (соседние папки с AGENTS.md + .pi/agents)
// Код выхода: 0 — дрейфа нет, 1 — есть (удобно для проверки перед коммитом/синком).
import fs from 'node:fs';
import path from 'node:path';
import { KIT_ROOT, isDir, isFile } from './kit-lib.mjs';

// Деревья кита, которые должны быть идентичны в проектах (строгая сверка)
const STRICT_TREES = ['.pi/agents', '.pi/extensions', '.pi/prompts'];
// Информационная сверка (отличия не ошибка, но показываем счётчик)
const INFO_TREES = ['.ai', '.agents/skills', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.tmp', 'sessions', 'sessions-archive',
  'subagent-runs', 'subagents-temp', '__pycache__']);
// Папки-не-проекты (бэкапы, архивы) — по имени на любом уровне
const SKIP_NAME_RE = /safe-projects|backup|bak-|archive|sync-hub/i;

function listFilesRel(dir, base = dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) listFilesRel(path.join(dir, e.name), base, acc); }
    else acc.push(path.relative(base, path.join(dir, e.name)).split(path.sep).join('/'));
  }
  return acc;
}

function sameFile(a, b) {
  try { return fs.readFileSync(a, 'utf8') === fs.readFileSync(b, 'utf8'); }
  catch { return false; }
}

// Автопоиск проектов: поднимаемся от кита до 3 уровней, сканим папки (глубина 2)
function discoverProjects() {
  const found = new Set();
  let cur = KIT_ROOT;
  for (let up = 0; up < 3; up++) {
    cur = path.dirname(cur);
    for (const lvl1 of fs.readdirSync(cur, { withFileTypes: true })) {
      if (!lvl1.isDirectory() || SKIP_DIRS.has(lvl1.name) || lvl1.name.startsWith('.') || SKIP_NAME_RE.test(lvl1.name)) continue;
      const p1 = path.join(cur, lvl1.name);
      const candidates = [p1];
      try {
        for (const lvl2 of fs.readdirSync(p1, { withFileTypes: true })) {
          if (lvl2.isDirectory() && !SKIP_DIRS.has(lvl2.name) && !lvl2.name.startsWith('.') && !SKIP_NAME_RE.test(lvl2.name)) candidates.push(path.join(p1, lvl2.name));
        }
      } catch { /* нет доступа — пропускаем */ }
      for (const c of candidates) {
        const resolved = path.resolve(c);
        if (resolved === path.resolve(KIT_ROOT)) continue;
        if (isDir(path.join(c, '.pi', 'agents')) && isFile(path.join(c, 'AGENTS.md'))) found.add(resolved);
      }
    }
  }
  return [...found];
}

const args = process.argv.slice(2);
const projects = args.length ? args.map(p => path.resolve(p)) : discoverProjects();
if (!projects.length) { console.log('Проекты-соседи с комплектом не найдены.'); process.exit(0); }

console.log(`Кит: ${KIT_ROOT}\nПроектов на проверку: ${projects.length}\n`);
let driftTotal = 0;

for (const proj of projects) {
  const issues = [];
  const info = [];

  // 1. Строгие деревья: состав и содержимое должны совпадать с китом
  for (const tree of STRICT_TREES) {
    const src = path.join(KIT_ROOT, tree);
    const dst = path.join(proj, tree);
    if (!isDir(src)) continue;
    if (!isDir(dst)) { issues.push(`${tree}/: папки нет в проекте — прогони kit-sync`); continue; }
    const kitFiles = listFilesRel(src);
    const projFiles = new Set(listFilesRel(dst));
    for (const rel of kitFiles) {
      if (!projFiles.has(rel)) issues.push(`${tree}/${rel}: НЕТ в проекте`);
      else if (!sameFile(path.join(src, rel), path.join(dst, rel))) issues.push(`${tree}/${rel}: отличается от кита`);
    }
    for (const rel of projFiles) if (!kitFiles.includes(rel)) issues.push(`${tree}/${rel}: ЛИШНИЙ (в ките удалён?)`);
  }

  // 2. AGENTS.md: каскад дирижёр–исполнитель должен быть той же версии, что в ките
  const kitAg = fs.readFileSync(path.join(KIT_ROOT, 'AGENTS.md'), 'utf8');
  const kitDate = (kitAg.match(/Каскад дирижёр–исполнитель \((\d{2}\.\d{2}\.\d{2})\)/) || [])[1];
  const projAgPath = path.join(proj, 'AGENTS.md');
  if (isFile(projAgPath) && kitDate) {
    const projAg = fs.readFileSync(projAgPath, 'utf8');
    const projDate = (projAg.match(/Каскад дирижёр–исполнитель \((\d{2}\.\d{2}\.\d{2})\)/) || [])[1];
    if (!projDate) issues.push('AGENTS.md: нет секции каскада (старая версия комплекта?)');
    else if (projDate !== kitDate) issues.push(`AGENTS.md: каскад ${projDate} — в ките уже ${kitDate}`);
    if (projAg.includes('cloud-glm')) issues.push('AGENTS.md: упоминается устаревший cloud-glm');
  }

  // 3. Информационно: счётчик отличий в остальных деревьях
  for (const tree of INFO_TREES) {
    const src = path.join(KIT_ROOT, tree);
    const dst = path.join(proj, tree);
    if (!isDir(src) || !isDir(dst)) continue;
    const kitFiles = listFilesRel(src);
    let diff = 0;
    for (const rel of kitFiles) {
      const p = path.join(dst, rel);
      if (!isFile(p) || !sameFile(path.join(src, rel), p)) diff++;
    }
    if (diff) info.push(`${tree}/: ${diff} файл(ов) отличается`);
  }

  const name = path.relative(path.dirname(KIT_ROOT), proj) || proj;
  if (issues.length) {
    driftTotal += issues.length;
    console.log(`✗ ${name} — ДРЕЙФ (${issues.length}):`);
    for (const i of issues) console.log('    ' + i);
  } else {
    console.log(`✓ ${name} — синхронно`);
  }
  for (const i of info) console.log(`    ℹ ${i}`);
}

console.log('');
if (driftTotal) {
  console.log(`ИТОГ: дрейф найден (${driftTotal} расхождений).`);
  console.log('Лечение: node scripts/kit-sync.mjs <проект>  (проекты чужих машин — только через их машину-хозяина, см. .ai/INFRASTRUCTURE.md)');
  process.exit(1);
}
console.log('ИТОГ: все проекты синхронны с китом.');
