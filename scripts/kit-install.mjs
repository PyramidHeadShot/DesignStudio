#!/usr/bin/env node
// Установка комплекта agent-starter-kit в проект.
// Запуск из корня комплекта:  node scripts/kit-install.mjs <целевой-проект> [флаги]
//   --no-pi          не копировать .pi/ и scripts/ssh.sh|sftp.sh (агенту pi не нужен)
//   --no-ssh         копировать .pi/, но без серверных агентов и ssh/sftp-серверов
//   --registry-url <url>  взять свежий REGISTRY.md по URL (raw-ссылка) вместо bundled
//   --registry-file <path> взять свежий REGISTRY.md из файла
// Проектные файлы (PROJECT.md, Задачи.md, Описание.md, .env) не перезаписываются.
import path from 'node:path';
import fs from 'node:fs';
import {
  KIT_ROOT, PROTECTED, log, die, isDir, isFile, exists,
  copyTree, mergeGitignore, installAgentsMd, refreshRegistry, stripSsh,
} from './kit-lib.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--') && !a.startsWith('--registry-')));
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const registryUrl = opt('--registry-url');
const registryFile = opt('--registry-file');

const target = args.find(a => !a.startsWith('--') && a !== opt('--registry-url') && a !== opt('--registry-file'));
if (!target) die('укажите целевой проект: node scripts/kit-install.mjs <проект> [--no-pi] [--no-ssh]');
const targetRoot = path.resolve(target);
fs.mkdirSync(targetRoot, { recursive: true });

const rel = p => path.relative(targetRoot, p).split(path.sep).join('/');
const noPi = flags.has('--no-pi');
const noSsh = flags.has('--no-ssh');
log(`Установка комплекта в ${targetRoot}\n`);

// AGENTS.md (проектный не трогаем)
log('AGENTS.md: ' + installAgentsMd(KIT_ROOT, targetRoot));

// .ai/ — целиком, кроме проектной карточки (skip — относительно srcDir)
const aiSkip = PROTECTED.filter(p => p.startsWith('.ai/')).map(p => p.slice('.ai/'.length));
const rAi = copyTree(path.join(KIT_ROOT, '.ai'), path.join(targetRoot, '.ai'), { skip: aiSkip });
log(`.ai/: скопировано ${rAi.copied}, пропущено ${rAi.skipped}`);

// .agents/ — универсальные скиллы (REGISTRY.md не копируем вслепую — его обновляет refreshRegistry)
if (isDir(path.join(KIT_ROOT, '.agents'))) {
  const rAg = copyTree(path.join(KIT_ROOT, '.agents'), path.join(targetRoot, '.agents'), {
    skip: ['skills/skill-installer/REGISTRY.md'],
  });
  log(`.agents/: скопировано ${rAg.copied}`);
}

// .pi/ + обёртки MCP
if (!noPi) {
  const rPi = copyTree(path.join(KIT_ROOT, '.pi'), path.join(targetRoot, '.pi'), {
    skip: ['sessions'],  // сессии мастера в проект не переносим — у проекта свои
  });
  log(`.pi/: скопировано ${rPi.copied}`);
  if (noSsh) { stripSsh(targetRoot); log('--no-ssh: серверные агенты и ssh/sftp-серверы удалены из .pi/'); }
}

// скрипты: весь набор целиком (ssh/sftp-обёртки, kit-*, model-toggle/eval, menu)
fs.mkdirSync(path.join(targetRoot, 'scripts'), { recursive: true });
for (const f of fs.readdirSync(path.join(KIT_ROOT, 'scripts'))) {
  fs.copyFileSync(path.join(KIT_ROOT, 'scripts', f), path.join(targetRoot, 'scripts', f));
}
log('scripts/: ssh.sh, sftp.sh, kit-*.mjs, model-*.mjs, model-menu.bat скопированы');

// .env.example (не перезаписываем существующий)
const envSrc = path.join(KIT_ROOT, '.env.example');
const envDst = path.join(targetRoot, '.env.example');
if (isFile(envSrc)) {
  if (isFile(envDst)) log('.env.example: уже есть — оставлен проектный');
  else { fs.copyFileSync(envSrc, envDst); log('.env.example: установлен'); }
}

// УСТАНОВКА.md — документация комплекта (комплектный файл, обновляется при sync)
fs.copyFileSync(path.join(KIT_ROOT, 'УСТАНОВКА.md'), path.join(targetRoot, 'УСТАНОВКА.md'));
log('УСТАНОВКА.md: установлен');

// .gitignore — дописать недостающее
if (isFile(path.join(KIT_ROOT, '.gitignore'))) {
  log('.gitignore: ' + mergeGitignore(KIT_ROOT, targetRoot));
}

// REGISTRY.md — свежие данные (каталог обновляется, журнал проекта сохраняется)
log('REGISTRY.md: ' + refreshRegistry(targetRoot, { registryUrl, registryFile }));

// Защищённые файлы — справка
const kept = PROTECTED.filter(p => isFile(path.join(targetRoot, p)));
if (kept.length) log('Проектные файлы не тронуты: ' + kept.join(', '));

log('\nГотово. Дальше: pi → подтвердить trust → «пройди онбординг» (создаст .ai/PROJECT.md).');
if (exists(path.join(targetRoot, 'AGENTS.kit.md'))) {
  log('Внимание: в проекте был свой AGENTS.md — сравните его с AGENTS.kit.md и объедините.');
}
