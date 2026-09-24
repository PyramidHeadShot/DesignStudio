#!/usr/bin/env node
// WoL-сервер для tailnet: приём GET /wake → magic packet ПК по LAN.
// Запуск на домашней машине (NEO), которая: а) в tailnet, б) в одном L2 с ПК.
// С работы: http://<tailnet-IP этой машины>:8321/wake?key=<ключ из WOL_KEY или по умолчанию>
//
// Переменные окружения:
//   WOL_KEY   секрет строки пробуждения (по умолчанию сгенерируется и покажется при старте)
//   WOL_MAC   MAC целевого ПК (по умолчанию 22:22:6C:09:03:4B)
//   WOL_PORT  порт сервера (по умолчанию 8321)
import http from 'node:http';
import dgram from 'node:dgram';
import crypto from 'node:crypto';

const KEY = process.env.WOL_KEY || crypto.randomBytes(8).toString('hex');
const MAC = (process.env.WOL_MAC || '22:22:6C:09:03:4B').toLowerCase();
const PORT = Number(process.env.WOL_PORT || 8321);
const BROADCASTS = ['192.168.1.255', '192.168.0.255'];

function magicPacket(mac) {
  const parts = mac.split(/[:\-]/).map(h => parseInt(h, 16));
  if (parts.length !== 6 || parts.some(Number.isNaN)) throw new Error('плохой MAC');
  return Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), ...Array(16).fill(Buffer.from(parts))]);
}

function wake() {
  const pkt = magicPacket(MAC);
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.bind(() => { sock.setBroadcast(true); });
  let sent = 0;
  return new Promise(resolve => {
    for (const bc of BROADCASTS) {
      for (let i = 0; i < 3; i++) {
        sock.send(pkt, 9, bc, () => { if (++sent >= 6) { sock.close(); resolve(sent); } });
      }
    }
    setTimeout(() => { try { sock.close(); } catch {} resolve(sent); }, 3000);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/wake') {
    if (url.searchParams.get('key') !== KEY) { res.writeHead(403).end('forbidden'); return; }
    const sent = await wake();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>✈ Magic Packet ×${sent} отправлен → ${MAC}</h1><p>ПК просыпается 2–5 сек. Проверка: tailscale ping pyramidpc</p>`);
    console.log(new Date().toISOString(), 'WoL отправлен, пакетов:', sent);
  } else if (url.pathname === '/ping') {
    res.writeHead(200).end('pong');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>WoL-сервер жив</h1><p>Пробуждение: /wake?key=...</p>');
  }
});

server.listen(PORT, () => {
  console.log(`WoL-сервер: http://<tailnet-IP>:${PORT}`);
  console.log(`  ключ:  ${KEY}`);
  console.log(`  MAC:   ${MAC}`);
  console.log(`  пробуждение: http://<IP>:${PORT}/wake?key=${KEY}`);
});
