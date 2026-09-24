#!/usr/bin/env node
// Валидатор комплекта: запуск в корне комплекта или проекта.
//   node scripts/kit-validate.mjs [корень]
// Проверяет:
//   1. frontmatter всех .pi/agents/*.md (парсер подмножества YAML, как в pi-subagents)
//   2. валидность JSON (.pi/mcp.json, dot-pi-agent/*.json, .agents/**/REGISTRY.md — наличие)
//   3. относительные markdown-ссылки во всех .md (битые ссылки)
//   4. CRLF в *.sh (ломает bash) и в .md/.json комплекта
//   5. обязательные элементы: AGENTS.md, .ai/INDEX.md, .gitignore, skill-installer
import path from 'node:path';
import fs from 'node:fs';
import { isFile, isDir, readText } from './kit-lib.mjs';

const root = path.resolve(process.argv[2] || process.cwd());
const errors = [];
const warns = [];

// --- 1. frontmatter субагентов (минимальный YAML-парсер нашего подмножества) ---
const KNOWN_KEYS = new Set([
  'name', 'package', 'description', 'advertise', 'aliases', 'tools', 'excludeTools',
  'allowNestedSubagents', 'extensions', 'subagentOnlyExtensions', 'model', 'fallbackModels',
  'thinking', 'systemPromptMode', 'inheritProjectContext', 'inheritGlobalContext',
  'inheritSkills', 'skills', 'skillPath', 'output', 'defaultReads', 'defaultProgress',
  'async', 'timeoutMs', 'toolTimeoutMs', 'acceptance', 'acceptanceRole', 'mutationTools',
  'completionGuard', 'interactive', 'maxSubagentDepth', 'memory', 'defaultContext',
]);
// скиллы: собственный набор ключей (pi skills: name, description)
const SKILL_KEYS = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata']);

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { err: 'нет frontmatter' };
  const fm = m[1];
  if (/^\t/.test(fm)) return { err: 'табуляция в frontmatter' };
  const doc = {}; let cur = null; let curIndent = 0;
  for (const line of fm.split(/\r?\n/)) {
    if (/^\s*#/.test(line) || line.trim() === '') continue;
    // многострочный block scalar (key: | или >) — контент пропускаем
    if (cur !== null && /^\s+\S/.test(line)) continue;
    if (/^\s+-\s*/.test(line)) {
      if (!cur) return { err: 'элемент списка без ключа: ' + line.trim() };
      doc[cur].push(line.replace(/^\s+-\s*/, '').trim());
      continue;
    }
    const km = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!km) return { err: 'не распознана строка: ' + JSON.stringify(line) };
    const [, key, val] = km; const v = val.trim();
    curIndent = 0;
    if (v === '' || /^[|>][+-+]*$/.test(v)) { doc[key] = []; cur = key; }
    else { doc[key] = v.replace(/^["']|["']$/g, ''); cur = null; }
  }
  return { doc };
}

function checkAgents(dir, label) {
  if (!isDir(dir)) { warns.push(`${label}: папки нет (ок, если намеренно)`); return; }
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md'))) {
    const p = path.join(dir, f);
    const { doc, err } = parseFrontmatter(readText(p));
    if (err) { errors.push(`${label}/${f}: frontmatter — ${err}`); continue; }
    if (typeof doc.name !== 'string' || !doc.name) errors.push(`${label}/${f}: нет name`);
    if (typeof doc.description !== 'string' || !doc.description) errors.push(`${label}/${f}: нет description`);
    for (const k of Object.keys(doc)) {
      if (!KNOWN_KEYS.has(k)) warns.push(`${label}/${f}: неизвестное поле frontmatter "${k}" (pi-subagents его игнорирует?)`);
    }
  }
}
checkAgents(path.join(root, '.pi', 'agents'), '.pi/agents');
// --- 1b. промпт-шаблоны (.pi/prompts/*.md) — описание обязательно либо в frontmatter, либо первая строка
const PROMPT_KEYS = new Set(['description', 'argument-hint']);
if (isDir(path.join(root, '.pi', 'prompts'))) {
  for (const f of fs.readdirSync(path.join(root, '.pi', 'prompts')).filter(x => x.endsWith('.md'))) {
    const p = path.join(root, '.pi', 'prompts', f);
    const text = readText(p);
    const { doc, err } = parseFrontmatter(text);
    if (err) { errors.push(`.pi/prompts/${f}: frontmatter — ${err}`); continue; }
    for (const k of Object.keys(doc)) {
      if (!PROMPT_KEYS.has(k)) warns.push(`.pi/prompts/${f}: неизвестное поле "${k}" (pi ждёт description/argument-hint)`);
    }
    const body = text.replace(/^---[\s\S]*?---/, '').trim();
    if (!doc.description && !body.split('\n')[0]) errors.push(`.pi/prompts/${f}: нет description`);
    for (const m of text.matchAll(/\$(?:\d|@|ARGUMENTS)/g)) { /* проверка плейсхолдеров */ }
    if (/\$\{(?!\d|@|ARGUMENTS)/.test(text)) warns.push(`.pi/prompts/${f}: подозрительный \${...} (pi подставляет $1, $@, \${1:-default})`);
  }
}
if (isDir(path.join(root, '.agents', 'skills'))) {
  for (const d of fs.readdirSync(path.join(root, '.agents', 'skills'), { withFileTypes: true })) {
    if (d.isDirectory()) {
      const sk = path.join(root, '.agents', 'skills', d.name, 'SKILL.md');
      if (!isFile(sk)) errors.push(`.agents/skills/${d.name}: папка без SKILL.md`);
      else {
        const { doc, err } = parseFrontmatter(readText(sk));
        if (err) errors.push(`.agents/skills/${d.name}/SKILL.md: ${err}`);
        else if (!doc.name || !doc.description) errors.push(`.agents/skills/${d.name}/SKILL.md: нет name/description`);
      }
    }
  }
}

// --- 2. JSON
const jsonFiles = ['.pi/mcp.json', '.pi/settings.json', 'dot-pi-agent/settings.json', 'dot-pi-agent/models.json', 'dot-pi-agent/models.example.json'];
for (const f of jsonFiles) {
  const p = path.join(root, f);
  if (!isFile(p)) continue;
  try { JSON.parse(readText(p)); } catch (e) { errors.push(`${f}: битый JSON — ${e.message.split('\n')[0]}`); }
}
if (isFile(path.join(root, '.pi', 'mcp.json'))) {
  const reg = path.join(root, '.agents', 'skills', 'skill-installer', 'REGISTRY.md');
  if (!isFile(reg)) warns.push('нет .agents/skills/skill-installer/REGISTRY.md — skill-installer не будет работать');
  else if (!readText(reg).includes('## Установлено в проекте')) errors.push('REGISTRY.md: нет секции журнала "## Установлено в проекте"');
}

// --- 3. ссылки в markdown
const SKIP_DIRS = new Set(['.git', 'node_modules', 'bin', 'playwright-report', 'test-results', '.venv', 'venv', '__pycache__', '.idea', 'sessions', 'subagent-artifacts']);
const mdFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) mdFiles.push(p);
  }
})(root);

