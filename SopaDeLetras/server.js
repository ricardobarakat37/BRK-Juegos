// ============================================================
// SOPA DE LETRAS BATTLE - Backend BRK Arte
// Railway: Node.js + Express + WebSocket (ws)
// ============================================================

var createGameServer = require('./core/rooms');
var sopaGame = require('./sopadeletras');

var built = createGameServer(sopaGame);

var PORT = process.env.PORT || 3000;
built.server.listen(PORT, function () {
  console.log('Sopa de Letras Battle backend corriendo en puerto ' + PORT);
});
