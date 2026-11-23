# ✏️ Rabisca Aí!

Jogo de desenhar e adivinhar para jogar **pessoalmente**, usando os celulares.
Um celular desenha; o outro mostra o desenho ao vivo para a galera chutar **em voz alta**.

## Como se joga
1. Um celular toca em **Criar sala** e recebe um código de 4 letras. O outro celular entra com o código (ou pelo link/QR code).
2. Quem criou a sala escolhe temas, nível, tempo, palavras por vez, número de times e rodadas, e toca em **Começar**.
3. Na vez de cada time, quem vai desenhar toca em **✏️ Vou desenhar** no próprio celular. Ele recebe a primeira palavra.
4. O outro celular mostra o desenho em tempo real. A galera do time chuta em voz alta.
5. Acertaram? Quem está com o celular que mostra toca em **✅ Acertei!**: o celular de quem desenha recebe a próxima palavra e o quadro limpa.
6. Padrão: **3 palavras em 1:30**. A vez acaba quando as 3 saem ou o tempo zera. Cada acerto vale 1 ponto para o time.
7. Dá para **Pular** uma palavra (nos dois celulares). Ela conta como erro.

**Temas:** Geral, Futebol, Internet, Animais, Comidas, Profissões, Esportes, Casa e Objetos, Brasil (pode marcar vários).
**Níveis:** Fácil, Médio, Difícil ou Misturado. **Times:** 1 a 4.

Se a tela bloquear ou a internet cair, o celular volta para a mesma partida sozinho.

## Rodar no seu computador (celulares no mesmo Wi-Fi)
1. Instale o Node.js 18 ou mais novo: https://nodejs.org
2. Nesta pasta, rode `npm install` e depois `npm start`.
3. O terminal mostra um endereço tipo `http://192.168.0.15:3000`. Abra nos celulares.

## Publicar no Render (grátis)
Se este repositório já está ligado a um serviço no Render, cada envio para o `main` publica sozinho.
Para criar do zero: https://render.com → **New** → **Web Service** → escolha o repositório → Build `npm install` · Start `npm start` · Plano **Free**.
No plano grátis o servidor "dorme" depois de 15 min sem uso; o primeiro acesso depois disso demora uns 30 a 50 segundos.

## Adicionar ou mudar palavras
Edite `palavras.js`. Cada tema tem três listas (`facil`, `medio`, `dificil`) com palavras separadas por vírgula.

## Arquivos
- `server.js` – servidor (salas, vez de cada time, pontos, repassa o desenho)
- `palavras.js` – listas de palavras
- `public/index.html` – a tela do jogo
