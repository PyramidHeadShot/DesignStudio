#!/usr/bin/env node
// Обновление комплекта в уже внедрённых проектах из мастер-копии instructions.
// Запуск из корня комплекта:  node scripts/kit-sync.mjs <проект1> [проект2 ...] [флаги]
//   --no-agents   не трогать AGENTS.md/AGENTS.kit.md (для проектов со своим AGENTS.md)
//   --no-ssh    не трогать серверную часть (.pi: ssh/sftp)
//   --registry-url <url> / --registry-file <path> — источник свежего REGISTRY.md
// Обновляются: .ai/ (кроме PROJECT.md), .agents/ (README + skill-installer), .pi/, scripts/,
// .env.example (если нет), .gitignore (дозапись), УСТАНОВКА.md, REGISTRY.md (каталог свежий, журнал проектный).
// НЕ обновляются: .ai/PROJECT.md, Задачи.md, Описание.md, .env, ваш AGENTS.md (при отличии появится AGENTS.kit.md).
import fs from 'node:fs';
import path from 'node:path';
import {
  KIT_ROOT, PROTECTED, log, die, isDir, isFile,
  copyTree, mergeGitignore, installAgentsMd, refreshRegistry, stripSsh,
} from './kit-lib.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--') && !a.startsWith('--registry-')));
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const registryUrl = opt('--registry-url');
const registryFile = opt('--registry-file');

const targets = args.filter(a => !a.startsWith('--') && a !== opt('--registry-url') && a !== opt('--registry-file'));
if (!targets.length) die('укажите хотя бы один проект: node scripts/kit-sync.mjs <проект> [...]');
const noSsh = flags.has('--no-ssh');
const noAgents = flags.has('--no-agents');

for (const t of targets) {
  const targetRoot = path.resolve(t);
  if (!isDir(targetRoot)) { die('нет папки: ' + targetRoot); }
  log(`\n=== Синхронизация: ${targetRoot}`);

  log(noAgents ? 'AGENTS.md: пропущен (--no-agents — у проекта свой)' : 'AGENTS.md: ' + installAgentsMd(KIT_ROOT, targetRoot));

  const aiSkip = PROTECTED.filter(p => p.startsWith('.ai/')).map(p => p.slice('.ai/'.length));
  const rAi = copyTree(path.join(KIT_ROOT, '.ai'), path.join(targetRoot, '.ai'), { skip: aiSkip });
  log(`.ai/: обновлено ${rAi.copied}, пропущено ${rAi.skipped}`);

  // .agents/: обновляем комплектные скиллы из мастера, сторонние скиллы проекта не трогаем
  // Скиллы из MASTER_ONLY_SKILLS остаются только в мастере (слишком специфичные для проектов)
  const MASTER_ONLY_SKILLS = new Set(['keenetic-entware-setup']);
  const agSrc = path.join(KIT_ROOT, '.agents');
  const agDst = path.join(targetRoot, '.agents');
  if (isDir(agSrc)) {
    const skillsSrc = path.join(agSrc, 'skills');
    let copied = 0;
    for (const entry of fs.readdirSync(skillsSrc, { withFileTypes: true })) {
      if (entry.name === 'README.md') {
        fs.mkdirSync(path.join(agDst, 'skills'), { recursive: true });
        fs.copyFileSync(path.join(skillsSrc, entry.name), path.join(agDst, 'skills', entry.name));
        copied++;
        continue;
      }
      if (!entry.isDirectory() || MASTER_ONLY_SKILLS.has(entry.name)) continue;
      const skip = (entry.name === 'skill-installer' ? ['REGISTRY.md'] : []);
      const r = copyTree(path.join(skillsSrc, entry.name), path.join(agDst, 'skills', entry.name), { skip });
      copied += r.copied;
    }
    log(`.agents/: обновлены комплектные скиллы (${copied} файлов), сторонние в проекте не тронуты`);
  }

  if (isDir(path.join(KIT_ROOT, '.pi'))) {
    const rPi = copyTree(path.join(KIT_ROOT, '.pi'), path.join(targetRoot, '.pi'), {
      skip: ['sessions'],  // сессии мастера в проект не переносим
    });
    log(`.pi/: обновлено ${rPi.copied}`);
    for (const f of ['ssh.sh', 'sftp.sh']) {
      const src = path.join(KIT_ROOT, 'scripts', f);
      if (isFile(src)) {
        fs.mkdirSync(path.join(targetRoot, 'scripts'), { recursive: true });
        fs.copyFileSync(src, path.join(targetRoot, 'scripts', f));
      }
    }
    if (noSsh) { stripSsh(targetRoot); log('--no-ssh: серверная часть .pi/ удалена'); }
  }

  // scripts/: весь набор целиком (ssh/sftp-обёртки, kit-*, model-toggle/eval, menu)
  fs.mkdirSync(path.join(targetRoot, 'scripts'), { recursive: true });
  for (const f of fs.readdirSync(path.join(KIT_ROOT, 'scripts'))) {
    fs.copyFileSync(path.join(KIT_ROOT, 'scripts', f), path.join(targetRoot, 'scripts', f));
  }
  log('scripts/: обновлены (ssh.sh, sftp.sh, kit-*, model-*)');

  const envSrc = path.join(KIT_ROOT, '.env.example');
  const envDst = path.join(targetRoot, '.env.example');
  if (isFile(envSrc) && !isFile(envDst)) { fs.copyFileSync(envSrc, envDst); log('.env.example: добавлен'); }

  fs.copyFileSync(path.join(KIT_ROOT, 'УСТАНОВКА.md'), path.join(targetRoot, 'УСТАНОВКА.md'));
  log('УСТАНОВКА.md: обновлён');

  if (isFile(path.join(KIT_ROOT, '.gitignore'))) log('.gitignore: ' + mergeGitignore(KIT_ROOT, targetRoot));
  log('REGISTRY.md: ' + refreshRegistry(targetRoot, { registryUrl, registryFile }));

  const kept = PROTECTED.filter(p => isFile(path.join(targetRoot, p)));
  if (kept.length) log('Проектные файлы не тронуты: ' + kept.join(', '));
}

log('\nГотово. Если обновлялись .pi/ — перезапустите pi (или /reload).');
