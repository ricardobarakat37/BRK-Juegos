// ============================================================
// MÓDULO DE JUEGO: SOPA DE LETRAS
// Todo lo específico de este juego vive aquí. El núcleo (core/rooms.js)
// no sabe qué es una cuadrícula ni una palabra — solo llama a las
// funciones de esta interfaz (la misma que usan sudoku.js y memoria.js).
// ============================================================

var GAME_NAME = 'Sopa de Letras Battle - BRK Arte';
var STATUS_VERSION = '1.0';
var PROTOCOL_VERSION = '1.0';

// ============================================================
// CATEGORÍAS (español nativo, sin traducción automática — mismo
// aprendizaje que con BRK Trivia: Google Translate arruina el contexto)
// ============================================================
var CATEGORIAS = {
  animales: ['PERRO','GATO','LEON','TIGRE','ELEFANTE','JIRAFA','MONO','OSO','CONEJO','CABALLO','VACA','CERDO','POLLO','PATO','RATON','ZORRO','LOBO','CIERVO','CANGURO','PINGUINO','AGUILA','BUHO','SERPIENTE','TORTUGA','DELFIN'],
  frutas: ['MANZANA','PLATANO','NARANJA','UVA','FRESA','PINA','SANDIA','MELON','PERA','DURAZNO','MANGO','LIMON','KIWI','COCO','CEREZA','GUAYABA','PAPAYA','MORA','CIRUELA','GRANADA','MANDARINA','TAMARINDO'],
  deportes: ['FUTBOL','BALONCESTO','TENIS','NATACION','CICLISMO','BOXEO','GOLF','VOLEIBOL','ATLETISMO','BEISBOL','RUGBY','ESGRIMA','KARATE','SURF','ESQUI','REMO','YOGA','PATINAJE','BOLICHE','GIMNASIA'],
  latinoamerica: ['CAFE','SALSA','AREPA','VALLENATO','CUMBIA','TROPICO','ANDES','AMAZONAS','CARIBE','BOGOTA','MEDELLIN','TANGO','MARIACHI','FIESTA','CARNAVAL','SOMBRERO','GUITARRA','MARACAS','TAMBOR','SANCOCHO'],
  naturaleza: ['MONTANA','RIO','OCEANO','BOSQUE','DESIERTO','VOLCAN','CASCADA','PLAYA','ISLA','SELVA','LAGO','VALLE','NUBE','ESTRELLA','LUNA','SOL','TIERRA','VIENTO','LLUVIA','ARCOIRIS'],
  casa: ['MESA','SILLA','CAMA','PUERTA','VENTANA','ESPEJO','LAMPARA','RELOJ','LIBRO','TELEFONO','COCINA','JARDIN','GARAJE','TECHO','PARED','ESCALERA','ALFOMBRA','CORTINA','SOFA','ARMARIO'],
  colores: ['ROJO','AZUL','VERDE','AMARILLO','NARANJA','MORADO','ROSADO','NEGRO','BLANCO','GRIS','DORADO','PLATEADO','TURQUESA','VIOLETA']
};
var NOMBRES_CATEGORIA = { animales: 'Animales', frutas: 'Frutas', deportes: 'Deportes', latinoamerica: 'Latinoamérica', naturaleza: 'Naturaleza', casa: 'La Casa', colores: 'Colores' };
var CLAVES_CATEGORIAS = Object.keys(CATEGORIAS);

var CONFIG_DIFICULTAD = {
  facil: { size: 10, palabras: 6, direcciones: [[0,1],[1,0]] },
  medio: { size: 12, palabras: 8, direcciones: [[0,1],[1,0],[1,1],[1,-1]] },
  dificil: { size: 15, palabras: 10, direcciones: [[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]] }
};

var ALFABETO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ============================================================
// GENERADOR DE LA CUADRÍCULA
// ============================================================

function generarCuadricula(dificultad) {
  var cfg = CONFIG_DIFICULTAD[dificultad] || CONFIG_DIFICULTAD.medio;
  var size = cfg.size;

  for (var intentoGlobal = 0; intentoGlobal < 15; intentoGlobal++) {
    var categoriaClave = CLAVES_CATEGORIAS[Math.floor(Math.random() * CLAVES_CATEGORIAS.length)];
    var banco = shuffle(CATEGORIAS[categoriaClave]);
    var candidatas = banco.filter(function (w) { return w.length <= size; });
    candidatas.sort(function (a, b) { return b.length - a.length; }); // largas primero: más fácil ubicarlas

    var grid = [];
    for (var i = 0; i < size * size; i++) grid.push(null);
    var colocadas = []; // { palabra, celdas: [index,...] }

    for (var w = 0; w < candidatas.length && colocadas.length < cfg.palabras; w++) {
      var palabra = candidatas[w];
      var ubicada = false;

      for (var intento = 0; intento < 300 && !ubicada; intento++) {
        var dir = cfg.direcciones[Math.floor(Math.random() * cfg.direcciones.length)];
        var fila0 = Math.floor(Math.random() * size);
        var col0 = Math.floor(Math.random() * size);
        var filaFin = fila0 + dir[0] * (palabra.length - 1);
        var colFin = col0 + dir[1] * (palabra.length - 1);
        if (filaFin < 0 || filaFin >= size || colFin < 0 || colFin >= size) continue;

        var celdas = [];
        var cabe = true;
        for (var k = 0; k < palabra.length; k++) {
          var f = fila0 + dir[0] * k;
          var c = col0 + dir[1] * k;
          var idx = f * size + c;
          if (grid[idx] !== null && grid[idx] !== palabra[k]) { cabe = false; break; }
          celdas.push(idx);
        }
        if (!cabe) continue;

        for (var k2 = 0; k2 < palabra.length; k2++) grid[celdas[k2]] = palabra[k2];
        colocadas.push({ palabra: palabra, celdas: celdas });
        ubicada = true;
      }
    }

    if (colocadas.length < cfg.palabras) continue; // esta cuadrícula no cuajó, reintentar desde cero

    // Rellenar huecos con letras al azar
    for (var i2 = 0; i2 < grid.length; i2++) {
      if (grid[i2] === null) grid[i2] = ALFABETO.charAt(Math.floor(Math.random() * ALFABETO.length));
    }

    return {
      size: size,
      grid: grid,
      categoria: NOMBRES_CATEGORIA[categoriaClave],
      palabras: colocadas // el servidor guarda dónde está cada una; el cliente NO recibe esto
    };
  }

  // Si tras 15 intentos completos no cuajó (extremadamente improbable), usar el último resultado parcial
  throw new Error('No se pudo generar la cuadrícula de sopa de letras');
}

