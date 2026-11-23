# ✏️ Rabisca Aí!

Jogo de desenhar e adivinhar pelo celular, em tempo real.
Um jogador cria a sala e recebe um **código de 4 letras**. Os outros entram com o código (ou pelo link/QR code).
Na sua vez, você recebe uma palavra sorteada e desenha; o desenho aparece ao vivo nos outros celulares, que chutam pelo chat.

## Como funciona
- **Temas:** Geral, Futebol, Internet, Animais, Comidas, Profissões, Esportes, Casa e Objetos, Brasil (pode marcar vários).
- **Níveis:** Fácil, Médio, Difícil ou Misturado.
- **Rodadas** (1 a 10) e **tempo por desenho** (40 s a 150 s), escolhidos por quem criou a sala.
- **Pontos:** quem acerta mais rápido ganha mais; quem desenha ganha um bônus por cada pessoa que acerta (maior em palavras difíceis).
- Aceita palpite sem acento e com maiúscula/minúscula; avisa "🔥 está quase!" quando erra por pouco.
- Dicas: na segunda metade do tempo, algumas letras vão aparecendo.
- Quem desenha pode **trocar a palavra uma vez** por turno 🔄, usar borracha, desfazer e limpar.
- Se o celular bloquear a tela ou cair a internet, ao voltar a pessoa continua com os mesmos pontos.

## Rodar no seu computador (jogar com celulares no mesmo Wi-Fi)
1. Instale o Node.js (versão 18 ou mais nova): https://nodejs.org
2. Abra o terminal nesta pasta e rode:
   ```
   npm install
   npm start
   ```
3. O terminal mostra um endereço tipo `http://192.168.0.15:3000`. Abra esse endereço nos celulares (todos no mesmo Wi-Fi do computador).

## Publicar na internet de graça (jogar de qualquer lugar)
Funciona em qualquer serviço que rode Node com WebSocket. O mais simples é o **Render**:
1. Crie um repositório no GitHub e suba esta pasta (sem a `node_modules`).
2. Em https://render.com → New → **Web Service** → escolha o repositório.
3. Build command: `npm install` · Start command: `npm start` · Plano: Free.
4. Pronto: o Render dá um link `https://....onrender.com` para mandar para a galera.

No plano grátis o servidor "dorme" depois de 15 min sem uso; o primeiro acesso depois disso demora uns 30 a 50 segundos para acordar.

## Adicionar ou mudar palavras
Edite `palavras.js`. Cada tema tem três listas (`facil`, `medio`, `dificil`) com palavras separadas por vírgula. Para criar um tema novo, copie um bloco existente e mude o nome e o ícone.

## Arquivos
- `server.js` – servidor (salas, turnos, pontos, repassa o desenho)
- `palavras.js` – listas de palavras
- `public/index.html` – a tela do jogo (celular e computador)
