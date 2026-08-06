// ============================================================
// MÓDULO DE JUEGO: SUDOKU
// Todo lo específico de sudoku vive aquí. El núcleo (core/rooms.js)
// no sabe qué es una celda, una fila o una columna — solo llama
// a las funciones de esta interfaz.
// ============================================================

// --- Identidad del juego (usado por el núcleo en la ruta de estado y en los mensajes) ---
var GAME_NAME = 'Sudoku Battle - BRK Arte';
var STATUS_VERSION = '1.3.1-pausa';
var PROTOCOL_VERSION = '1.3';

// ============================================================
// GENERADOR DE SUDOKU (con solución única garantizada)
// ============================================================

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function isValid(board, index, value) {
  var row = Math.floor(index / 9);
  var col = index % 9;
  for (var i = 0; i < 9; i++) {
    if (board[row * 9 + i] === value && (row * 9 + i) !== index) return false;
    if (board[i * 9 + col] === value && (i * 9 + col) !== index) return false;
  }
  var boxRow = Math.floor(row / 3) * 3;
  var boxCol = Math.floor(col / 3) * 3;
  for (var r = boxRow; r < boxRow + 3; r++) {
    for (var c = boxCol; c < boxCol + 3; c++) {
      var idx = r * 9 + c;
      if (board[idx] === value && idx !== index) return false;
    }
  }
  return true;
}