// ============================================================
// INTERFAZ QUE EL NÚCLEO CONSUME
// ============================================================

function normalizeDifficulty(d) {
  return CONFIG_DIFICULTAD[d] ? d : 'medio';
}

function isValidDifficulty(d) {
  return !!CONFIG_DIFICULTAD[d];
}

function sanitizeOptions(o) {
  return {}; // sin opciones configurables en v1
}

function setupGame(room) {
  var gen = generarCuadricula(room.difficulty);

  room.gameState = {
    size: gen.size,
    grid: gen.grid,
    categoria: gen.categoria,
    palabras: gen.palabras // [{palabra, celdas}], nunca se manda tal cual al cliente
  };

  if (room.mode === 'equipos') {
    room.teams = {
      A: { board: {}, progress: 0, errors: 0, eliminated: false, finished: false, finishedAt: 0 },
      B: { board: {}, progress: 0, errors: 0, eliminated: false, finished: false, finishedAt: 0 }
    };
  } else {
    for (var pid in room.players) {
      room.players[pid].board = {}; // palabra -> celdas, solo las que ya encontró
    }
  }
}

// Campos extra del mensaje 'game' y del snapshot de 'resume'.
// La cuadrícula de letras SÍ se manda (hay que verla para buscar), pero
// la posición de cada palabra dentro de ella se queda en el servidor.
function gameStartPayload(room) {
  var listaPalabras = [];
  for (var i = 0; i < room.gameState.palabras.length; i++) listaPalabras.push(room.gameState.palabras[i].palabra);
  return {
    size: room.gameState.size,
    grid: room.gameState.grid,
    categoria: room.gameState.categoria,
    words: listaPalabras
  };
}

function resumeGameFields(room) {
  return gameStartPayload(room);
}

// Dado un inicio y un fin (índices de celda), calcula la línea recta entre
// ambos (fila, columna o diagonal). Devuelve null si no es una línea válida.
function celdasEnLinea(size, desde, hasta) {
  var f1 = Math.floor(desde / size), c1 = desde % size;
  var f2 = Math.floor(hasta / size), c2 = hasta % size;
  var df = f2 - f1, dc = c2 - c1;
  if (df === 0 && dc === 0) return null;
  if (df !== 0 && dc !== 0 && Math.abs(df) !== Math.abs(dc)) return null; // no es línea recta ni diagonal exacta

  var pasos = Math.max(Math.abs(df), Math.abs(dc));
  var stepF = df === 0 ? 0 : df / pasos;
  var stepC = dc === 0 ? 0 : dc / pasos;

  var celdas = [];
  for (var k = 0; k <= pasos; k++) {
    celdas.push((f1 + stepF * k) * size + (c1 + stepC * k));
  }
  return celdas;
}

// Valida y aplica una jugada: seleccionar desde una celda hasta otra.
function applyMove(room, player, entity, msg) {
  var desde = parseInt(msg.from, 10);
  var hasta = parseInt(msg.to, 10);
  var size = room.gameState.size;
  if (isNaN(desde) || isNaN(hasta) || desde < 0 || desde >= size * size || hasta < 0 || hasta >= size * size) return null;

  var celdas = celdasEnLinea(size, desde, hasta);
  if (!celdas) return null; // no es una línea recta válida

  var letras = celdas.map(function (idx) { return room.gameState.grid[idx]; }).join('');
  var letrasInvertidas = letras.split('').reverse().join('');

  var palabraEncontrada = null;
  for (var i = 0; i < room.gameState.palabras.length; i++) {
    var p = room.gameState.palabras[i].palabra;
    if (entity.board[p]) continue; // ya la tenía encontrada
    if (p === letras || p === letrasInvertidas) { palabraEncontrada = p; break; }
  }

  var esEquipos = room.mode === 'equipos';

  if (!palabraEncontrada) {
    return {
      response: { type: 'move_result', correct: false, from: desde, to: hasta },
      broadcastExtra: null
    };
  }

  entity.board[palabraEncontrada] = celdas;
  var encontradas = Object.keys(entity.board).length;
  var totalPalabras = room.gameState.palabras.length;
  entity.progress = Math.round((encontradas / totalPalabras) * 100);
  if (encontradas === totalPalabras) {
    entity.finished = true;
    entity.finishedAt = Date.now();
    entity.netTime = Date.now() - room.startedAt - room.pausedMs;
  }

  var broadcastExtra = esEquipos ? {
    type: 'team_found', team: player.team, word: palabraEncontrada, cells: celdas, by: player.name,
    progress: entity.progress, finished: entity.finished
  } : null;

  return {
    response: {
      type: 'move_result', correct: true, word: palabraEncontrada, cells: celdas,
      progress: entity.progress, errors: entity.errors, finished: entity.finished
    },
    broadcastExtra: broadcastExtra
  };
}

module.exports = {
  id: 'sopadeletras',
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
