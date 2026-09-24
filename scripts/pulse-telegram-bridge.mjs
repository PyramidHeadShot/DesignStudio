#!/usr/bin/env node
// Мост: pi-agent-pulse (Generic Webhook) → Telegram.
// Приём POST от pi-agent-pulse, фильтр событий, пересылка в Telegram бот.
//
// Запуск:  node scripts/pulse-telegram-bridge.mjs
// ENV:     TELEGRAM_BOT_TOKEN=...  TELEGRAM_CHAT_ID=...
// Порты:   http://127.0.0.1:8787/webhook  ← сюда указывает pi-pulse.json
//
// События pulse: TASK_STARTED, TASK_WARNING, TASK_STALLED, TASK_COMPLETED (+metadata)
// Фильтр: STARTED можно скрыть (шум), WARNING/STALLED/FAILED — всегда алерт.

import http from 'node:http';

const PORT = Number(process.env.BRIDGE_PORT || 8787);
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT = process.env.TELEGRAM_CHAT_ID || '';
const SHOW_STARTED = process.env.SHOW_STARTED === '1';

function tg(text) {
  if (!TOKEN || !CHAT) { console.log('[bridge] Telegram не настроен, событие:', text.slice(0, 80)); return; }
  fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML' }),
  }).catch(e => console.error('[bridge] Telegram ошибка:', e.message));
}

function render(ev) {
  const type = ev.event || ev.type || 'EVENT';
  const host = ev.hostname || ev.host || '';
  const task = (ev.summary || ev.prompt || '').slice(0, 120);
  const mins = ev.durationMinutes || ev.duration_minutes || '';
  const icons = {
    TASK_STARTED: '▶️', TASK_WARNING: '⚠️', TASK_STALLED: '🐌',
    TASK_COMPLETED: '✅', TASK_FAILED: '❌', TASK_ABORTED: '⛔',
  };
  let line = `${icons[type] || '📡'} <b>${type}</b>`;
  if (host) line += ` @ ${host}`;
  if (mins) line += ` | ${mins} мин`;
  if (task) line += `\n<code>${task.replace(/</g, '&lt;')}</code>`;
  return line;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.includes('/webhook')) {
    res.writeHead(200).end('pulse-telegram-bridge: POST /webhook');
    return;
  }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const ev = JSON.parse(body);
      const type = ev.event || ev.type || '';
      if (type === 'TASK_STARTED' && !SHOW_STARTED) {
        console.log(new Date().toISOString(), 'STARTED (скрыт)');
      } else {
        const msg = render(ev);
        console.log(new Date().toISOString(), '→ Telegram:', type);
        tg(msg);
      }
      res.writeHead(200).end('ok');
    } catch (e) {
      console.error('[bridge] ошибка парсинга:', e.message);
      res.writeHead(400).end('bad json');
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`pulse-telegram-bridge: http://127.0.0.1:${PORT}/webhook`);
  console.log(`Telegram: ${TOKEN && CHAT ? 'настроен' : 'НЕ настроен (задай TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID)'}`);
});
