// Listas de palavras por tema e nível.
// Para adicionar palavras, basta incluir na lista certa (separadas por vírgula).
const L = (s) => s.split(',').map((w) => w.trim()).filter(Boolean);

module.exports = {
  geral: {
    nome: 'Geral',
    icone: '🎲',
    facil: L('casa, sol, lua, árvore, carro, bola, gato, cachorro, flor, peixe, chapéu, óculos, livro, cadeira, mesa, porta, chave, relógio, copo, avião, barco, bicicleta, estrela, nuvem, chuva, coração, maçã, banana, sapato, guarda-chuva, ovo, pizza, sorvete, bolo, cama, telefone, televisão, escada, janela, ponte'),
    medio: L('vulcão, farol, castelo, foguete, sereia, dinossauro, robô, pirata, fantasma, arco-íris, tartaruga, girafa, esqueleto, ampulheta, bússola, cacto, iglu, moinho, tesouro, mágico, astronauta, espantalho, paraquedas, submarino, unicórnio, dragão, boneco de neve, fogueira, piquenique, acampamento'),
    dificil: L('saudade, preguiça, gravidade, eco, sonâmbulo, déjà vu, eclipse, miragem, terremoto, inflação, democracia, ressaca, ciúme, nostalgia, reflexo, tédio, sorte, liberdade, pesadelo, sombra, inverno, fuso horário, aposentadoria, gagueira, soluço, insônia, procrastinar, vertigem, arrepio, cócegas'),
  },
  futebol: {
    nome: 'Futebol',
    icone: '⚽',
    facil: L('bola, gol, trave, chuteira, goleiro, juiz, apito, torcida, camisa, campo, rede, troféu, medalha, estádio, uniforme, meião, caneleira, bandeira, placar, técnico'),
    medio: L('escanteio, pênalti, cartão vermelho, cartão amarelo, bicicleta, cabeçada, falta, barreira, gandula, banco de reservas, artilheiro, capitão, impedimento, vestiário, embaixadinha, carrinho, lateral, tiro de meta, hino, mascote'),
    dificil: L('VAR, gol contra, prorrogação, disputa de pênaltis, chapéu, caneta, pedalada, olímpico, rebaixamento, final de campeonato, zagueiro, cavadinha, catimba, torcedor fanático, contra-ataque, linha de impedimento, acréscimos, retranca, peixinho, gol de placa'),
  },
  internet: {
    nome: 'Internet',
    icone: '📱',
    facil: L('celular, computador, email, senha, foto, vídeo, curtir, selfie, teclado, mouse, fone de ouvido, carregador, bateria, câmera, mensagem, tela, notebook, tablet, wi-fi, site'),
    medio: L('meme, hashtag, influenciador, live, emoji, download, nuvem, spam, print, story, figurinha, áudio, seguidor, vírus, senha errada, notificação, joinha, chamada de vídeo, grupo da família, bateria fraca'),
    dificil: L('algoritmo, cancelamento, viralizar, golpe, streaming, captcha, cookie, fake news, unboxing, podcast, sem sinal, modo avião, tela azul, inteligência artificial, hacker, criptomoeda, textão, visualizou e não respondeu, trending, desinstalar'),
  },
  animais: {
    nome: 'Animais',
    icone: '🐾',
    facil: L('gato, cachorro, peixe, pássaro, vaca, cavalo, porco, galinha, pato, coelho, leão, elefante, macaco, cobra, sapo, abelha, borboleta, aranha, rato, urso'),
    medio: L('girafa, zebra, jacaré, tubarão, polvo, pinguim, coruja, tartaruga, camaleão, canguru, morcego, lagosta, caranguejo, golfinho, baleia, papagaio, tucano, onça, preguiça, joaninha'),
    dificil: L('ornitorrinco, tamanduá, capivara, cavalo-marinho, água-viva, louva-a-deus, vagalume, mico-leão-dourado, bicho-preguiça, arara, quati, axolote, flamingo, pavão, porco-espinho, lhama, hiena, castor, toupeira, avestruz'),
  },
  comidas: {
    nome: 'Comidas',
    icone: '🍔',
    facil: L('pizza, hambúrguer, banana, maçã, ovo, pão, sorvete, bolo, uva, melancia, cenoura, queijo, pipoca, laranja, morango, batata frita, cachorro-quente, leite, café, chocolate'),
    medio: L('brigadeiro, coxinha, pastel, pão de queijo, feijoada, churrasco, macarrão, sushi, panqueca, tapioca, açaí, milho, abacaxi, coco, picolé, salada, sanduíche, rosquinha, espetinho, pudim'),
    dificil: L('acarajé, moqueca, cuscuz, quindim, pamonha, vatapá, farofa, caldo de cana, bolo de rolo, arroz carreteiro, pé de moleque, cocada, baião de dois, tacacá, escondidinho, strogonoff, fondue, lasanha, empada, paçoca'),
  },
  profissoes: {
    nome: 'Profissões',
    icone: '👷',
    facil: L('médico, professor, bombeiro, policial, cozinheiro, pintor, cantor, dentista, motorista, padeiro, carteiro, piloto, palhaço, fazendeiro, pescador'),
    medio: L('astronauta, mecânico, enfermeiro, jardineiro, fotógrafo, veterinário, cabeleireiro, garçom, eletricista, encanador, salva-vidas, mágico, detetive, juiz, marinheiro'),
    dificil: L('arqueólogo, advogado, arquiteto, psicólogo, cientista, engenheiro, jornalista, maquiador, entregador de aplicativo, youtuber, programador, dublador, astrônomo, sommelier, barista'),
  },
  esportes: {
    nome: 'Esportes',
    icone: '🏀',
    facil: L('basquete, vôlei, natação, corrida, tênis, ciclismo, skate, boxe, judô, surfe, pipa, pular corda, xadrez, golfe, patins'),
    medio: L('handebol, ginástica, maratona, salto em altura, levantamento de peso, karatê, escalada, esqui, canoagem, hipismo, arco e flecha, boliche, sinuca, pingue-pongue, beisebol'),
    dificil: L('esgrima, polo aquático, salto com vara, nado sincronizado, curling, triatlo, capoeira, paraquedismo, rapel, decatlo, rugby, badminton, bobsled, parkour, frescobol'),
  },
  casa: {
    nome: 'Casa e Objetos',
    icone: '🏠',
    facil: L('cama, sofá, geladeira, fogão, mesa, cadeira, lâmpada, chuveiro, vassoura, travesseiro, espelho, janela, porta, tapete, panela'),
    medio: L('liquidificador, ventilador, controle remoto, micro-ondas, máquina de lavar, ferro de passar, escova de dente, varal, ralador, cabide, despertador, abajur, rede de dormir, cortina, torradeira'),
    dificil: L('aspirador de pó, panela de pressão, extintor, campainha, interfone, ventilador de teto, filtro de barro, tábua de passar, desentupidor, mangueira, prendedor de roupa, saca-rolhas, porta-retrato, persiana, chaleira'),
  },
  brasil: {
    nome: 'Brasil',
    icone: '🇧🇷',
    facil: L('praia, carnaval, samba, coqueiro, bandeira, futebol, caipirinha, havaiana, pandeiro, rede, papagaio, arara, chinelo, sol, cristo'),
    medio: L('pão de açúcar, Amazônia, festa junina, quadrilha, bumba meu boi, frevo, cordel, berimbau, saci, jangada, cuia de chimarrão, fogos de ano novo, bloco de rua, pipoqueiro, vendedor de praia'),
    dificil: L('curupira, mula sem cabeça, boto cor-de-rosa, iara, Lençóis Maranhenses, pororoca, Cataratas do Iguaçu, Pantanal, Bonde de Santa Teresa, Lavagem do Bonfim, Círio de Nazaré, Parintins, tropeiro, cangaceiro, jagunço'),
  },
};
