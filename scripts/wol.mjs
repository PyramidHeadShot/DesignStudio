#!/usr/bin/env node
// Отправка Magic Packet (Wake-on-LAN) для пробуждения ПК из сна.
// Запуск: node wol.mjs [MAC] [broadcast]
//   MAC по умолчанию — домашний ПК (pyramidpc), broadcast — на весь диапазон.
// Пример: node wol.mjs                       // разбудить ПК
//         node wol.mjs 22:22:6C:09:03:4B     // конкретный MAC
import dgram from 'node:dgram';

const MAC_DEFAULT = '22:22:6C:09:03:4B';   // pyramidpc, Realtek Gaming 2.5GbE
const macArg = (process.argv[2] || MAC_DEFAULT).replace(/[:-]/g, '');
const macBytes = macArg.match(/.{2}/g);
if (!macBytes || macBytes.length !== 6 || macBytes.some(b => isNaN(parseInt(b, 16)))) {
  console.error('Некорректный MAC: ' + process.argv[2]);
  process.exit(1);
}

// Magic Packet: 6 раз 0xFF + MAC, повторённый 16 раз
const payload = Buffer.concat([
  Buffer.alloc(6, 0xff),
  ...Array(16).fill(Buffer.from(macBytes.map(b => parseInt(b, 16)))),
]);

const broadcasts = process.argv[3]
  ? [process.argv[3]]
  : ['255.255.255.255', '192.168.1.255', '192.168.0.255'];

const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
sock.bind(() => {
  sock.setBroadcast(true);
  let sent = 0;
  for (const host of broadcasts) {
    // 3 повтора на каждый адрес — Magic Packet иногда глотается
    for (let i = 0; i < 3; i++) {
      sock.send(payload, 9, host, (err) => {
        if (err) console.error(`✗ ${host}: ${err.message}`);
        else console.log(`✓ Magic Packet → ${host}:9 (${i + 1}/3)`);
        if (++sent === broadcasts.length * 3) sock.close();
      });
    }
  }
});
console.log(`MAC: ${macBytes.join(':').toUpperCase()}`);
