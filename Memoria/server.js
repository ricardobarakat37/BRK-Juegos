// ============================================================
// MEMORIA BATTLE - Backend BRK Arte
// Railway: Node.js + Express + WebSocket (ws)
//
// Igual que Sudoku Battle: este archivo solo conecta el núcleo
// genérico (core/rooms.js) con el módulo de este juego (memoria.js).
// ============================================================

var createGameServer = require('./core/rooms');
var memoriaGame = require('./memoria');

var built = createGameServer(memoriaGame);

var PORT = process.env.PORT || 3000;
built.server.listen(PORT, function () {
  console.log('Memoria Battle backend corriendo en puerto ' + PORT);
});
