// Общая библиотека для kit-install / kit-sync / kit-validate.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Корень комплекта (папка, где лежит этот scripts/)
export const KIT_ROOT = path.resolve(import.meta.dirname, '..');

// Проектные файлы, которые скрипты НИКОГДА не перезаписывают
export const PROTECTED = [
  '.ai/PROJECT.md',   // карточка проекта (создаётся онбордингом)
  'Задачи.md',        // бэклог проекта
  'Описание.md',      // описание проекта
  '.env',             // секреты
];

const JOURNAL_HEADER = '## Установлено в проекте';

export function log(msg) { console.log(msg); }
export function die(msg) { console.error('ОШИБКА: ' + msg); process.exit(1); }

export function exists(p) { return fs.existsSync(p); }
export function isFile(p) { return fs.existsSync(p) && fs.statSync(p).isFile(); }
export function isDir(p) { return fs.existsSync(p) && fs.statSync(p).isDirectory(); }

export function readText(p) { return fs.readFileSync(p, 'utf8'); }
export function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.replace(/\r\n/g, '\n'));
}

// Рекурсивное копирование папки.
// skip — массив путей ОТНОСИТЕЛЬНО srcDir (с /): файлы/папки, которые не копировать.
export function copyTree(srcDir, dstDir, { skip = [], overwrite = true } = {}) {
  let copied = 0, skipped = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const rel = entry.name; // относительно srcDir
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (skip.includes(rel)) { skipped++; continue; }
    // для вложенных папок: передаём дальше только skip-пути внутри этой папки
    const childSkip = skip
      .filter(s => s.startsWith(rel + '/'))
      .map(s => s.slice(rel.length + 1));
    if (entry.isDirectory()) {
      const r = copyTree(src, dst, { skip: childSkip, overwrite });
      copied += r.copied; skipped += r.skipped;
    } else {
      if (!overwrite && isFile(dst)) { skipped++; continue; }
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      copied++;
    }
  }
  return { copied, skipped };
}

// .gitignore: не перезаписываем, а дописываем недостающие непустые строки
export function mergeGitignore(masterRoot, targetRoot) {
  const src = path.join(masterRoot, '.gitignore');
  const dst = path.join(targetRoot, '.gitignore');
  if (!isFile(src)) return 'нет в комплекте';
  const lines = readText(src).split('\n').map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  let existing = '';
  if (isFile(dst)) existing = readText(dst);
  const existingSet = new Set(existing.split('\n').map(l => l.trim()));
  const missing = lines.filter(l => !existingSet.has(l));
  if (missing.length === 0) return 'без изменений';
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  const block = existing
    ? existing + sep + '\n# из комплекта agent-starter-kit\n' + missing.join('\n') + '\n'
    : missing.join('\n') + '\n';
  writeText(dst, block);
  return `дописано ${missing.length} строк`;
}

// AGENTS.md: не затираем проектный — кладём версию комплекта рядом для сверки
export function installAgentsMd(masterRoot, targetRoot) {
  const src = path.join(masterRoot, 'AGENTS.md');
  const dst = path.join(targetRoot, 'AGENTS.md');
  if (!isFile(dst)) { fs.copyFileSync(src, dst); return 'установлен'; }
  if (readText(dst) === readText(src)) return 'совпадает с комплектом';
  writeText(path.join(targetRoot, 'AGENTS.kit.md'), readText(src));
  return 'проектный сохранён; версия комплекта → AGENTS.kit.md (сверьте и объедините вручную)';
}

// Обновление REGISTRY.md: свежий каталог + сохранённый журнал установок проекта.
// Источник свежих данных: registryUrl (https) | registryFile | REGISTRY.md комплекта.
export function refreshRegistry(targetRoot, { registryUrl, registryFile } = {}) {
  const targetPath = path.join(targetRoot, '.agents', 'skills', 'skill-installer', 'REGISTRY.md');
  let fresh;
  if (registryUrl) {
    fresh = execFileSync('curl', ['-fsSL', registryUrl], { encoding: 'utf8' });
  } else if (registryFile) {
    fresh = readText(registryFile);
  } else {
    fresh = readText(path.join(KIT_ROOT, '.agents', 'skills', 'skill-installer', 'REGISTRY.md'));
  }
  if (!fresh.includes(JOURNAL_HEADER)) die('источник реестра без секции "' + JOURNAL_HEADER + '"');
  const freshCatalog = fresh.split(JOURNAL_HEADER)[0].trimEnd() + '\n';

  if (!isFile(targetPath)) {
    writeText(targetPath, fresh);
    return 'создан из свежих данных';
  }
  const target = readText(targetPath);
  const idx = target.indexOf(JOURNAL_HEADER);
  const journal = idx >= 0 ? target.slice(idx) : JOURNAL_HEADER + '\n\n- (пока пусто)\n';
  const updated = freshCatalog + '\n' + journal.trimStart();
  if (updated === target) return 'без изменений';
  writeText(targetPath, updated);
  return 'каталог обновлён, журнал проекта сохранён';
}

// --no-ssh: убрать серверные агенты и ssh/sftp из .pi/mcp.json
export function stripSsh(targetRoot) {
  const agentsDir = path.join(targetRoot, '.pi', 'agents');
  for (const name of ['server-operator', 'sftp-operator', 'server-deployer']) {
    const p = path.join(agentsDir, name + '.md');
    if (isFile(p)) fs.unlinkSync(p);
  }
  const mcpPath = path.join(targetRoot, '.pi', 'mcp.json');
  if (isFile(mcpPath)) {
    const mcp = JSON.parse(readText(mcpPath));
    delete mcp.mcpServers['ssh-connect'];
    delete mcp.mcpServers['sftp-connect'];
    writeText(mcpPath, JSON.stringify(mcp, null, 2) + '\n');
  }
}
