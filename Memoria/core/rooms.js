// ============================================================
// NÚCLEO DE BRK JUEGOS
// Salas con código, reconexión, lobby, pausa, podio.
// No sabe nada de las reglas de ningún juego en particular —
// recibe un objeto "game" con la interfaz que necesita y lo
// llama en los puntos donde antes había lógica de sudoku.
//
// Interfaz que debe cumplir "game":
//   id, name, statusVersion, protocolVersion
//   normalizeDifficulty(d) -> string
//   isValidDifficulty(d) -> bool
//   sanitizeOptions(o) -> object
//   setupGame(room)            muta room.gameState y los boards de jugadores/equipos
//   gameStartPayload(room)     -> campos extra para el mensaje 'game'
//   resumeGameFields(room)     -> campos extra para el snapshot de 'resume'
//   applyMove(room, player, entity, msg) -> null | { response, broadcastExtra }
// ============================================================

var express = require('express');
var http = require('http');
var WebSocket = require('ws');

module.exports = function createGameServer(game) {

  var app = express();

  // --- CORS desde el inicio (frontend en brkarte.com, backend en Railway) ---
  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.get('/', function (req, res) {
    res.json({ status: 'ok', app: game.name, version: game.statusVersion, rooms: Object.keys(rooms).length });
  });

  var server = http.createServer(app);
  var wss = new WebSocket.Server({ server: server });

  // ============================================================
  // SALAS Y JUGADORES
  // ============================================================

  var rooms = {}; // code -> room
  var MAX_PLAYERS = 8;

  function makeRoomCode() {
    // Sin caracteres ambiguos (0/O, 1/I/L)
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var code = '';
    do {
      code = '';
      for (var i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (rooms[code]);
    return code;
  }

  function makePlayerId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function publicPlayers(room) {
    var list = [];
    for (var id in room.players) {
      var pl = room.players[id];
      list.push({
        id: id,
        name: pl.name,
        progress: pl.progress,
        errors: pl.errors,
        eliminated: pl.eliminated,
        finished: pl.finished,
        rank: pl.rank,
        team: pl.team || null,
        isHost: id === room.hostId,
        connected: pl.ws !== null
      });
    }
    return list;
  }

  function broadcast(room, msg) {
    var data = JSON.stringify(msg);
    for (var id in room.players) {
      var pl = room.players[id];
      if (pl.ws && pl.ws.readyState === WebSocket.OPEN) {
        pl.ws.send(data);
      }
    }
  }

  function teamsSummary(room) {
    if (!room.teams) return null;
    var out = {};
    for (var t in room.teams) {
      var tm = room.teams[t];
      out[t] = { progress: tm.progress, errors: tm.errors, eliminated: tm.eliminated, finished: tm.finished };
    }
    return out;
  }

  function teamLabel(room, teamKey) {
    var nombres = [];
    for (var id in room.players) {
      if (room.players[id].team === teamKey) nombres.push(room.players[id].name);
    }
    var base = teamKey === 'A' ? 'Equipo Oro' : 'Equipo Menta';
    return base + ' (' + nombres.join(' y ') + ')';
  }

  function broadcastPlayers(room) {
    broadcast(room, { type: 'players', players: publicPlayers(room), teams: teamsSummary(room), mode: room.mode, options: room.options, wins: room.wins, state: room.state });
  }

  function checkGameOver(room) {
    if (room.state !== 'playing') return;

    // ----- Modo equipos -----
    if (room.mode === 'equipos' && room.teams) {
      var teamsDone = true;
      for (var tk in room.teams) {
        if (!room.teams[tk].finished && !room.teams[tk].eliminated) { teamsDone = false; break; }
      }
      if (!teamsDone) return;

      room.state = 'finished';
      var tFin = [], tElim = [];
      for (var tk2 in room.teams) {
        var tm = room.teams[tk2];
        tm.key = tk2;
        if (tm.finished) tFin.push(tm); else tElim.push(tm);
      }
      tFin.sort(function (a, b) { return a.finishedAt - b.finishedAt; });
      tElim.sort(function (a, b) { return b.progress - a.progress; });

      var rankingT = [];
      var posT = 1;
      var j;
      for (j = 0; j < tFin.length; j++) {
        rankingT.push({ name: teamLabel(room, tFin[j].key), progress: tFin[j].progress, status: 'finished', rank: posT, timeMs: tFin[j].netTime || (tFin[j].finishedAt - room.startedAt - room.pausedMs) });
        posT++;
      }
      for (j = 0; j < tElim.length; j++) {
        rankingT.push({ name: teamLabel(room, tElim[j].key), progress: tElim[j].progress, status: 'eliminated', rank: posT, timeMs: null });
        posT++;
      }
      if (rankingT.length > 0 && rankingT[0].status === 'finished') {
        var claveGanadora = tFin[0].key === 'A' ? 'Equipo Oro' : 'Equipo Menta';
        room.wins[claveGanadora] = (room.wins[claveGanadora] || 0) + 1;
      }
      room.lastRanking = rankingT;
      broadcast(room, { type: 'podium', ranking: rankingT, wins: room.wins });
      return;
    }

    // ----- Modo individual -----
    var allDone = true;
    for (var id in room.players) {
      var pl = room.players[id];
      if (!pl.finished && !pl.eliminated) {
        allDone = false;
        break;
      }
    }
    if (allDone) {
      room.state = 'finished';
      // Ranking: primero los que terminaron (por orden de llegada),
      // luego los eliminados (por mayor progreso)
      var finishers = [];
      var eliminated = [];
      for (var pid in room.players) {
        var p = room.players[pid];
        if (p.finished) finishers.push(p);
        else eliminated.push(p);
      }
      finishers.sort(function (a, b) { return a.finishedAt - b.finishedAt; });
      eliminated.sort(function (a, b) { return b.progress - a.progress; });

      var ranking = [];
      var pos = 1;
      var i;
      for (i = 0; i < finishers.length; i++) {
        finishers[i].rank = pos;
        ranking.push({ name: finishers[i].name, progress: finishers[i].progress, status: 'finished', rank: pos, timeMs: finishers[i].netTime || (finishers[i].finishedAt - room.startedAt - room.pausedMs) });
        pos++;
      }
      for (i = 0; i < eliminated.length; i++) {
        eliminated[i].rank = pos;
        ranking.push({ name: eliminated[i].name, progress: eliminated[i].progress, status: 'eliminated', rank: pos, timeMs: null });
        pos++;
      }
      if (ranking.length > 0 && ranking[0].status === 'finished') {
        room.wins[ranking[0].name] = (room.wins[ranking[0].name] || 0) + 1;
      }
      room.lastRanking = ranking;
      broadcast(room, { type: 'podium', ranking: ranking, wins: room.wins });
    }
  }

  // Programa la revisión de "¿sigue desconectado?" 60 segundos después.
  // Si el juego está en pausa cuando se cumple el plazo, NO elimina — el
  // reloj de eliminación no debe correr mientras nadie puede jugar de todas
  // formas. En su lugar, se reprograma para revisar de nuevo más tarde.
  function scheduleEliminationCheck(room, playerId) {
    setTimeout(function () {
      var r = rooms[room.code];
      if (!r || !r.players[playerId]) return;
      var p = r.players[playerId];
      if (p.ws !== null || p.finished || p.eliminated) return;
      if (r.paused) return; // el reloj de eliminación queda congelado mientras dure la pausa
      if (r.mode === 'equipos') {
        // El compañero puede seguir solo; no se elimina al equipo
        broadcastPlayers(r);
        return;
      }
      p.eliminated = true;
      broadcastPlayers(r);
      checkGameOver(r);
    }, 60000);
  }

  function resetRoomForRematch(room) {
    room.state = 'lobby';
    room.teams = null;
    room.paused = false;
    room.pausedAt = 0;
    room.pausedMs = 0;
    room.pausedBy = '';
    room.gameState = {};
    room.startedAt = 0;
    for (var id in room.players) {
      var pl = room.players[id];
      pl.progress = 0;
      pl.errors = 0;
      pl.eliminated = false;
      pl.finished = false;
      pl.finishedAt = 0;
      pl.rank = 0;
      pl.board = null;
    }
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

      // Keepalive del cliente
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // ---------- CREAR SALA ----------
      if (msg.type === 'create') {
        var name = String(msg.name || 'Jugador').substring(0, 15).trim() || 'Jugador';
        var difficulty = game.normalizeDifficulty(msg.difficulty);
        var code = makeRoomCode();
        var playerId = makePlayerId();

        rooms[code] = {
          code: code,
          hostId: playerId,
          difficulty: difficulty,
          mode: 'individual',
          teams: null,
          options: game.sanitizeOptions(msg.options),
          paused: false,
          pausedAt: 0,
          pausedMs: 0,
          pausedBy: '',
          wins: {},
          state: 'lobby',
          players: {},
          gameState: {},
          startedAt: 0,
          createdAt: Date.now()
        };

        rooms[code].players[playerId] = {
          name: name, ws: ws, progress: 0, errors: 0,
          eliminated: false, finished: false, finishedAt: 0, rank: 0, board: null
        };

        ws.playerId = playerId;
        ws.roomCode = code;

        ws.send(JSON.stringify({ type: 'created', code: code, playerId: playerId, difficulty: difficulty, version: game.protocolVersion }));
        broadcastPlayers(rooms[code]);
        return;
      }

      // ---------- UNIRSE A SALA ----------
      if (msg.type === 'join') {
        var joinCode = String(msg.code || '').toUpperCase().trim();
        var joinName = String(msg.name || 'Jugador').substring(0, 15).trim() || 'Jugador';
        var room = rooms[joinCode];

        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'No existe una sala con ese código.' }));
          return;
        }
        if (room.state !== 'lobby') {
          ws.send(JSON.stringify({ type: 'error', message: 'Esa partida ya comenzó.' }));
          return;
        }
        if (Object.keys(room.players).length >= MAX_PLAYERS) {
          ws.send(JSON.stringify({ type: 'error', message: 'La sala está llena (máximo ' + MAX_PLAYERS + ' jugadores).' }));
          return;
        }

        var newId = makePlayerId();
        room.players[newId] = {
          name: joinName, ws: ws, progress: 0, errors: 0,
          eliminated: false, finished: false, finishedAt: 0, rank: 0, board: null
        };
        ws.playerId = newId;
        ws.roomCode = joinCode;

        ws.send(JSON.stringify({ type: 'joined', code: joinCode, playerId: newId, difficulty: room.difficulty, version: game.protocolVersion }));
        broadcastPlayers(room);
        return;
      }

      // ---------- RECONECTARSE (celular bloqueado, cambio de app, caída de red) ----------
      if (msg.type === 'resume') {
        var rCode = String(msg.code || '').toUpperCase();
        var rId = String(msg.playerId || '');
        var rRoom = rooms[rCode];

        if (!rRoom || !rRoom.players[rId]) {
          ws.send(JSON.stringify({ type: 'resume_failed', message: 'La sala ya no existe. Crea una nueva.' }));
          return;
        }

        var rp = rRoom.players[rId];
        if (rp.ws && rp.ws !== ws && rp.ws.readyState === WebSocket.OPEN) {
          try { rp.ws.terminate(); } catch (e2) {}
        }
        rp.ws = ws;
        ws.playerId = rId;
        ws.roomCode = rCode;

        var snapshot = {
          type: 'resumed',
          state: rRoom.state,
          code: rCode,
          playerId: rId,
          difficulty: rRoom.difficulty,
          isHost: rId === rRoom.hostId
        };
        snapshot.mode = rRoom.mode;
        snapshot.team = rp.team || null;
        snapshot.options = rRoom.options;
        if (rRoom.state === 'playing' || rRoom.state === 'countdown') {
          var extraFields = game.resumeGameFields(rRoom);
          for (var fk in extraFields) snapshot[fk] = extraFields[fk];
          snapshot.paused = rRoom.paused;
          snapshot.pausedBy = rRoom.pausedBy;
          var ahora = rRoom.paused ? rRoom.pausedAt : Date.now();
          snapshot.elapsedMs = rRoom.startedAt ? (ahora - rRoom.startedAt - rRoom.pausedMs) : 0;
          if (rRoom.mode === 'equipos' && rRoom.teams && rp.team && rRoom.teams[rp.team]) {
            var eqR = rRoom.teams[rp.team];
            snapshot.board = eqR.board;
            snapshot.progress = eqR.progress;
            snapshot.errors = eqR.errors;
            snapshot.eliminated = eqR.eliminated;
            snapshot.finished = eqR.finished;
          } else {
            snapshot.board = rp.board;
            snapshot.progress = rp.progress;
            snapshot.errors = rp.errors;
            snapshot.eliminated = rp.eliminated;
            snapshot.finished = rp.finished;
          }
        }
        if (rRoom.state === 'finished' && rRoom.lastRanking) {
          snapshot.ranking = rRoom.lastRanking;
        }

        ws.send(JSON.stringify(snapshot));
        broadcastPlayers(rRoom);
        return;
      }

      // --- Todo lo siguiente requiere estar en una sala ---
      var currentRoom = rooms[ws.roomCode];
      if (!currentRoom || !ws.playerId || !currentRoom.players[ws.playerId]) return;
      var me = currentRoom.players[ws.playerId];

      // ---------- CHAT (cualquier jugador, en cualquier momento dentro de la sala) ----------
      if (msg.type === 'chat') {
        var text = String(msg.text || '').substring(0, 300).trim();
        if (!text) return;
        broadcast(currentRoom, { type: 'chat', fromId: ws.playerId, from: me.name, text: text, at: Date.now() });
        return;
      }

      // ---------- CAMBIAR DIFICULTAD (solo host, en lobby) ----------
      if (msg.type === 'set_difficulty') {
        if (ws.playerId === currentRoom.hostId && currentRoom.state === 'lobby') {
          if (game.isValidDifficulty(msg.difficulty)) {
            currentRoom.difficulty = msg.difficulty;
            broadcast(currentRoom, { type: 'difficulty', difficulty: msg.difficulty });
          }
        }
        return;
      }

      // ---------- CAMBIAR OPCIONES (solo host, en lobby) ----------
      if (msg.type === 'set_options') {
        if (ws.playerId === currentRoom.hostId && currentRoom.state === 'lobby') {
          currentRoom.options = game.sanitizeOptions(msg.options);
          broadcastPlayers(currentRoom);
        }
        return;
      }

      // ---------- PAUSA (cualquier jugador, en partida) ----------
      if (msg.type === 'pause') {
        if (currentRoom.state !== 'playing' || currentRoom.paused) return;
        currentRoom.paused = true;
        currentRoom.pausedAt = Date.now();
        currentRoom.pausedBy = me.name;
        broadcast(currentRoom, { type: 'paused', by: me.name });
        return;
      }

      if (msg.type === 'resume_game') {
        if (currentRoom.state !== 'playing' || !currentRoom.paused) return;
        currentRoom.pausedMs += Date.now() - currentRoom.pausedAt;
        currentRoom.paused = false;
        currentRoom.pausedBy = '';
        broadcast(currentRoom, { type: 'unpaused', elapsedMs: Date.now() - currentRoom.startedAt - currentRoom.pausedMs });

        // Si alguien seguía desconectado al momento de reanudar, le damos
        // un margen fresco de 60s desde ahora (no se le cuenta el tiempo pausado).
        for (var rpid in currentRoom.players) {
          var rp2 = currentRoom.players[rpid];
          if (rp2.ws === null && !rp2.finished && !rp2.eliminated) {
            scheduleEliminationCheck(currentRoom, rpid);
          }
        }
        return;
      }

      // ---------- CAMBIAR MODO (solo host, en lobby) ----------
      if (msg.type === 'set_mode') {
        if (ws.playerId === currentRoom.hostId && currentRoom.state === 'lobby') {
          if (msg.mode === 'individual' || msg.mode === 'equipos') {
            currentRoom.mode = msg.mode;
            if (msg.mode === 'individual') {
              for (var pmid in currentRoom.players) currentRoom.players[pmid].team = null;
            }
            broadcastPlayers(currentRoom);
          }
        }
        return;
      }

      // ---------- ELEGIR EQUIPO (en lobby, modo equipos) ----------
      if (msg.type === 'set_team') {
        if (currentRoom.state !== 'lobby' || currentRoom.mode !== 'equipos') return;
        var wanted = msg.team === 'A' || msg.team === 'B' ? msg.team : null;
        if (!wanted) return;
        var enEquipo = 0;
        for (var tid in currentRoom.players) {
          if (currentRoom.players[tid].team === wanted && tid !== ws.playerId) enEquipo++;
        }
        if (enEquipo >= 2) {
          ws.send(JSON.stringify({ type: 'error', message: 'Ese equipo ya está completo (2 por equipo).' }));
          return;
        }
        me.team = wanted;
        broadcastPlayers(currentRoom);
        return;
      }

      // ---------- INICIAR PARTIDA (solo host) ----------
      if (msg.type === 'start') {
        if (ws.playerId !== currentRoom.hostId || currentRoom.state !== 'lobby') return;

        // Validación del modo equipos: exactamente 2 vs 2
        if (currentRoom.mode === 'equipos') {
          var cA = 0, cB = 0, sinEquipo = 0;
          for (var vid in currentRoom.players) {
            var vteam = currentRoom.players[vid].team;
            if (vteam === 'A') cA++;
            else if (vteam === 'B') cB++;
            else sinEquipo++;
          }
          if (cA !== 2 || cB !== 2 || sinEquipo > 0) {
            ws.send(JSON.stringify({ type: 'error', message: 'Para jugar 2 vs 2 se necesitan exactamente 4 jugadores, 2 en cada equipo.' }));
            return;
          }
        }

        game.setupGame(currentRoom);
        currentRoom.state = 'countdown';

        broadcast(currentRoom, { type: 'countdown', seconds: 3 });

        setTimeout(function () {
          if (!rooms[currentRoom.code]) return;
          currentRoom.state = 'playing';
          currentRoom.startedAt = Date.now();
          var payload = { type: 'game', difficulty: currentRoom.difficulty, mode: currentRoom.mode, options: currentRoom.options };
          var extra = game.gameStartPayload(currentRoom);
          for (var pk in extra) payload[pk] = extra[pk];
          broadcast(currentRoom, payload);
          broadcastPlayers(currentRoom);
        }, 3000);
        return;
      }

      // ---------- JUGADA ----------
      if (msg.type === 'move') {
        if (currentRoom.state !== 'playing' || currentRoom.paused) return;

        var entity;
        if (currentRoom.mode === 'equipos') {
          entity = currentRoom.teams && currentRoom.teams[me.team];
          if (!entity || entity.eliminated || entity.finished) return;
        } else {
          entity = me;
          if (entity.eliminated || entity.finished) return;
        }

        var result = game.applyMove(currentRoom, me, entity, msg);
        if (!result) return;

        ws.send(JSON.stringify(result.response));
        if (result.broadcastExtra) broadcast(currentRoom, result.broadcastExtra);

        broadcastPlayers(currentRoom);
        checkGameOver(currentRoom);
        return;
      }

      // ---------- REVANCHA (solo host, al terminar) ----------
      if (msg.type === 'rematch') {
        if (ws.playerId !== currentRoom.hostId || currentRoom.state !== 'finished') return;
        resetRoomForRematch(currentRoom);
        broadcast(currentRoom, { type: 'rematch', difficulty: currentRoom.difficulty });
        broadcastPlayers(currentRoom);
        return;
      }
    });

    ws.on('close', function () {
      var room = rooms[ws.roomCode];
      if (!room || !ws.playerId || !room.players[ws.playerId]) return;
      var pl = room.players[ws.playerId];
      if (pl.ws !== ws) return; // ya se reconectó con otro socket

      pl.ws = null;
      pl.disconnectedAt = Date.now();

      if (room.state === 'lobby') {
        // Gracia de 2 minutos: típico caso de salir a WhatsApp a compartir el código
        setTimeout(function () {
          var r = rooms[room.code];
          if (!r || !r.players[ws.playerId]) return;
          var p = r.players[ws.playerId];
          if (p.ws !== null) return; // ya volvió
          delete r.players[ws.playerId];
          if (ws.playerId === r.hostId) {
            var ids = Object.keys(r.players);
            var newHost = null;
            for (var i = 0; i < ids.length; i++) {
              if (r.players[ids[i]].ws) { newHost = ids[i]; break; }
            }
            if (newHost) r.hostId = newHost;
            else if (ids.length > 0) r.hostId = ids[0];
          }
          if (Object.keys(r.players).length === 0) {
            delete rooms[r.code];
          } else {
            broadcastPlayers(r);
          }
        }, 120000);
      } else if (room.state === 'playing' || room.state === 'countdown') {
        // Gracia de 60 segundos antes de darlo por eliminado (se congela si hay pausa)
        scheduleEliminationCheck(room, ws.playerId);
      }

      broadcastPlayers(room);
    });
  });

  // Keepalive del servidor cada 25 segundos (evita que Railway corte conexiones)
  setInterval(function () {
    wss.clients.forEach(function (ws) {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 25000);

  // Limpieza de salas viejas (más de 3 horas) cada 30 minutos
  setInterval(function () {
    var now = Date.now();
    for (var code in rooms) {
      if (now - rooms[code].createdAt > 3 * 60 * 60 * 1000) {
        delete rooms[code];
      }
    }
  }, 30 * 60 * 1000);

  return { app: app, server: server, wss: wss, rooms: rooms };
};
