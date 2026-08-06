// ============================================================
// EL IMPOSTOR - Backend BRK Arte
// Railway: Node.js + Express + WebSocket (ws)
//
// A diferencia de Sudoku/Memoria/Sopa (juegos de carrera que
// comparten core/rooms.js), este es un juego por turnos con
// roles ocultos y rondas de eliminación — una máquina de estados
// completamente distinta. Por eso vive en su propio servidor,
// sin depender del núcleo de los otros juegos.
// ============================================================

var express = require('express');
var http = require('http');
var WebSocket = require('ws');
var palabras = require('./palabras');

var TURNO_SEGUNDOS = 25;
var VOTACION_SEGUNDOS = 40;
var ADIVINANZA_SEGUNDOS = 20;
var MIN_JUGADORES = 4;
var MAX_JUGADORES = 10;

var app = express();
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.get('/', function (req, res) {
  res.json({ status: 'ok', app: 'El Impostor - BRK Arte', version: '1.0', rooms: Object.keys(rooms).length });
});

var server = http.createServer(app);
var wss = new WebSocket.Server({ server: server });

var rooms = {};

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function makeRoomCode() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var code;
  do {
    code = '';
    for (var i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  } while (rooms[code]);
  return code;
}

function makePlayerId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function broadcast(room, msg) {
  var data = JSON.stringify(msg);
  for (var id in room.players) {
    var pl = room.players[id];
    if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(data);
  }
}

