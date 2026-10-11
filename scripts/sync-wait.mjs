#!/usr/bin/env node
// sync-wait: ждёт синхронизацию файла между машинами через YandexDisk.
// Принцип: MD5 файла локально == MD5 того же файла на удалённой машине (по SSH) = синхронизировано.
// Удалённые команды идут через PowerShell (дефолтный шелл ПК) — CMD-синтаксис там не работает.
//
// Использование (с машины-инициатора, где файл создан):
//   node scripts/sync-wait.mjs <относительный путь> [--host user@ip] [--timeout сек] [--interval сек]
//
// По умолчанию: host = Vladimir@100.68.240.52 (домашний ПК), base на ПК = C:\Yandex.Disk\Computer_Vision\agent-starter-kit
// Выход: 0 = синхронизировано, 1 = таймаут.
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const rel = args.find(a => !a.startsWith('--'));
const hostArg = args.find(a => a.startsWith('--host'))?.split('=')[1] || 'Vladimir@100.68.240.52';
const timeoutSec = Number(args.find(a => a.startsWith('--timeout'))?.split('=')[1] || 300);
const intervalSec = Number(args.find(a => a.startsWith('--interval'))?.split('=')[1] || 15);
const PC_BASE = process.env.PC_KIT_DIR || 'C:\\Yandex.Disk\\Computer_Vision\\agent-starter-kit';

if (!rel) { console.error('укажи относительный путь: node scripts/sync-wait.mjs scripts/wol.mjs'); process.exit(1); }

const localPath = path.resolve(rel);
if (!fs.existsSync(localPath)) { console.error('локальный файл не найден: ' + localPath); process.exit(1); }

const localMd5 = crypto.createHash('md5').update(fs.readFileSync(localPath)).digest('hex').toUpperCase();
const localSize = fs.statSync(localPath).size;
const remoteWin = PC_BASE + '\\' + rel.replace(/\//g, '\\');
const sshBase = 'ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no ' + hostArg;

function remoteHash() {
  try {
    const out = execSync(
      `${sshBase} "powershell -NoProfile -Command \\"(Get-FileHash '${remoteWin}' -Algorithm MD5).Hash\\""`,
      { encoding: 'utf8', timeout: 25000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const lines = out.split('\n').map(l => l.trim()).filter(l => /^[0-9a-fA-F]{32}$/.test(l));
    return lines[0] ? lines[0].toUpperCase() : null;
  } catch { return null; }
}

function remoteExists() {
  try {
    const out = execSync(
      `${sshBase} "powershell -NoProfile -Command \\"Test-Path '${remoteWin}'\\""`,
      { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return /True/i.test(out);
  } catch { return false; }
}

console.log(`файл: ${rel}`);
console.log(`локальный MD5: ${localMd5} (${localSize} байт)`);
console.log(`ждём на: PC:${remoteWin} (таймаут ${timeoutSec}с, интервал ${intervalSec}с)\n`);

const deadline = Date.now() + timeoutSec * 1000;
let attempt = 0;
while (Date.now() < deadline) {
  attempt++;
  if (!remoteExists()) {
    console.log(`[${attempt}] файл на ПК ещё не появился...`);
  } else {
    const r = remoteHash();
    if (r === localMd5) {
      console.log(`\n✓ СИНХРОНИЗИРОВАНО: MD5 на ПК совпадает (${localMd5})`);
      process.exit(0);
    }
    console.log(`[${attempt}] MD5 на ПК: ${r || 'не читается'} — ждём...`);
  }
  const wait = Math.min(intervalSec * 1000, deadline - Date.now());
  if (wait <= 0) break;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
}
console.error(`✗ ТАЙМАУТ ${timeoutSec}с: файл не синхронизировался (проверь YandexDisk-клиент на обеих машинах)`);
process.exit(1);
