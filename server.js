// Rabisca Aí! — servidor do jogo de desenhar e adivinhar (chute ao vivo)
// Um celular desenha; os outros mostram o desenho para a galera chutar em voz alta.
// Quando alguém acerta, quem está com o celular que mostra toca em "Acertei" e vem a próxima palavra.
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
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch { url = '/'; }
  if (url === '/saude') { res.writeHead(200); return res.end('ok'); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) {
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
const salas = new Map();
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const novoCodigo = () => {
  let c;
  do { c = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join(''); } while (salas.has(c));
  return c;
};
const novoId = () => Math.random().toString(36).slice(2, 10);
const TEMAS_PUBLICO = Object.entries(TEMAS).map(([id, t]) => ({ id, nome: t.nome, icone: t.icone }));
const NIVEIS = ['facil', 'medio', 'dificil'];
const EQUIPES = ['Time Roxo', 'Time Rosa', 'Time Amarelo', 'Time Verde'];

function criarSala() {
  const sala = {
    codigo: novoCodigo(),
    aparelhos: [], // {id, ws, online}
    donoId: null,
    config: { temas: ['geral'], nivel: 'misto', rodadas: 3, tempo: 90, porVez: 3, equipes: 2 },
    fase: 'lobby', // lobby | preparar | desenhando | resultado | fim
    rodada: 1, vez: 0, pontos: [0, 0],
    desenhistaId: null, palavras: [], idx: 0, resultados: [],
    fimEm: 0, tracos: [], usadas: new Set(), timer: null,
  };
  salas.set(sala.codigo, sala);
  return sala;
}

function enviar(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function todos(sala, msg, excetoId) { for (const a of sala.aparelhos) if (a.id !== excetoId) enviar(a.ws, msg); }

function palavraInfo(p) { return p ? { palavra: p.w, tema: TEMAS[p.t].nome, icone: TEMAS[p.t].icone, nivel: p.n } : null; }

function estado(sala, paraId) {
  const desenhista = paraId === sala.desenhistaId;
  const atual = sala.palavras[sala.idx];
  return {
    t: 'estado',
    codigo: sala.codigo, eu: paraId, donoId: sala.donoId, fase: sala.fase,
    config: sala.config, rodada: sala.rodada, vez: sala.vez, pontos: sala.pontos,
    equipes: EQUIPES.slice(0, sala.config.equipes),
    aparelhos: sala.aparelhos.filter((a) => a.online).length,
    desenhistaId: sala.desenhistaId,
    souDesenhista: desenhista,
    idx: sala.idx, total: sala.palavras.length,
    // só quem desenha vê a palavra da vez; no resultado todo mundo vê todas
    atual: sala.fase === 'desenhando' && desenhista ? palavraInfo(atual) : null,
    temaAtual: sala.fase === 'desenhando' && atual ? { tema: TEMAS[atual.t].nome, icone: TEMAS[atual.t].icone } : null,
    resultados: sala.fase === 'resultado' ? sala.palavras.map((p, i) => ({ ...palavraInfo(p), acertou: sala.resultados[i] === true })) : [],
    fimEm: sala.fimEm, agora: Date.now(),
  };
}
function atualizar(sala) { for (const a of sala.aparelhos) enviar(a.ws, estado(sala, a.id)); }

function sortearPalavras(sala, n) {
  const opcoes = [];
  for (const t of sala.config.temas) {
    const niveis = sala.config.nivel === 'misto' ? NIVEIS : [sala.config.nivel];
    for (const nv of niveis) for (const w of TEMAS[t][nv]) opcoes.push({ w, t, n: nv });
  }
  const escolhidas = [];
  for (let k = 0; k < n; k++) {
    let livres = opcoes.filter((o) => !sala.usadas.has(o.w) && !escolhidas.includes(o));
    if (!livres.length) { sala.usadas.clear(); livres = opcoes.filter((o) => !escolhidas.includes(o)); }
    const o = livres[Math.floor(Math.random() * livres.length)];
    sala.usadas.add(o.w); escolhidas.push(o);
  }
  return escolhidas;
}

function iniciarJogo(sala) {
  clearTimeout(sala.timer);
  sala.rodada = 1; sala.vez = 0; sala.pontos = Array(sala.config.equipes).fill(0);
  sala.usadas.clear(); sala.desenhistaId = null; sala.palavras = []; sala.resultados = [];
  sala.fase = 'preparar';
  atualizar(sala);
}

function comecarVez(sala, desenhistaId) {
  clearTimeout(sala.timer);
  sala.desenhistaId = desenhistaId;
  sala.palavras = sortearPalavras(sala, sala.config.porVez);
  sala.resultados = []; sala.idx = 0; sala.tracos = [];
  sala.fase = 'desenhando';
  sala.fimEm = Date.now() + sala.config.tempo * 1000;
  sala.timer = setTimeout(() => fimDaVez(sala), sala.config.tempo * 1000 + 300);
  todos(sala, { t: 'limpar' });
  atualizar(sala);
}

function proximaPalavra(sala, acertou) {
  // ignora toques repetidos (dois celulares apertando quase juntos)
  if (Date.now() - (sala.ultimaTroca || 0) < 1000) return;
  sala.ultimaTroca = Date.now();
  sala.resultados[sala.idx] = acertou;
  if (acertou) sala.pontos[sala.vez] += 1;
  todos(sala, { t: acertou ? 'acerto' : 'pulou' });
  sala.idx++;
  sala.tracos = [];
  todos(sala, { t: 'limpar' });
  if (sala.idx >= sala.palavras.length) return fimDaVez(sala);
  atualizar(sala);
}

function fimDaVez(sala) {
  clearTimeout(sala.timer);
  if (sala.fase !== 'desenhando') return;
  sala.fase = 'resultado';
  atualizar(sala);
}

function continuar(sala) {
  if (sala.fase !== 'resultado') return;
  sala.desenhistaId = null; sala.palavras = []; sala.resultados = []; sala.tracos = [];
  todos(sala, { t: 'limpar' });
  sala.vez++;
  if (sala.vez >= sala.config.equipes) { sala.vez = 0; sala.rodada++; }
  sala.fase = sala.rodada > sala.config.rodadas ? 'fim' : 'preparar';
  atualizar(sala);
}

function saiu(sala, a) {
  a.online = false; a.ws = null;
  if (sala.donoId === a.id) { const n = sala.aparelhos.find((x) => x.online); if (n) sala.donoId = n.id; }
  if (!sala.aparelhos.some((x) => x.online)) {
    clearTimeout(sala.timer); sala.pausada = true;
    sala.lixo = setTimeout(() => { if (!sala.aparelhos.some((x) => x.online)) salas.delete(sala.codigo); }, 15 * 60 * 1000);
    return;
  }
  // quem desenhava caiu: espera 15s para voltar; senão a vez recomeça
  if (sala.fase === 'desenhando' && sala.desenhistaId === a.id) {
    clearTimeout(a.espera);
    a.espera = setTimeout(() => {
      if (a.online || sala.fase !== 'desenhando' || sala.desenhistaId !== a.id) return;
      clearTimeout(sala.timer);
      sala.fase = 'preparar'; sala.desenhistaId = null; sala.palavras = []; sala.tracos = [];
      todos(sala, { t: 'limpar' });
      atualizar(sala);
    }, 15000);
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
      if (m.t === 'criar') sala = criarSala();
      else {
        sala = salas.get(String(m.codigo || '').toUpperCase().trim());
        if (!sala) return enviar(ws, { t: 'erro', texto: 'Sala não encontrada. Confira o código.' });
      }
      clearTimeout(sala.lixo);
      eu = m.id && sala.aparelhos.find((a) => a.id === m.id); // reconexão
      if (eu) {
        if (eu.ws && eu.ws !== ws) try { eu.ws.close(); } catch {}
        eu.ws = ws; eu.online = true; clearTimeout(eu.espera);
      } else {
        if (sala.aparelhos.filter((a) => a.online).length >= 30) return enviar(ws, { t: 'erro', texto: 'A sala está cheia.' });
        eu = { id: novoId(), ws, online: true };
        sala.aparelhos.push(eu);
      }
      if (!sala.donoId || !sala.aparelhos.find((a) => a.id === sala.donoId && a.online)) sala.donoId = eu.id;
      enviar(ws, { t: 'entrou', codigo: sala.codigo, id: eu.id });
      if (sala.tracos.length) enviar(ws, { t: 'tracos', tracos: sala.tracos });
      if (sala.pausada) {
        sala.pausada = false;
        if (sala.fase === 'desenhando') { sala.fimEm = Math.max(sala.fimEm, Date.now() + 15000); sala.timer = setTimeout(() => fimDaVez(sala), sala.fimEm - Date.now() + 300); }
      }
      atualizar(sala);
      return;
    }
    if (!sala || !eu) return;
    const dono = eu.id === sala.donoId;
    const desenhista = eu.id === sala.desenhistaId && sala.fase === 'desenhando';

    switch (m.t) {
      case 'config': {
        if (!dono || sala.fase !== 'lobby') return;
        const c = m.config || {};
        const temas = Array.isArray(c.temas) ? c.temas.filter((t) => TEMAS[t]) : sala.config.temas;
        const lim = (v, a, b, d) => { const n = parseInt(v); return isNaN(n) ? d : Math.min(b, Math.max(a, n)); };
        sala.config = {
          temas: temas.length ? temas : ['geral'],
          nivel: ['facil', 'medio', 'dificil', 'misto'].includes(c.nivel) ? c.nivel : sala.config.nivel,
          rodadas: lim(c.rodadas, 1, 10, sala.config.rodadas),
          tempo: [60, 90, 120, 150, 180].includes(+c.tempo) ? +c.tempo : sala.config.tempo,
          porVez: lim(c.porVez, 1, 6, sala.config.porVez),
          equipes: lim(c.equipes, 1, 4, sala.config.equipes),
        };
        return atualizar(sala);
      }
      case 'iniciar':
        if (!dono || (sala.fase !== 'lobby' && sala.fase !== 'fim')) return;
        return iniciarJogo(sala);
      case 'voltarLobby':
        if (!dono) return;
        clearTimeout(sala.timer); sala.fase = 'lobby'; sala.desenhistaId = null; sala.palavras = []; sala.tracos = [];
        todos(sala, { t: 'limpar' });
        return atualizar(sala);
      case 'vouDesenhar': // o primeiro celular que tocar vira o desenhista da vez
        if (sala.fase !== 'preparar') return;
        return comecarVez(sala, eu.id);
      case 'acertei': // vem do celular que mostra o desenho
        if (sala.fase !== 'desenhando' || eu.id === sala.desenhistaId || m.idx !== sala.idx) return;
        return proximaPalavra(sala, true);
      case 'pular':
        if (sala.fase !== 'desenhando' || m.idx !== sala.idx) return;
        return proximaPalavra(sala, false);
      case 'encerrarVez':
        if (sala.fase === 'desenhando' && (desenhista || dono)) fimDaVez(sala);
        return;
      case 'continuar':
        return continuar(sala);
      // ---- desenho ----
      case 'traco': {
        if (!desenhista || sala.tracos.length > 2000) return;
        const tr = { id: String(m.id || '').slice(0, 12), cor: /^#[0-9a-f]{6}$/i.test(m.cor) ? m.cor : '#000000', tam: Math.min(60, Math.max(1, +m.tam || 6)), pts: [] };
        sala.tracos.push(tr);
        return todos(sala, { t: 'traco', id: tr.id, cor: tr.cor, tam: tr.tam }, eu.id);
      }
      case 'pts': {
        if (!desenhista || !Array.isArray(m.pts)) return;
        const tr = sala.tracos[sala.tracos.length - 1]; if (!tr || tr.id !== m.id || tr.pts.length > 5000) return;
        const pts = m.pts.slice(0, 400).filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
        tr.pts.push(...pts);
        return todos(sala, { t: 'pts', id: tr.id, pts }, eu.id);
      }
      case 'desfazer':
        if (!desenhista) return; sala.tracos.pop(); return todos(sala, { t: 'tracos', tracos: sala.tracos }, eu.id);
      case 'limpar':
        if (!desenhista) return; sala.tracos = []; return todos(sala, { t: 'limpar' }, eu.id);
      case 'sair':
        eu.ws = null; saiu(sala, eu); sala = null; eu = null; return;
    }
  });

  ws.on('close', () => { if (sala && eu && eu.ws === ws) saiu(sala, eu); });
});

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
