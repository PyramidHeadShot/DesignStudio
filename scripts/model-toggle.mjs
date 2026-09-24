#!/usr/bin/env node
// Загрузка/выгрузка локальной модели из VRAM.
//
//   node model-toggle.mjs load     — поднять модель в VRAM (останется там: KEEP_ALIVE=-1)
//   node model-toggle.mjs unload   — освободить VRAM (для игр)
//   node model-toggle.mjs status   — что сейчас в видеопамяти
//
// Сервер Ollama при этом продолжает работать — выгружается только модель.
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';

const HOST = process.env.OLLAMA_HOST_HOSTNAME || 'localhost';
const PORT = 11434;
const PLATFORM = process.platform;
const BASE = process.env.OLLAMA_API_BASE || `http://${HOST}:${PORT}`;
const MODEL = process.argv[3] || 'qwen3:14b';

function post(path, body) {
  const res = execFileSync('curl', ['-s', '-m', '300', '-X', 'POST', `${BASE}${path}`,
    '-H', 'Content-Type: application/json', '--data-binary', JSON.stringify({ stream: false, ...body })],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(res);
}

function psTable() {
  try {
    const list = (JSON.parse(execFileSync('curl', ['-s', '-m', '10', BASE + '/api/ps'], { encoding: 'utf8', maxBuffer: 1024 * 1024 })).models) || [];
    if (!list.length) return '';
    return list.map(m => {
      const vram = m.size_vram ? Math.round(m.size_vram / 1073741824 * 10) / 10 + ' ГБ VRAM' : 'на CPU';
      return m.name + '  |  ' + (Math.round(m.size / 1073741824 * 10) / 10) + ' ГБ  |  ' + vram;
    }).join('\n');
  } catch { return ''; }
}

const cmd = process.argv[2] || 'status';

if (cmd === 'unload' || cmd === 'unload-all') {
  // для освобождения VRAM выгружаем ВСЕ загруженные модели (игре нужен весь объём)
  let targets = [MODEL];
  try {
    const loaded = JSON.parse(execFileSync('curl', ['-s', BASE + '/api/ps'], { encoding: 'utf8' })).map(m => m.name);
    if (cmd === 'unload-all' || loaded.length > 0) targets = loaded;
  } catch { /* сервер недоступен — пробуем MODEL */ }
  for (const model of targets) {
    console.log('Выгружаю из VRAM:', model);
    post('/api/chat', { model, messages: [], keep_alive: 0 });
  }
  // процессы-сироты llama-server (остаются после рестартов сервера) тоже жрут VRAM
  if (PLATFORM === 'win32') spawnSync('taskkill', ['/f', '/im', 'llama-server.exe'], { stdio: 'ignore' });
  const ps = psTable();
  console.log(ps ? '⚠ что-то осталось:\n' + ps : '✓ VRAM освобождена — можно играть');
} else if (cmd === 'load') {
  console.log('Поднимаю модель в VRAM (останется постоянно)...');
  const j = post('/api/chat', { model: MODEL, messages: [{ role: 'user', content: 'ok' }], keep_alive: -1 });
  console.log('✓ модель загружена, tok/s:', j.eval_duration ? Math.round(j.eval_count / (j.eval_duration / 1e9)) : '?');
  console.log(psTable());
} else if (cmd === 'status') {
  const ps = psTable();
  console.log(ps ? 'В VRAM сейчас:\n' + ps : 'В VRAM пусто (модель не загружена)');
} else {
  console.log('Использование: node model-toggle.mjs [load | unload | status]');
}
