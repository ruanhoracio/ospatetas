// Servidor: arquivos do jogo + salas online via WebSocket (física roda aqui).
import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Game, DT } from './shared/game.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(dir, 'public')));
app.use('/shared', express.static(path.join(dir, 'shared')));
app.get('/vendor/three.module.js', (q, r) => r.sendFile(path.join(dir, 'node_modules/three/build/three.module.js')));
app.get('/vendor/cannon-es.js', (q, r) => r.sendFile(path.join(dir, 'node_modules/cannon-es/dist/cannon-es.js')));
app.get('/api/ping', (q, r) => r.json({ ok: true, rooms: rooms.size }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map(); // código -> { game, clients:Set }
let nextId = 1;

function getRoom(code) {
  let r = rooms.get(code);
  if (!r) {
    r = { code, game: new Game(), clients: new Set(), acc: 0, last: performance.now(), tick: 0 };
    rooms.set(code, r);
  }
  return r;
}

wss.on('connection', (ws) => {
  let room = null;
  const id = 'p' + nextId++;
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'join' && !room) {
      const code = String(m.room || 'geral').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'GERAL';
      const r = getRoom(code);
      const p = r.game.addPlayer(id, m.info || {});
      if (!p) { ws.send(JSON.stringify({ type: 'full' })); return; }
      room = r;
      r.clients.add(ws);
      ws.send(JSON.stringify({ type: 'welcome', id, room: code }));
    } else if (!room) return;
    else if (m.type === 'input') room.game.setInput(id, m.i);
    else if (m.type === 'addBot') room.game.addBot();
    else if (m.type === 'removeBot') room.game.removeBot();
    else if (m.type === 'map') room.game.setMap(+m.map);
    else if (m.type === 'info') room.game.players.get(id)?.setInfo(m.info);
    else if (m.type === 'chat') {
      const p = room.game.players.get(id);
      const text = String(m.text || '').slice(0, 120).trim();
      if (p && text) room.game.event({ type: 'chat', name: p.name, text });
    }
  });
  ws.on('close', () => {
    if (!room) return;
    room.clients.delete(ws);
    room.game.removePlayer(id);
    const humans = [...room.game.players.values()].filter((p) => !p.isBot).length;
    if (!humans) rooms.delete(room.code);
  });
});

// laço fixo de 60 passos/s, envia 30 estados/s
setInterval(() => {
  const now = performance.now();
  for (const r of rooms.values()) {
    r.acc += Math.min(0.25, (now - r.last) / 1000);
    r.last = now;
    while (r.acc >= DT) {
      r.game.step();
      r.acc -= DT;
      if (++r.tick % 2 === 0) {
        const msg = JSON.stringify({ type: 'snap', s: r.game.snapshot() });
        for (const c of r.clients) if (c.readyState === 1) c.send(msg);
      }
    }
  }
}, 8);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Ospatetas rodando em http://localhost:${PORT}`));