// Llena el tablero completo con backtracking
function fillBoard(board) {
  for (var i = 0; i < 81; i++) {
    if (board[i] === 0) {
      var nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (var n = 0; n < 9; n++) {
        if (isValid(board, i, nums[n])) {
          board[i] = nums[n];
          if (fillBoard(board)) return true;
          board[i] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

// Cuenta soluciones (se detiene en 2) para garantizar unicidad
function countSolutions(board, limit) {
  for (var i = 0; i < 81; i++) {
    if (board[i] === 0) {
      var total = 0;
      for (var v = 1; v <= 9; v++) {
        if (isValid(board, i, v)) {
          board[i] = v;
          total += countSolutions(board, limit - total);
          board[i] = 0;
          if (total >= limit) return total;
        }
      }
      return total;
    }
  }
  return 1;
}

// Genera puzzle segun dificultad: celdas visibles (pistas)
var DIFFICULTY_CLUES = { facil: 40, medio: 32, dificil: 26, experto: 22 };

function generatePuzzle(difficulty) {
  var clues = DIFFICULTY_CLUES[difficulty] || DIFFICULTY_CLUES.medio;
  var solution = [];
  for (var i = 0; i < 81; i++) solution.push(0);
  fillBoard(solution);

  var puzzle = solution.slice();
  var positions = [];
  for (var p = 0; p < 81; p++) positions.push(p);
  positions = shuffle(positions);

  var removed = 0;
  var target = 81 - clues;

  for (var k = 0; k < positions.length && removed < target; k++) {
    var pos = positions[k];
    var backup = puzzle[pos];
    puzzle[pos] = 0;
    var test = puzzle.slice();
    if (countSolutions(test, 2) !== 1) {
      puzzle[pos] = backup; // no se puede quitar sin perder unicidad
    } else {
      removed++;
    }
  }

  return { puzzle: puzzle, solution: solution };
}

// ============================================================
// INTERFAZ QUE EL NÚCLEO CONSUME
// ============================================================

function normalizeDifficulty(d) {
  return DIFFICULTY_CLUES[d] ? d : 'medio';
}

function isValidDifficulty(d) {
  return !!DIFFICULTY_CLUES[d];
}

function sanitizeOptions(o) {
  o = o || {};
  return {
    errores: o.errores !== false,     // mostrar contador de errores
    resaltado: o.resaltado !== false, // resaltar números iguales y fila/columna/caja
    autonotas: o.autonotas !== false, // borrar notas automáticamente
    papel: o.papel === true           // modo papel: sin retroalimentación hasta "Ya terminé"
  };
}

// Se llama al iniciar la partida (host presiona "start").
// Debe: 1) generar el estado del juego en room.gameState,
//       2) inicializar el "board" de cada entidad (jugador o equipo).
function setupGame(room) {
  var gen = generatePuzzle(room.difficulty);

  var empty = 0;
  for (var e = 0; e < 81; e++) {
    if (gen.puzzle[e] === 0) empty++;
  }

  room.gameState = {
    puzzle: gen.puzzle,
    solution: gen.solution,
    totalEmpty: empty
  };

  if (room.mode === 'equipos') {
    room.teams = {
      A: { board: gen.puzzle.slice(), progress: 0, errors: 0, eliminated: false, finished: false, finishedAt: 0 },
      B: { board: gen.puzzle.slice(), progress: 0, errors: 0, eliminated: false, finished: false, finishedAt: 0 }
    };
  } else {
    for (var pid in room.players) {
      room.players[pid].board = gen.puzzle.slice();
    }
  }
}

// Campos extra que van en el mensaje 'game' (arranque) y en el snapshot de 'resume'.
function gameStartPayload(room) {
  return {
    puzzle: room.gameState.puzzle,
    totalEmpty: room.gameState.totalEmpty
  };
}

// Valida y aplica una jugada. entity = el equipo (modo equipos) o el jugador (modo individual).
// player = siempre el jugador real que mandó el mensaje (para saber su nombre/equipo).
// Devuelve null si la jugada se ignora (inválida), o { response, broadcastExtra } si se procesó.
function applyMove(room, player, entity, msg) {
  if (room.options && room.options.papel) {
    return applyMovePapel(room, player, entity, msg);
  }

  var index = parseInt(msg.index, 10);
  var value = parseInt(msg.value, 10);
  if (isNaN(index) || index < 0 || index > 80) return null;
  if (isNaN(value) || value < 1 || value > 9) return null;
  if (room.gameState.puzzle[index] !== 0) return null; // celda fija
  if (entity.board[index] !== 0) return null;           // ya resuelta

  var correct = room.gameState.solution[index] === value;
  var broadcastExtra = null;

  if (correct) {
    entity.board[index] = value;
    var solved = 0;
    for (var s = 0; s < 81; s++) {
      if (room.gameState.puzzle[s] === 0 && entity.board[s] !== 0) solved++;
    }
    entity.progress = Math.round((solved / room.gameState.totalEmpty) * 100);
    if (solved === room.gameState.totalEmpty) {
      entity.finished = true;
      entity.finishedAt = Date.now();
      entity.netTime = Date.now() - room.startedAt - room.pausedMs;
    }
    if (room.mode === 'equipos') {
      broadcastExtra = { type: 'team_cell', team: player.team, index: index, value: value, by: player.name };
    }
  } else {
    entity.errors++;
    if (entity.errors >= 3) entity.eliminated = true;
  }

  return {
    response: {
      type: 'move_result',
      index: index,
      value: value,
      correct: correct,
      progress: entity.progress,
      errors: entity.errors,
      eliminated: entity.eliminated,
      finished: entity.finished
    },
    broadcastExtra: broadcastExtra
  };
}

// ---------- MODO PAPEL ----------
// Sin retroalimentación durante el juego: se guarda lo que sea que se escriba
// (correcto o no), se puede reescribir libremente, y solo al presionar
// "Ya terminé" (msg.terminar) se revela el resultado — sin marcha atrás.
function applyMovePapel(room, player, entity, msg) {
  if (msg.terminar) {
    return resolverTerminarPapel(room, player, entity);
  }
  if (entity.finished || entity.eliminated) return null; // ya entregó, no se puede seguir escribiendo

  var index = parseInt(msg.index, 10);
  var value = parseInt(msg.value, 10);
  if (isNaN(index) || index < 0 || index > 80) return null;
  if (isNaN(value) || value < 1 || value > 9) return null;
  if (room.gameState.puzzle[index] !== 0) return null; // celda fija

  entity.board[index] = value; // se guarda tal cual, sin validar contra la solución

  var broadcastExtra = (room.mode === 'equipos')
    ? { type: 'team_cell', team: player.team, index: index, value: value, by: player.name, papel: true }
    : null;

  return {
    response: { type: 'move_result', papel: true, index: index, value: value },
    broadcastExtra: broadcastExtra
  };
}

function resolverTerminarPapel(room, player, entity) {
  if (entity.finished || entity.eliminated) return null;

  for (var i = 0; i < 81; i++) {
    if (room.gameState.puzzle[i] === 0 && entity.board[i] === 0) {
      return { response: { type: 'move_result', papel: true, terminarRechazado: true, mensaje: 'Aún faltan casillas por llenar.' }, broadcastExtra: null };
    }
  }

  var incorrectas = [];
  var correctas = 0;
  var totalVacias = 0;
  for (var j = 0; j < 81; j++) {
    if (room.gameState.puzzle[j] !== 0) continue;
    totalVacias++;
    if (entity.board[j] === room.gameState.solution[j]) correctas++;
    else incorrectas.push(j);
  }

  var esPerfecto = incorrectas.length === 0;
  if (esPerfecto) {
    entity.finished = true;
    entity.finishedAt = Date.now();
    entity.netTime = Date.now() - room.startedAt - room.pausedMs;
    entity.progress = 100;
  } else {
    entity.eliminated = true;
    entity.progress = Math.round((correctas / totalVacias) * 100);
  }

  return {
    response: {
      type: 'move_result', papel: true, terminado: true, correcto: esPerfecto,
      celdasIncorrectas: incorrectas, progress: entity.progress
    },
    broadcastExtra: null
  };
}

module.exports = {
  id: 'sudoku',
  name: GAME_NAME,
  statusVersion: STATUS_VERSION,
  protocolVersion: PROTOCOL_VERSION,
  normalizeDifficulty: normalizeDifficulty,
  isValidDifficulty: isValidDifficulty,
  sanitizeOptions: sanitizeOptions,
  setupGame: setupGame,
  gameStartPayload: gameStartPayload,
  resumeGameFields: gameStartPayload, // mismos campos para el snapshot de reconexión
  applyMove: applyMove
};
