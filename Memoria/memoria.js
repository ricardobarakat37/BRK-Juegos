// ============================================================
// MÓDULO DE JUEGO: MEMORIA
// Todo lo específico de memoria vive aquí. El núcleo (core/rooms.js)
// no sabe qué es una carta ni una pareja — solo llama a las
// funciones de esta interfaz (la misma que usa sudoku.js).
// ============================================================

var GAME_NAME = 'Memoria Battle - BRK Arte';
var STATUS_VERSION = '1.0';
var PROTOCOL_VERSION = '1.0';

// Emojis curados: familiares, distinguibles entre sí a simple vista
// incluso en pantallas chicas. 32 símbolos alcanza para el tablero
// más difícil (8x8 = 32 parejas).
var SIMBOLOS = [
  '🎨','🎭','🎪','🎡','🎢','🎳','🎯','🎮',
  '🎲','🎸','🎹','🎺','🥁','🎷','🎬','📷',
  '🎧','🎤','🏆','⚽','🏀','🏈','⚾','🎾',
  '🍕','🍔','🌮','🍩','🍦','🎂','🌈','⭐'
];

// Dificultad -> número de parejas (tablero = parejas * 2 celdas)
var DIFICULTADES = { facil: 8, medio: 18, dificil: 32 };

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Genera el mazo: un array de símbolos (cada uno repetido 2 veces), barajado.
function generarMazo(dificultad) {
  var parejas = DIFICULTADES[dificultad] || DIFICULTADES.medio;
  var simbolosUsados = SIMBOLOS.slice(0, parejas);
  var mazo = [];
  for (var i = 0; i < simbolosUsados.length; i++) {
    mazo.push(simbolosUsados[i]);
    mazo.push(simbolosUsados[i]);
  }
  return { mazo: shuffle(mazo), totalParejas: parejas };
}

// ============================================================
// INTERFAZ QUE EL NÚCLEO CONSUME
// ============================================================

function normalizeDifficulty(d) {
  return DIFICULTADES[d] ? d : 'medio';
}

function isValidDifficulty(d) {
  return !!DIFICULTADES[d];
}

function sanitizeOptions(o) {
  // v1: sin opciones configurables todavía (se puede ampliar después,
  // por ejemplo "mostrar cuántos intentos fallidos").
  return {};
}

// Se llama al iniciar la partida. Genera el mazo compartido y el
// "board" (parejas encontradas) de cada entidad, arrancando en 0.
function setupGame(room) {
  var gen = generarMazo(room.difficulty);

  room.gameState = {
    deck: gen.mazo,
    totalCells: gen.mazo.length,
    totalPairs: gen.totalParejas
  };

  var boardVacio = function () {
    var b = [];
    for (var i = 0; i < gen.mazo.length; i++) b.push(0);
    return b;
  };

  if (room.mode === 'equipos') {
    room.teams = {
      A: { board: boardVacio(), progress: 0, errors: 0, eliminated: false, finished: false, finishedAt: 0, pendingFlip: null },
      B: { board: boardVacio(), progress: 0, errors: 0, eliminated: false, finished: false, finishedAt: 0, pendingFlip: null }
    };
  } else {
    for (var pid in room.players) {
      room.players[pid].board = boardVacio();
      room.players[pid].pendingFlip = null;
    }
  }
}

// Campos extra del mensaje 'game' (arranque) y del snapshot de 'resume'.
// OJO: nunca mandamos el mazo (room.gameState.deck) al cliente — eso
// revelaría todas las parejas de una. Solo el tamaño del tablero.
function gameStartPayload(room) {
  return {
    totalCells: room.gameState.totalCells,
    totalPairs: room.gameState.totalPairs
  };
}

function resumeGameFields(room) {
  return gameStartPayload(room);
}

// Valida y aplica una jugada: voltear una carta.
// entity = el equipo (modo equipos) o el jugador (modo individual).
// player = siempre el jugador real que mandó el mensaje.
function applyMove(room, player, entity, msg) {
  var index = parseInt(msg.index, 10);
  if (isNaN(index) || index < 0 || index >= room.gameState.totalCells) return null;
  if (entity.board[index] !== 0) return null; // ya emparejada, ignorar

  var esEquipos = room.mode === 'equipos';

  // ---- Primera carta del intento ----
  if (entity.pendingFlip === null || entity.pendingFlip === undefined) {
    entity.pendingFlip = index;
    var valor1 = room.gameState.deck[index];
    var broadcastExtra1 = esEquipos ? {
      type: 'team_flip', team: player.team, stage: 'first',
      index: index, value: valor1, by: player.name
    } : null;
    return {
      response: { type: 'move_result', stage: 'first', index: index, value: valor1 },
      broadcastExtra: broadcastExtra1
    };
  }

  // Volvió a tocar la misma carta que ya tenía volteada: ignorar
  if (entity.pendingFlip === index) return null;

  // ---- Segunda carta del intento ----
  var primerIndex = entity.pendingFlip;
  entity.pendingFlip = null;
  var valorPrimero = room.gameState.deck[primerIndex];
  var valorSegundo = room.gameState.deck[index];
  var esPareja = valorPrimero === valorSegundo;

  if (esPareja) {
    entity.board[primerIndex] = valorPrimero;
    entity.board[index] = valorSegundo;
    var encontradas = 0;
    for (var i = 0; i < entity.board.length; i++) {
      if (entity.board[i] !== 0) encontradas++;
    }
    var parejasEncontradas = encontradas / 2;
    entity.progress = Math.round((parejasEncontradas / room.gameState.totalPairs) * 100);
    if (parejasEncontradas === room.gameState.totalPairs) {
      entity.finished = true;
      entity.finishedAt = Date.now();
      entity.netTime = Date.now() - room.startedAt - room.pausedMs;
    }
  } else {
    entity.errors = (entity.errors || 0) + 1;
    // Sin eliminación: en memoria equivocarse es parte normal del juego.
  }

  var broadcastExtra2 = esEquipos ? {
    type: 'team_flip', team: player.team, stage: 'second',
    index: index, firstIndex: primerIndex,
    value: valorSegundo, firstValue: valorPrimero,
    matched: esPareja, by: player.name
  } : null;

  return {
    response: {
      type: 'move_result', stage: 'second',
      index: index, firstIndex: primerIndex,
      value: valorSegundo, firstValue: valorPrimero,
      matched: esPareja,
      progress: entity.progress, errors: entity.errors, finished: entity.finished
    },
    broadcastExtra: broadcastExtra2
  };
}

module.exports = {
  id: 'memoria',
  name: GAME_NAME,
  statusVersion: STATUS_VERSION,
  protocolVersion: PROTOCOL_VERSION,
  normalizeDifficulty: normalizeDifficulty,
  isValidDifficulty: isValidDifficulty,
  sanitizeOptions: sanitizeOptions,
  setupGame: setupGame,
  gameStartPayload: gameStartPayload,
  resumeGameFields: resumeGameFields,
  applyMove: applyMove
};
