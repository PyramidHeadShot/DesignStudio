#!/usr/bin/env node
// Мини-eval для сравнения локальных моделей на задачах субагента.
//
//   node scripts/model-eval.mjs                     # все локальные модели из models.json
//   node scripts/model-eval.mjs qwen3:14b qwen3.8-27b-q3xl   # конкретные модели
//
// 4 задачи с программной проверкой ответов:
//   1. Факты о коде (встроенный сниппет с известными свойствами)
//   2. Поиск бага (off-by-one, засажен заранее)
//   3. Следование инструкции (ровно одно слово)
//   4. Структурированный вывод (нумерованный список)
// Метрики: pass/fail по задачам, tok/s, время. Модели выгружаются после прогона.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const BASE = 'http://localhost:11434';
const KIT = path.resolve(import.meta.dirname, '..');

// --- какие модели оценивать (из models.json провайдера ollama) ---
function installedModels() {
  const p = path.join(os.homedir(), '.pi', 'agent', 'models.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).providers.ollama.models.map(m => m.id);
  } catch { return ['qwen3:14b']; }
}
const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : installedModels();

// --- сниппет для задач 1-2 (баг засажен: i <= arr.length — off-by-one) ---
const SNIPPET = `function mergeConfigs(base, extra) {
  const result = { ...base };
  for (const key of Object.keys(extra)) {
    result[key] = extra[key];
  }
  return result;
}
function loadAllConfigs(paths) {
  const configs = [];
  for (let i = 0; i <= paths.length; i++) {
    configs.push(readConfig(paths[i]));
  }
  return mergeConfigs(...configs);
}
function saveBackup(filePath) {
  const backup = filePath + '.bak';
  fs.copyFileSync(filePath, backup);
  return backup;
}`;

const TASKS = [
  {
    id: 'facts',
    prompt: `Прочитай код:\n\`\`\`\n${SNIPPET}\n\`\`\`\nОтветь кратко на русском, строго три строки:\n1. Сколько функций объявлено (числом)?\n2. В какой функции ошибка выхода за границы массива?\n3. Какая функция создаёт резервную копию файла?`,
    check(text) {
      const ok1 = /(^|\D)3(\D|$)/.test(text);
      const ok2 = /loadAllConfigs/i.test(text);
      const ok3 = /saveBackup/i.test(text);
      return { pass: ok1 && ok2 && ok3, detail: `функций=${ok1 ? 'ок' : '✗'}, баг=${ok2 ? 'ок' : '✗'}, бэкап=${ok3 ? 'ок' : '✗'}` };
    },
  },
  {
    id: 'bug',
    prompt: `В этом коде есть баг, приводящий к чтению несуществующего элемента массива. Назови тип бага и строку, где он:\n\`\`\`\nfor (let i = 0; i <= paths.length; i++) {\n  configs.push(readConfig(paths[i]));\n}\n\`\`\`\nОтветь кратко на русском.`,
    check(text) {
      const t = text.toLowerCase();
      const ok = /(off.by.one|за предел|выход за границ|последн|<=|меньше или равно)/i.test(t) && /paths\.length|i\b/.test(t);
      return { pass: ok, detail: ok ? 'баг идентифицирован' : 'баг не назван' };
    },
  },
  {
    id: 'instruction',
    prompt: 'Ответь ровно одним словом ГОТОВ и ничем больше. Никаких пояснений, знаков препинания и размышлений.',
    check(text) {
      const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim().replace(/[.!.]/g, '');
      return { pass: clean.toUpperCase().startsWith('ГОТОВ'), detail: 'ответ: ' + JSON.stringify(clean.slice(0, 40)) };
    },
  },
  {
    id: 'structure',
    prompt: 'Выдай нумерованный список ровно из 3 пунктов о том, зачем нужна резервная копия файлов перед изменением. Каждый пункт начинается с "1." "2." "3." и содержит одно предложение на русском.',
    check(text) {
      const items = text.match(/^\s*[123][.)]/gm) || [];
      const cyr = (text.match(/[\u0400-\u04FF]/g) || []).length > 20;
      return { pass: items.length >= 3 && cyr, detail: `пунктов=${items.length}, русский=${cyr ? 'ок' : '✗'}` };
    },
  },
];

// --- утилиты ---
function stripThinking(t) { return (t || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim(); }

function chat(model, prompt, keepAlive) {
  const body = JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, keep_alive: keepAlive });
  const res = spawnCurl('/api/chat', body);
  const j = JSON.parse(res);
  return j;
}
function spawnCurl(path_, body) {
  const tmp = path.join(os.tmpdir(), 'eval-req.json');
  fs.writeFileSync(tmp, body);
  return execFileSync('curl', ['-s', '-m', '300', '-X', 'POST', BASE + path_, '-H', 'Content-Type: application/json', '--data-binary', '@' + tmp], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}
function unload(model) { try { spawnCurl('/api/chat', JSON.stringify({ model, messages: [], keep_alive: 0 })); } catch {} }

// --- прогон ---
async function main() {
  console.log('Мини-eval локальных моделей · задач: ' + TASKS.length + '\n');
  const results = [];
  for (const model of MODELS) {
    process.stdout.write(`▶ ${model}: `);
    const t0 = Date.now();
    let tasks = [], tokTotal = 0, err = null;
    for (const task of TASKS) {
      try {
        const j = chat(model, task.prompt, 300);
        const text = stripThinking(j.message?.content);
        const tps = j.eval_duration ? Math.round(j.eval_count / (j.eval_duration / 1e9)) : 0;
        tokTotal += tps;
        const verdict = task.check(text);
        tasks.push({ id: task.id, pass: verdict.pass, tps, detail: verdict.detail });
      } catch (e) {
        tasks.push({ id: task.id, pass: false, tps: 0, detail: 'ОШИБКА: ' + (e.message || '').slice(0, 80) });
        err = e.message?.slice(0, 100);
      }
    }
    unload(model);
    const wall = Math.round((Date.now() - t0) / 1000);
    const passed = tasks.filter(t => t.pass).length;
    const avgTps = Math.round(tokTotal / TASKS.length);
    results.push({ model, passed, tasks, wall, avgTps });
    console.log(`пройдено ${passed}/${TASKS.length}, средняя скорость ${avgTps} tok/s, время ${wall}с${err ? ' (была ошибка)' : ''}`);
    for (const t of tasks) console.log(`   ${t.pass ? '✓' : '✗'} ${t.id}: ${t.detail}`);
    console.log('');
  }

  // сводка
  console.log('════ СВОДНАЯ ТАБЛИЦА ════');
  console.log('Модель'.padEnd(30), 'Балл', 'tok/s', 'Время');
  for (const r of results.sort((a, b) => b.passed - a.passed || b.avgTps - a.avgTps)) {
    console.log(r.model.padEnd(30), (r.passed + '/' + TASKS.length).padEnd(5), String(r.avgTps).padEnd(6), r.wall + 'с');
  }
  const best = results.slice().sort((a, b) => b.passed - a.passed || b.avgTps - a.avgTps)[0];
  if (best) console.log('\n🏆 Лучший балл: ' + best.model);
  console.log('(модели выгружены из VRAM после прогона)');
}

main();