function enviarA(room, playerId, msg) {
  var pl = room.players[playerId];
  if (pl && pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(JSON.stringify(msg));
}

function jugadoresVivos(room) {
  var vivos = [];
  for (var id in room.players) if (room.players[id].alive) vivos.push(id);
  return vivos;
}

function publicPlayers(room) {
  var list = [];
  for (var id in room.players) {
    var pl = room.players[id];
    list.push({ id: id, name: pl.name, alive: pl.alive, isHost: id === room.hostId, connected: !!pl.ws });
  }
  return list;
}

function broadcastPlayers(room) {
  broadcast(room, { type: 'players', players: publicPlayers(room), state: room.state, config: room.config });
}

function limpiarTemporizador(room) {
  if (room.temporizador) { clearTimeout(room.temporizador); room.temporizador = null; }
}

// ============================================================
// FLUJO DE JUEGO
// ============================================================

function empezarPartida(room) {
  var vivos = Object.keys(room.players);
  var par = palabras.siguienteParPalabras();
  room.categoria = par.categoria;
  room.palabraCiudadanos = par.palabraA;
  room.palabraImpostor = par.palabraB;

  // Asignar roles al azar
  var mezclados = shuffle(vivos);
  var idx = 0;
  var rolesAsignados = {};
  for (var i = 0; i < room.config.impostores; i++) { rolesAsignados[mezclados[idx]] = 'impostor'; idx++; }
  for (var j = 0; j < room.config.mrwhites; j++) { rolesAsignados[mezclados[idx]] = 'mrwhite'; idx++; }
  for (var k = idx; k < mezclados.length; k++) rolesAsignados[mezclados[k]] = 'ciudadano';

  for (var pid in room.players) {
    var rol = rolesAsignados[pid];
    room.players[pid].role = rol;
    room.players[pid].word = rol === 'ciudadano' ? room.palabraCiudadanos : (rol === 'impostor' ? room.palabraImpostor : null);
    room.players[pid].alive = true;
  }

  room.round = 1;
  room.clueLog = [];
  room.eliminados = [];
  room.winner = null;

  // Orden de turnos al azar; Mr. White nunca sale primero en la ronda 1
  var orden = shuffle(vivos);
  if (orden.length > 1) {
    var primerJugador = room.players[orden[0]];
    if (primerJugador.role === 'mrwhite') {
      var t = orden[0]; orden[0] = orden[1]; orden[1] = t;
    }
  }
  room.turnOrder = orden;
  room.turnIndex = 0;

  room.state = 'roles';
  for (var pid2 in room.players) {
    enviarA(room, pid2, {
      type: 'role', role: room.players[pid2].role, word: room.players[pid2].word, categoria: room.categoria
    });
  }
  broadcastPlayers(room);

  // Dar un momento para que todos vean su rol antes de arrancar los turnos
  setTimeout(function () {
    if (!rooms[room.code] || room.state !== 'roles') return;
    iniciarRondaDeTurnos(room);
  }, 4000);
}

function iniciarRondaDeTurnos(room) {
  room.state = 'clue';
  room.turnIndex = 0;
  broadcast(room, { type: 'round_start', round: room.round, order: room.turnOrder.map(function (id) { return { id: id, name: room.players[id].name }; }) });
  siguienteTurno(room);
}

function siguienteTurno(room) {
  limpiarTemporizador(room);

  if (room.turnIndex >= room.turnOrder.length) {
    iniciarVotacion(room);
    return;
  }

  var jugadorId = room.turnOrder[room.turnIndex];
  if (!room.players[jugadorId] || !room.players[jugadorId].alive) {
    room.turnIndex++;
    siguienteTurno(room);
    return;
  }

  room.currentSpeakerId = jugadorId;
  room.turnDeadline = Date.now() + TURNO_SEGUNDOS * 1000;
  broadcast(room, { type: 'turn', playerId: jugadorId, name: room.players[jugadorId].name, deadline: room.turnDeadline, round: room.round });

  room.temporizador = setTimeout(function () {
    if (!rooms[room.code] || room.state !== 'clue' || room.currentSpeakerId !== jugadorId) return;
    room.clueLog.push({ playerId: jugadorId, name: room.players[jugadorId].name, text: '(no dijo nada a tiempo)', round: room.round });
    broadcast(room, { type: 'clue_given', playerId: jugadorId, name: room.players[jugadorId].name, text: '(no dijo nada a tiempo)', round: room.round });
    room.turnIndex++;
    siguienteTurno(room);
  }, TURNO_SEGUNDOS * 1000 + 500);
}

function iniciarVotacion(room) {
  limpiarTemporizador(room);
  room.state = 'voting';
  room.votos = {};
  room.votingDeadline = Date.now() + VOTACION_SEGUNDOS * 1000;
  broadcast(room, { type: 'voting_start', deadline: room.votingDeadline, vivos: jugadoresVivos(room).map(function (id) { return { id: id, name: room.players[id].name }; }) });

  room.temporizador = setTimeout(function () {
    if (!rooms[room.code] || room.state !== 'voting') return;
    resolverVotacion(room);
  }, VOTACION_SEGUNDOS * 1000 + 500);
}

function resolverVotacion(room) {
  limpiarTemporizador(room);
  var conteo = {};
  for (var voterId in room.votos) {
    var objetivo = room.votos[voterId];
    conteo[objetivo] = (conteo[objetivo] || 0) + 1;
  }

  var maxVotos = 0;
  var eliminadoId = null;
  var empatados = [];
  for (var candidato in conteo) {
    if (conteo[candidato] > maxVotos) { maxVotos = conteo[candidato]; eliminadoId = candidato; empatados = [candidato]; }
    else if (conteo[candidato] === maxVotos && maxVotos > 0) { empatados.push(candidato); }
  }
  if (empatados.length > 1) eliminadoId = null; // empate: nadie sale

  var votosDetalle = [];
  for (var vId in room.votos) {
    votosDetalle.push({ from: room.players[vId] ? room.players[vId].name : '?', to: room.players[room.votos[vId]] ? room.players[room.votos[vId]].name : '?' });
  }

  broadcast(room, {
    type: 'votes_revealed',
    votos: votosDetalle,
    eliminado: eliminadoId ? { id: eliminadoId, name: room.players[eliminadoId].name, role: room.players[eliminadoId].role } : null,
    empate: empatados.length > 1
  });

  if (!eliminadoId) {
    // Nadie sale: se repite ronda con los mismos jugadores
    room.round++;
    setTimeout(function () {
      if (!rooms[room.code]) return;
      iniciarRondaDeTurnos(room);
    }, 3500);
    return;
  }

  room.players[eliminadoId].alive = false;
  room.eliminados.push(eliminadoId);
  broadcastPlayers(room);

  var rolEliminado = room.players[eliminadoId].role;
  if (rolEliminado === 'impostor' || rolEliminado === 'mrwhite') {
    ofrecerAdivinanza(room, eliminadoId);
  } else {
    setTimeout(function () { revisarFinDePartida(room); }, 3000);
  }
}

function ofrecerAdivinanza(room, jugadorId) {
  room.state = 'guessing';
  room.pendingGuessId = jugadorId;
  room.guessDeadline = Date.now() + ADIVINANZA_SEGUNDOS * 1000;
  broadcast(room, { type: 'guess_chance', playerId: jugadorId, name: room.players[jugadorId].name, deadline: room.guessDeadline });

  room.temporizador = setTimeout(function () {
    if (!rooms[room.code] || room.state !== 'guessing') return;
    resolverAdivinanza(room, null);
  }, ADIVINANZA_SEGUNDOS * 1000 + 500);
}

function resolverAdivinanza(room, intento) {
  limpiarTemporizador(room);
  var correcto = !!intento && intento.trim().toUpperCase() === room.palabraCiudadanos.toUpperCase();
  broadcast(room, { type: 'guess_result', playerId: room.pendingGuessId, intento: intento || '', correcto: correcto, palabraReal: room.palabraCiudadanos });

  if (correcto) {
    terminarPartida(room, room.players[room.pendingGuessId].role === 'impostor' ? 'impostor' : 'mrwhite');
    return;
  }
  setTimeout(function () { revisarFinDePartida(room); }, 2500);
}

function revisarFinDePartida(room) {
  var vivos = jugadoresVivos(room);
  var malos = vivos.filter(function (id) { return room.players[id].role !== 'ciudadano'; });
  var buenos = vivos.filter(function (id) { return room.players[id].role === 'ciudadano'; });

  if (malos.length === 0) { terminarPartida(room, 'ciudadanos'); return; }
  if (malos.length >= buenos.length) { terminarPartida(room, malos[0] ? room.players[malos[0]].role : 'impostor'); return; }

  room.round++;
  room.turnOrder = shuffle(vivos);
  iniciarRondaDeTurnos(room);
}

function terminarPartida(room, ganador) {
  limpiarTemporizador(room);
  room.state = 'finished';
  room.winner = ganador;
  var roles = {};
  for (var id in room.players) {
    roles[id] = { name: room.players[id].name, role: room.players[id].role, word: room.players[id].word, alive: room.players[id].alive };
  }
  broadcast(room, { type: 'game_over', winner: ganador, roles: roles, palabraCiudadanos: room.palabraCiudadanos, palabraImpostor: room.palabraImpostor, categoria: room.categoria });
}

// ============================================================
// WEBSOCKET
// ============================================================

wss.on('connection', function (ws) {
  ws.isAlive = true;
  ws.playerId = null;
  ws.roomCode = null;
  ws.on('pong', function () { ws.isAlive = true; });

  ws.on('message', function (raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }

    if (msg.type === 'create') {
      var name = String(msg.name || 'Jugador').substring(0, 15).trim() || 'Jugador';
      var code = makeRoomCode();
      var playerId = makePlayerId();
      rooms[code] = {
        code: code, hostId: playerId, state: 'lobby',
        config: { impostores: 1, mrwhites: 0 },
        players: {}, createdAt: Date.now()
      };
      rooms[code].players[playerId] = { name: name, ws: ws, alive: true, role: null, word: null };
      ws.playerId = playerId; ws.roomCode = code;
      ws.send(JSON.stringify({ type: 'created', code: code, playerId: playerId, version: '1.0' }));
      broadcastPlayers(rooms[code]);
      return;
    }

    if (msg.type === 'join') {
      var joinCode = String(msg.code || '').toUpperCase().trim();
      var joinName = String(msg.name || 'Jugador').substring(0, 15).trim() || 'Jugador';
      var room = rooms[joinCode];
      if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'No existe una sala con ese código.' })); return; }
      if (room.state !== 'lobby') { ws.send(JSON.stringify({ type: 'error', message: 'Esa partida ya comenzó.' })); return; }
      if (Object.keys(room.players).length >= MAX_JUGADORES) { ws.send(JSON.stringify({ type: 'error', message: 'La sala está llena (máximo ' + MAX_JUGADORES + ').' })); return; }
      var newId = makePlayerId();
      room.players[newId] = { name: joinName, ws: ws, alive: true, role: null, word: null };
      ws.playerId = newId; ws.roomCode = joinCode;
      ws.send(JSON.stringify({ type: 'joined', code: joinCode, playerId: newId, version: '1.0' }));
      broadcastPlayers(room);
      return;
    }

    if (msg.type === 'resume') {
      var rCode = String(msg.code || '').toUpperCase();
      var rId = String(msg.playerId || '');
      var rRoom = rooms[rCode];
      if (!rRoom || !rRoom.players[rId]) { ws.send(JSON.stringify({ type: 'resume_failed' })); return; }
      var rp = rRoom.players[rId];
      if (rp.ws && rp.ws !== ws && rp.ws.readyState === WebSocket.OPEN) { try { rp.ws.terminate(); } catch (e2) {} }
      rp.ws = ws; ws.playerId = rId; ws.roomCode = rCode;

      var snapshot = { type: 'resumed', code: rCode, playerId: rId, isHost: rId === rRoom.hostId, state: rRoom.state, config: rRoom.config, players: publicPlayers(rRoom) };
      if (rRoom.state !== 'lobby' && rp.role) {
        snapshot.role = rp.role; snapshot.word = rp.word; snapshot.categoria = rRoom.categoria;
      }
      if (rRoom.state === 'clue') { snapshot.currentSpeakerId = rRoom.currentSpeakerId; snapshot.turnDeadline = rRoom.turnDeadline; snapshot.round = rRoom.round; snapshot.clueLog = rRoom.clueLog; }
      if (rRoom.state === 'voting') { snapshot.votingDeadline = rRoom.votingDeadline; snapshot.yaVote = !!rRoom.votos[rId]; snapshot.vivos = jugadoresVivos(rRoom).map(function (id) { return { id: id, name: rRoom.players[id].name }; }); }
      if (rRoom.state === 'guessing') { snapshot.pendingGuessId = rRoom.pendingGuessId; snapshot.guessDeadline = rRoom.guessDeadline; }
      if (rRoom.state === 'finished') { snapshot.winner = rRoom.winner; }
      ws.send(JSON.stringify(snapshot));
      broadcastPlayers(rRoom);
      return;
    }

    var currentRoom = rooms[ws.roomCode];
    if (!currentRoom || !ws.playerId || !currentRoom.players[ws.playerId]) return;
    var me = currentRoom.players[ws.playerId];

    if (msg.type === 'chat') {
      var text = String(msg.text || '').substring(0, 300).trim();
      if (!text) return;
      broadcast(currentRoom, { type: 'chat', fromId: ws.playerId, from: me.name, text: text, at: Date.now() });
      return;
    }

    if (msg.type === 'set_roles') {
      if (ws.playerId !== currentRoom.hostId || currentRoom.state !== 'lobby') return;
      var totalJugadores = Object.keys(currentRoom.players).length;
      var imp = Math.max(0, parseInt(msg.impostores, 10) || 0);
      var mrw = Math.max(0, parseInt(msg.mrwhites, 10) || 0);
      var especiales = imp + mrw;
      if (especiales >= totalJugadores - especiales) {
        ws.send(JSON.stringify({ type: 'error', message: 'Los ciudadanos deben ser mayoría. Baja la cantidad de roles especiales.' }));
        return;
      }
      currentRoom.config = { impostores: imp, mrwhites: mrw };
      broadcastPlayers(currentRoom);
      return;
    }

    if (msg.type === 'start') {
      if (ws.playerId !== currentRoom.hostId || currentRoom.state !== 'lobby') return;
      var totalP = Object.keys(currentRoom.players).length;
      if (totalP < MIN_JUGADORES) { ws.send(JSON.stringify({ type: 'error', message: 'Se necesitan mínimo ' + MIN_JUGADORES + ' jugadores.' })); return; }
      var especialesTotal = currentRoom.config.impostores + currentRoom.config.mrwhites;
      if (especialesTotal >= totalP - especialesTotal) { ws.send(JSON.stringify({ type: 'error', message: 'Los ciudadanos deben ser mayoría. Ajusta los roles especiales.' })); return; }
      empezarPartida(currentRoom);
      return;
    }

    if (msg.type === 'clue') {
      if (currentRoom.state !== 'clue' || currentRoom.currentSpeakerId !== ws.playerId) return;
      var texto = String(msg.text || '').substring(0, 80).trim();
      if (!texto) return;
      limpiarTemporizador(currentRoom);
      currentRoom.clueLog.push({ playerId: ws.playerId, name: me.name, text: texto, round: currentRoom.round });
      broadcast(currentRoom, { type: 'clue_given', playerId: ws.playerId, name: me.name, text: texto, round: currentRoom.round });
      currentRoom.turnIndex++;
      siguienteTurno(currentRoom);
      return;
    }

    if (msg.type === 'vote') {
      if (currentRoom.state !== 'voting' || !me.alive) return;
      var objetivo = String(msg.target || '');
      if (!currentRoom.players[objetivo] || !currentRoom.players[objetivo].alive) return;
      currentRoom.votos[ws.playerId] = objetivo;
      broadcast(currentRoom, { type: 'vote_progress', votaron: Object.keys(currentRoom.votos).length, total: jugadoresVivos(currentRoom).length });
      if (Object.keys(currentRoom.votos).length >= jugadoresVivos(currentRoom).length) {
        resolverVotacion(currentRoom);
      }
      return;
    }

    if (msg.type === 'guess') {
      if (currentRoom.state !== 'guessing' || currentRoom.pendingGuessId !== ws.playerId) return;
      resolverAdivinanza(currentRoom, String(msg.word || ''));
      return;
    }

    if (msg.type === 'rematch') {
      if (ws.playerId !== currentRoom.hostId || currentRoom.state !== 'finished') return;
      currentRoom.state = 'lobby';
      for (var pid3 in currentRoom.players) {
        currentRoom.players[pid3].alive = true;
        currentRoom.players[pid3].role = null;
        currentRoom.players[pid3].word = null;
      }
      broadcast(currentRoom, { type: 'rematch' });
      broadcastPlayers(currentRoom);
      return;
    }
  });

  ws.on('close', function () {
    var room = rooms[ws.roomCode];
    if (!room || !ws.playerId || !room.players[ws.playerId]) return;
    var pl = room.players[ws.playerId];
    if (pl.ws !== ws) return;
    pl.ws = null;

    if (room.state === 'lobby') {
      setTimeout(function () {
        var r = rooms[room.code];
        if (!r || !r.players[ws.playerId]) return;
        var p = r.players[ws.playerId];
        if (p.ws !== null) return;
        delete r.players[ws.playerId];
        if (ws.playerId === r.hostId) {
          var ids = Object.keys(r.players);
          var newHost = null;
          for (var i = 0; i < ids.length; i++) if (r.players[ids[i]].ws) { newHost = ids[i]; break; }
          r.hostId = newHost || (ids.length > 0 ? ids[0] : null);
        }
        if (Object.keys(r.players).length === 0) delete rooms[r.code];
        else broadcastPlayers(r);
      }, 120000);
    } else if (room.state !== 'finished') {
      // Gracia de 90s en partida; si no vuelve, se cuenta como si no pudiera seguir
      // (no se elimina del juego automáticamente — puede reconectar y seguir vivo)
      broadcastPlayers(room);
    }
  });
});

setInterval(function () {
  wss.clients.forEach(function (ws) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

setInterval(function () {
  var now = Date.now();
  for (var code in rooms) {
    if (now - rooms[code].createdAt > 3 * 60 * 60 * 1000) delete rooms[code];
  }
}, 30 * 60 * 1000);

var PORT = process.env.PORT || 3000;
server.listen(PORT, function () {
  console.log('El Impostor backend corriendo en puerto ' + PORT);
});
