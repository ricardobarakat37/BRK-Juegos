// ============================================================
// SUDOKU BATTLE - Backend BRK Arte
// Railway: Node.js + Express + WebSocket (ws)
//
// Este archivo ya no tiene reglas de sudoku ni lógica de salas —
// solo conecta el núcleo genérico (core/rooms.js) con el módulo
// de este juego (sudoku.js) y arranca el servidor.
// ============================================================

var createGameServer = require('./core/rooms');
var sudokuGame = require('./sudoku');

var built = createGameServer(sudokuGame);

var PORT = process.env.PORT || 3000;
built.server.listen(PORT, function () {
  console.log('Sudoku Battle backend corriendo en puerto ' + PORT);
});