for (const file of mdFiles) {
  const text = readText(file);
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    let target = m[1].trim();
    if (/^(https?:|mailto:|#|data:)/.test(target)) continue;
    target = decodeURIComponent(target.split('#')[0]);
    if (!target) continue;
    const abs = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(abs)) errors.push(`битая ссылка в ${path.relative(root, file)}: ${target}`);
  }
}

// --- 4. CRLF
for (const file of mdFiles.concat(jsonFiles.map(f => path.join(root, f)).filter(isFile))) {
  const rel = path.relative(root, file);
  if (file.endsWith('.sh') || rel.startsWith('dot-pi-agent') || rel.startsWith('.agents') || rel.startsWith('.pi') || rel.startsWith('.ai')) {
    if (/\r/.test(readText(file))) errors.push(`${rel}: содержит CRLF (нужен LF — см. .gitattributes)`);
  }
}
const shFiles = ['.pi', 'scripts'].map(d => path.join(root, d));
for (const d of shFiles) {
  if (!isDir(d)) continue;
  (function walkSh(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkSh(p);
      else if (e.name.endsWith('.sh') && /\r/.test(readText(p))) errors.push(`${path.relative(root, p)}: CRLF (ломает bash)`);
    }
  })(d);
}
// .bat: только ASCII (cmd.exe ломается на UTF-8-кириллице, см. известный баг парсера)
(function findBats(dir) {
  if (!isDir(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findBats(p);
    else if (e.name.endsWith('.bat')) {
      const buf = fs.readFileSync(p);
      const nonAscii = [...buf].filter(b => b > 127).length;
      if (nonAscii) errors.push(`${path.relative(root, p)}: ${nonAscii} не-ASCII байтов — cmd.exe парсит .bat только в ASCII (русский текст печатает Node)`);
      if (!/\r\n/.test(buf.toString('latin1'))) warns.push(`${path.relative(root, p)}: нет CRLF (для .bat надёжнее CRLF)`);
    }
  }
})(root);

// --- 5. обязательные элементы
for (const f of ['AGENTS.md', '.ai/INDEX.md', '.gitignore']) {
  if (!isFile(path.join(root, f))) warns.push(`нет ${f}`);
}

// --- отчёт
for (const w of warns) console.log('  WARN: ' + w);
if (errors.length) { for (const e of errors) console.error('  FAIL: ' + e); }
console.log(`\nПроверено: ${mdFiles.length} md-файлов, ${jsonFiles.filter(f => isFile(path.join(root, f))).length} JSON.`);
if (errors.length) { console.error(`ИТОГ: ${errors.length} ошибок(и), ${warns.length} предупреждений`); process.exit(1); }
console.log(`ИТОГ: ошибок нет, предупреждений ${warns.length}`);