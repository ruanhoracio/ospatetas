# Ospatetas

Jogo de briga com bonecos molengas no navegador, online. Agarre, soque e jogue
os outros pra fora do mapa: o último em pé vence a rodada.

## Rodar no seu computador

Precisa do Node.js 18 ou mais novo.

```
npm install
npm start
```

Abra http://localhost:3000. Para jogar com amigos na mesma rede, eles abrem
`http://SEU-IP:3000/?sala=CODIGO`.

## Colocar online (Render.com)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ruanhoracio/ospatetas)

Clique no botão acima, ou faça manualmente:

1. Suba esta pasta num repositório do GitHub.
2. No Render: New > Web Service > escolha o repositório.
3. Build command: `npm install` · Start command: `npm start`.
4. Pronto: mande o link `https://seu-jogo.onrender.com/?sala=CODIGO` pros amigos.

Funciona igual em Railway, Fly.io ou qualquer serviço que rode Node com WebSocket.

## Como funciona

- `server.js`: servidor Express + WebSocket. Cada sala roda a física a 60 passos/s
  e manda o estado pros jogadores 30 vezes/s.
- `shared/game.js`: a simulação (bonecos ragdoll com cannon-es, regras, bots).
  O mesmo código roda no servidor e no navegador (modo treino).
- `shared/maps.js`: os 5 mapas (Telhado, Metrô, Moedor, Vigas, Roda Gigante).
- `public/`: abertura, lobby, visual 3D (Three.js), controles e sons.

## Controles

- Andar: WASD ou setas · Pular: Espaço
- Soco: J ou clique esquerdo
- Agarrar: segure K ou clique direito
- Levantar: segure L ou Shift; solte o agarrar para arremessar
- Chat: Enter
- No celular aparecem joystick e botões na tela.
