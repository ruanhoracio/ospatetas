// Rabisca Aí! — servidor do jogo de desenhar e adivinhar
// Node puro + biblioteca "ws". Serve a página e cuida das salas em tempo real.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const TEMAS = require('./palavras');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

// ---------- HTTP (arquivos da página) ----------
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/saude') { res.writeHead(200); return res.end('ok'); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { // qualquer rota desconhecida cai na página (ex.: /ABCD)
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('não encontrado'); }
        res.writeHead(200, { 'Content-Type': TIPOS['.html'] }); res.end(d2);
      });
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- utilidades ----------
const salas = new Map(); // codigo -> sala
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I e O para não confundir
const novoCodigo = () => {
  let c;
  do { c = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join(''); } while (salas.has(c));
  return c;
};
const novoId = () => Math.random().toString(36).slice(2, 10);
const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const embaralhar = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function distancia(a, b) { // Levenshtein, para avisar "quase!"
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const limpaTexto = (s, max) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

const TEMAS_PUBLICO = Object.entries(TEMAS).map(([id, t]) => ({ id, nome: t.nome, icone: t.icone }));
const NIVEIS = ['facil', 'medio', 'dificil'];

// ---------- salas ----------
function criarSala() {
  const sala = {
    codigo: novoCodigo(),
    jogadores: [], // {id, nome, pontos, ws, online, acertou}
    donoId: null,
    config: { temas: ['geral'], nivel: 'misto', rodadas: 3, tempo: 80 },
    fase: 'lobby', // lobby | jogando | fimTurno | fim
    rodada: 0, ordem: [], vez: -1,
    desenhistaId: null, palavra: null, tema: null, nivel: null,
    fimEm: 0, inicioEm: 0, dicas: [], tracos: [], usadas: new Set(), trocou: false,
    timer: null, chat: [],
  };
  salas.set(sala.codigo, sala);
  return sala;
}

function enviar(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function todos(sala, msg, excetoId) { for (const j of sala.jogadores) if (j.id !== excetoId) enviar(j.ws, msg); }

function dicaMascara(sala) {
  // "_ _ _ _" com letras reveladas; espaços e hífens sempre visíveis
  return [...sala.palavra].map((ch, i) => (/[\s\-]/.test(ch) ? ch : sala.dicas.includes(i) ? ch : '_')).join('');
}

function estado(sala, paraId) {
  const desenhista = paraId === sala.desenhistaId;
  const eu = sala.jogadores.find((j) => j.id === paraId);
  const revela = desenhista || sala.fase === 'fimTurno' || sala.fase === 'fim' || (eu && eu.acertou);
  return {
    t: 'estado',
    codigo: sala.codigo, eu: paraId, donoId: sala.donoId, fase: sala.fase,
    config: sala.config, rodada: sala.rodada,
    jogadores: sala.jogadores.map((j) => ({ id: j.id, nome: j.nome, pontos: j.pontos, online: j.online, acertou: j.acertou, ganhou: j.ganhou || 0 })),
    desenhistaId: sala.desenhistaId,
    palavra: sala.palavra ? (revela ? sala.palavra : null) : null,
    dica: sala.palavra && sala.fase === 'jogando' ? dicaMascara(sala) : null,
    tema: sala.tema ? TEMAS[sala.tema].nome : null, temaIcone: sala.tema ? TEMAS[sala.tema].icone : null,
    nivel: sala.nivel, fimEm: sala.fimEm, agora: Date.now(), podeTrocar: desenhista && !sala.trocou && sala.fase === 'jogando',
  };
}
function atualizar(sala) { for (const j of sala.jogadores) enviar(j.ws, estado(sala, j.id)); }
function avisar(sala, texto, tipo = 'sistema') {
  const m = { t: 'chat', tipo, texto };
  sala.chat.push(m); if (sala.chat.length > 60) sala.chat.shift();
  todos(sala, m);
}

function sortearPalavra(sala) {
  const temas = sala.config.temas.length ? sala.config.temas : ['geral'];
  let opcoes = [];
  for (const t of temas) {
    const niveis = sala.config.nivel === 'misto' ? NIVEIS : [sala.config.nivel];
    for (const n of niveis) for (const w of TEMAS[t][n]) opcoes.push({ w, t, n });
  }
  let livres = opcoes.filter((o) => !sala.usadas.has(o.w));
  if (!livres.length) { sala.usadas.clear(); livres = opcoes; }
  const o = livres[Math.floor(Math.random() * livres.length)];
  sala.usadas.add(o.w);
  sala.palavra = o.w; sala.tema = o.t; sala.nivel = o.n; sala.dicas = [];
}

function iniciarJogo(sala) {
  for (const j of sala.jogadores) { j.pontos = 0; j.acertou = false; j.ganhou = 0; }
  sala.rodada = 1; sala.vez = -1; sala.usadas.clear();
  sala.ordem = embaralhar(sala.jogadores.filter((j) => j.online).map((j) => j.id));
  avisar(sala, '🎬 O jogo começou!');
  proximoTurno(sala);
}

function proximoTurno(sala) {
  clearTimeout(sala.timer);
  // jogadores que entraram no meio vão para o fim da fila
  for (const j of sala.jogadores) if (j.online && !sala.ordem.includes(j.id)) sala.ordem.push(j.id);
  let tentativas = 0;
  do {
    sala.vez++;
    if (sala.vez >= sala.ordem.length) { sala.vez = 0; sala.rodada++; }
    tentativas++;
  } while (tentativas <= sala.ordem.length && !sala.jogadores.find((j) => j.id === sala.ordem[sala.vez] && j.online));

  const online = sala.jogadores.filter((j) => j.online);
  if (sala.rodada > sala.config.rodadas || online.length < 2) return fimDeJogo(sala);

  sala.fase = 'jogando';
  sala.desenhistaId = sala.ordem[sala.vez];
  sala.tracos = []; sala.trocou = false;
  for (const j of sala.jogadores) { j.acertou = false; j.ganhou = 0; }
  sortearPalavra(sala);
  sala.inicioEm = Date.now();
  sala.fimEm = Date.now() + sala.config.tempo * 1000;
  todos(sala, { t: 'limpar' });
  const d = sala.jogadores.find((j) => j.id === sala.desenhistaId);
  avisar(sala, `✏️ Vez de ${d.nome} desenhar!`);
  atualizar(sala);
  agendarTick(sala);
}

function agendarTick(sala) {
  clearTimeout(sala.timer);
  sala.timer = setTimeout(() => tick(sala), 1000);
}
function tick(sala) {
  if (sala.fase !== 'jogando') return;
  const restante = sala.fimEm - Date.now();
  if (restante <= 0) return fimDoTurno(sala, '⏰ Acabou o tempo!');
  // revela letras aos poucos (até ~40% da palavra), começando na metade do tempo
  const total = sala.config.tempo * 1000;
  const letras = [...sala.palavra].map((c, i) => (/[\s\-]/.test(c) ? -1 : i)).filter((i) => i >= 0);
  const maxDicas = Math.max(0, Math.floor(letras.length * 0.4));
  const progresso = 1 - restante / total;
  const devia = progresso < 0.5 ? 0 : Math.ceil(((progresso - 0.5) / 0.5) * maxDicas);
  if (sala.dicas.length < Math.min(devia, maxDicas)) {
    const livres = letras.filter((i) => !sala.dicas.includes(i));
    sala.dicas.push(livres[Math.floor(Math.random() * livres.length)]);
    atualizar(sala);
  }
  agendarTick(sala);
}

function fimDoTurno(sala, motivo) {
  clearTimeout(sala.timer);
  if (sala.fase !== 'jogando') return;
  sala.fase = 'fimTurno';
  avisar(sala, `${motivo} A palavra era: ${sala.palavra.toUpperCase()}`, 'revela');
  atualizar(sala);
  sala.timer = setTimeout(() => proximoTurno(sala), 5000);
}

function fimDeJogo(sala) {
  clearTimeout(sala.timer);
  sala.fase = 'fim'; sala.desenhistaId = null; sala.palavra = null;
  avisar(sala, '🏁 Fim de jogo!');
  atualizar(sala);
}

function palpite(sala, j, texto) {
  if (sala.fase !== 'jogando' || j.id === sala.desenhistaId || j.acertou) {
    // conversa livre (quem já acertou só fala com quem também acertou, para não entregar)
    if (sala.fase === 'jogando' && (j.id === sala.desenhistaId || j.acertou)) {
      for (const o of sala.jogadores) if (o.acertou || o.id === sala.desenhistaId) enviar(o.ws, { t: 'chat', tipo: 'secreto', nome: j.nome, texto });
      return;
    }
    const m = { t: 'chat', tipo: 'msg', nome: j.nome, texto };
    sala.chat.push(m); if (sala.chat.length > 60) sala.chat.shift();
    return todos(sala, m);
  }
  const a = normalizar(texto), b = normalizar(sala.palavra);
  if (!a) return;
  if (a === b) {
    const acertaram = sala.jogadores.filter((x) => x.acertou).length;
    const frac = Math.max(0, (sala.fimEm - Date.now()) / (sala.config.tempo * 1000));
    const pts = Math.round(50 + 100 * frac) + Math.max(0, 30 - acertaram * 10);
    j.acertou = true; j.ganhou = pts; j.pontos += pts;
    const d = sala.jogadores.find((x) => x.id === sala.desenhistaId);
    if (d) { const bonus = sala.nivel === 'dificil' ? 40 : sala.nivel === 'medio' ? 30 : 20; d.pontos += bonus; d.ganhou = (d.ganhou || 0) + bonus; }
    avisar(sala, `🎉 ${j.nome} acertou! (+${pts})`, 'acerto');
    const faltam = sala.jogadores.filter((x) => x.online && x.id !== sala.desenhistaId && !x.acertou).length;
    if (faltam === 0) return fimDoTurno(sala, '✅ Todo mundo acertou!');
    // quando alguém acerta, o tempo restante cai (no máximo 25s) para dar ritmo
    sala.fimEm = Math.min(sala.fimEm, Date.now() + 25000);
    atualizar(sala);
    return;
  }
  const m = { t: 'chat', tipo: 'msg', nome: j.nome, texto };
  sala.chat.push(m); if (sala.chat.length > 60) sala.chat.shift();
  todos(sala, m);
  if (b.length > 3 && distancia(a, b) <= (b.length > 7 ? 2 : 1)) enviar(j.ws, { t: 'chat', tipo: 'quase', texto: `🔥 "${texto}" está quase!` });
}

function sair(sala, j, deVez = false) {
  j.online = false; j.ws = null;
  if (sala.donoId === j.id) { const n = sala.jogadores.find((x) => x.online); if (n) sala.donoId = n.id; }
  const online = sala.jogadores.filter((x) => x.online);
  if (!online.length) { // sala vazia: pausa e apaga depois de 10 minutos se ninguém voltar
    clearTimeout(sala.timer); sala.pausada = true;
    sala.lixo = setTimeout(() => { if (!sala.jogadores.some((x) => x.online)) salas.delete(sala.codigo); }, 10 * 60 * 1000);
    return;
  }
  if (sala.fase === 'lobby' || deVez) {
    if (sala.fase === 'lobby') sala.jogadores = sala.jogadores.filter((x) => x.id !== j.id);
    avisar(sala, `👋 ${j.nome} saiu.`);
    conferirSaida(sala, j);
    return;
  }
  // caiu a conexão no meio do jogo (tela bloqueada, sinal ruim): espera 10s antes de considerar que saiu
  atualizar(sala);
  clearTimeout(j.espera);
  j.espera = setTimeout(() => {
    if (j.online || !salas.has(sala.codigo)) return;
    avisar(sala, `👋 ${j.nome} saiu.`);
    conferirSaida(sala, j);
  }, 10000);
}
function conferirSaida(sala, j) {
  const online = sala.jogadores.filter((x) => x.online);
  if (sala.fase === 'jogando') {
    if (j.id === sala.desenhistaId) return fimDoTurno(sala, `✏️ ${j.nome} saiu no meio do desenho.`);
    if (online.length < 2) return fimDeJogo(sala);
    const faltam = online.filter((x) => x.id !== sala.desenhistaId && !x.acertou).length;
    if (faltam === 0) return fimDoTurno(sala, '✅ Todo mundo acertou!');
  }
  atualizar(sala);
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
wss.on('connection', (ws) => {
  let sala = null, eu = null;
  ws.vivo = true; ws.on('pong', () => (ws.vivo = true));
  enviar(ws, { t: 'temas', temas: TEMAS_PUBLICO });

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'criar' || m.t === 'entrar') {
      const nome = limpaTexto(m.nome, 16) || 'Jogador';
      if (m.t === 'criar') sala = criarSala();
      else {
        sala = salas.get(String(m.codigo || '').toUpperCase().trim());
        if (!sala) return enviar(ws, { t: 'erro', texto: 'Sala não encontrada. Confira o código.' });
      }
      clearTimeout(sala.lixo);
      for (const c of sala.chat.slice(-20)) enviar(ws, c); // histórico recente da conversa
      eu = m.id && sala.jogadores.find((j) => j.id === m.id); // reconexão
      if (eu) {
        if (eu.ws && eu.ws !== ws) try { eu.ws.close(); } catch {}
        eu.ws = ws; eu.online = true; eu.nome = nome; clearTimeout(eu.espera);
      } else {
        if (sala.jogadores.filter((j) => j.online).length >= 16) return enviar(ws, { t: 'erro', texto: 'A sala está cheia (16 jogadores).' });
        eu = { id: novoId(), nome, pontos: 0, ws, online: true, acertou: false };
        sala.jogadores.push(eu);
        avisar(sala, `🙌 ${nome} entrou na sala.`);
      }
      if (!sala.donoId || !sala.jogadores.find((j) => j.id === sala.donoId && j.online)) sala.donoId = eu.id;
      enviar(ws, { t: 'entrou', codigo: sala.codigo, id: eu.id });
      if (sala.tracos.length) enviar(ws, { t: 'tracos', tracos: sala.tracos });
      atualizar(sala);
      if (sala.pausada) { // a sala tinha ficado vazia: retoma
        sala.pausada = false;
        if (sala.fase === 'jogando') { sala.fimEm = Math.max(sala.fimEm, Date.now() + 20000); agendarTick(sala); atualizar(sala); }
        else if (sala.fase === 'fimTurno') sala.timer = setTimeout(() => proximoTurno(sala), 3000);
      }
      return;
    }
    if (!sala || !eu) return;
    const dono = eu.id === sala.donoId;
    const desenhista = eu.id === sala.desenhistaId && sala.fase === 'jogando';

    switch (m.t) {
      case 'config': {
        if (!dono || sala.fase === 'jogando') return;
        const c = m.config || {};
        const temas = Array.isArray(c.temas) ? c.temas.filter((t) => TEMAS[t]) : sala.config.temas;
        sala.config = {
          temas: temas.length ? temas : ['geral'],
          nivel: ['facil', 'medio', 'dificil', 'misto'].includes(c.nivel) ? c.nivel : sala.config.nivel,
          rodadas: Math.min(10, Math.max(1, parseInt(c.rodadas) || sala.config.rodadas)),
          tempo: [40, 60, 80, 100, 120, 150].includes(+c.tempo) ? +c.tempo : sala.config.tempo,
        };
        return atualizar(sala);
      }
      case 'iniciar':
        if (!dono || sala.fase === 'jogando' || sala.fase === 'fimTurno') return;
        if (sala.jogadores.filter((j) => j.online).length < 2) return enviar(ws, { t: 'erro', texto: 'Precisa de pelo menos 2 jogadores.' });
        return iniciarJogo(sala);
      case 'voltarLobby':
        if (!dono) return;
        clearTimeout(sala.timer); sala.fase = 'lobby'; sala.desenhistaId = null; sala.palavra = null; sala.tracos = [];
        sala.jogadores = sala.jogadores.filter((j) => j.online);
        for (const j of sala.jogadores) { j.pontos = 0; j.acertou = false; j.ganhou = 0; }
        todos(sala, { t: 'limpar' });
        return atualizar(sala);
      case 'pular': // dono pode pular o turno se travar
        if (dono && sala.fase === 'jogando') fimDoTurno(sala, '⏭️ Turno pulado.');
        return;
      case 'trocar':
        if (!desenhista || sala.trocou) return;
        sala.trocou = true; sortearPalavra(sala); sala.tracos = [];
        todos(sala, { t: 'limpar' });
        sala.fimEm = Math.max(sala.fimEm, Date.now() + Math.min(20000, sala.config.tempo * 1000));
        return atualizar(sala);
      case 'chat':
        return palpite(sala, eu, limpaTexto(m.texto, 60));
      // ---- desenho ----
      case 'traco': { // início de um traço novo
        if (!desenhista) return;
        const tr = { id: limpaTexto(m.id, 12), cor: /^#[0-9a-f]{6}$/i.test(m.cor) ? m.cor : '#000000', tam: Math.min(60, Math.max(1, +m.tam || 6)), pts: [] };
        if (sala.tracos.length > 2000) return;
        sala.tracos.push(tr);
        return todos(sala, { t: 'traco', id: tr.id, cor: tr.cor, tam: tr.tam }, eu.id);
      }
      case 'pts': {
        if (!desenhista || !Array.isArray(m.pts)) return;
        const tr = sala.tracos[sala.tracos.length - 1]; if (!tr || tr.id !== m.id) return;
        const pts = m.pts.slice(0, 400).filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
        if (tr.pts.length > 5000) return;
        tr.pts.push(...pts);
        return todos(sala, { t: 'pts', id: tr.id, pts }, eu.id);
      }
      case 'desfazer':
        if (!desenhista) return; sala.tracos.pop(); return todos(sala, { t: 'tracos', tracos: sala.tracos }, eu.id);
      case 'limpar':
        if (!desenhista) return; sala.tracos = []; return todos(sala, { t: 'limpar' }, eu.id);
      case 'sair':
        sair(sala, eu, true); sala = null; eu = null; return;
    }
  });

  ws.on('close', () => { if (sala && eu && eu.ws === ws) sair(sala, eu); });
});

// derruba conexões mortas (celular que bloqueou a tela etc.)
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.vivo) { ws.terminate(); continue; } ws.vivo = false; try { ws.ping(); } catch {} }
}, 20000);

server.listen(PORT, () => {
  const ips = Object.values(require('os').networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\n✏️  Rabisca Aí! rodando na porta ${PORT}`);
  console.log(`   Neste computador:  http://localhost:${PORT}`);
  for (const ip of ips) console.log(`   No celular (mesmo Wi-Fi):  http://${ip}:${PORT}`);
  console.log('');
});
