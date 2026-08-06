// ============================================================
// BANCO DE PALABRAS - EL IMPOSTOR
// 300 parejas de palabras relacionadas pero distinguibles, en
// español nativo, organizadas por categoría. Igual que con
// BRK Trivia: escritas directo, sin traducción automática.
//
// Sistema de "mazo sin repetición" (shuffle bag): en vez de
// elegir una pareja al azar cada vez (lo que sí puede repetir
// por pura suerte), se baraja la lista completa una sola vez y
// se van sacando en orden. Solo cuando se agotan las 300 se
// vuelve a barajar todo desde cero. Garantiza que no se repita
// ninguna pareja hasta haber pasado por las 300.
// ============================================================

var PAREJAS = [
  // ---- Comida y bebidas ----
  ['SAL', 'AZÚCAR', 'Comida'], ['CAFÉ', 'TÉ', 'Comida'], ['PAN', 'AREPA', 'Comida'],
  ['PIZZA', 'LASAÑA', 'Comida'], ['HAMBURGUESA', 'HOT DOG', 'Comida'], ['LIMÓN', 'NARANJA', 'Comida'],
  ['MANZANA', 'PERA', 'Comida'], ['FRESA', 'CEREZA', 'Comida'], ['LECHE', 'YOGUR', 'Comida'],
  ['QUESO', 'MANTEQUILLA', 'Comida'], ['VINO', 'CERVEZA', 'Comida'], ['ARROZ', 'PASTA', 'Comida'],
  ['SOPA', 'CALDO', 'Comida'], ['TACO', 'BURRITO', 'Comida'], ['HELADO', 'PALETA', 'Comida'],
  ['CHOCOLATE', 'VAINILLA', 'Comida'], ['MIEL', 'MERMELADA', 'Comida'], ['HUEVO', 'TOCINO', 'Comida'],
  ['PAPA', 'YUCA', 'Comida'], ['ENSALADA', 'GUACAMOLE', 'Comida'], ['GALLETA', 'PONQUÉ', 'Comida'],
  ['JUGO', 'GASEOSA', 'Comida'], ['SANDÍA', 'MELÓN', 'Comida'], ['POLLO', 'PAVO', 'Comida'],
  ['CAMARÓN', 'PESCADO', 'Comida'],

  // ---- Animales ----
  ['PERRO', 'GATO', 'Animales'], ['LEÓN', 'TIGRE', 'Animales'], ['CABALLO', 'BURRO', 'Animales'],
  ['VACA', 'TORO', 'Animales'], ['OSO', 'PANDA', 'Animales'], ['LOBO', 'ZORRO', 'Animales'],
  ['ÁGUILA', 'HALCÓN', 'Animales'], ['DELFÍN', 'BALLENA', 'Animales'], ['RANA', 'SAPO', 'Animales'],
  ['TORTUGA', 'CARACOL', 'Animales'], ['MONO', 'GORILA', 'Animales'], ['CONEJO', 'LIEBRE', 'Animales'],
  ['PATO', 'GANSO', 'Animales'], ['ABEJA', 'AVISPA', 'Animales'], ['ARAÑA', 'ESCORPIÓN', 'Animales'],
  ['ELEFANTE', 'RINOCERONTE', 'Animales'], ['SERPIENTE', 'LAGARTIJA', 'Animales'], ['BÚHO', 'LECHUZA', 'Animales'],
  ['CANGURO', 'KOALA', 'Animales'], ['PINGÜINO', 'FOCA', 'Animales'], ['JIRAFA', 'CEBRA', 'Animales'],
  ['HORMIGA', 'TERMITA', 'Animales'], ['MARIPOSA', 'POLILLA', 'Animales'], ['LORO', 'CACATÚA', 'Animales'],
  ['CIERVO', 'ALCE', 'Animales'],

  // ---- Profesiones y oficios ----
  ['MÉDICO', 'ENFERMERA', 'Oficios'], ['PROFESOR', 'ESTUDIANTE', 'Oficios'], ['POLICÍA', 'BOMBERO', 'Oficios'],
  ['ABOGADO', 'JUEZ', 'Oficios'], ['CHEF', 'MESERO', 'Oficios'], ['PILOTO', 'AZAFATA', 'Oficios'],
  ['PINTOR', 'ESCULTOR', 'Oficios'], ['CANTANTE', 'MÚSICO', 'Oficios'], ['ACTOR', 'DIRECTOR', 'Oficios'],
  ['PANADERO', 'CARNICERO', 'Oficios'], ['PLOMERO', 'ELECTRICISTA', 'Oficios'], ['PERIODISTA', 'ESCRITOR', 'Oficios'],
  ['ARQUITECTO', 'INGENIERO', 'Oficios'], ['PELUQUERO', 'ESTILISTA', 'Oficios'], ['GRANJERO', 'PESCADOR', 'Oficios'],
  ['VETERINARIO', 'BIÓLOGO', 'Oficios'], ['SASTRE', 'DISEÑADOR', 'Oficios'], ['TAXISTA', 'CONDUCTOR', 'Oficios'],
  ['DENTISTA', 'CIRUJANO', 'Oficios'], ['FOTÓGRAFO', 'CAMARÓGRAFO', 'Oficios'], ['CONTADOR', 'BANQUERO', 'Oficios'],
  ['SOLDADO', 'GUARDIA', 'Oficios'], ['MAGO', 'PAYASO', 'Oficios'], ['ENTRENADOR', 'ÁRBITRO', 'Oficios'],
  ['JARDINERO', 'AGRICULTOR', 'Oficios'],

  // ---- Lugares ----
  ['PLAYA', 'PISCINA', 'Lugares'], ['MONTAÑA', 'COLINA', 'Lugares'], ['CIUDAD', 'PUEBLO', 'Lugares'],
  ['ESCUELA', 'UNIVERSIDAD', 'Lugares'], ['HOSPITAL', 'CLÍNICA', 'Lugares'], ['IGLESIA', 'CATEDRAL', 'Lugares'],
  ['RESTAURANTE', 'CAFETERÍA', 'Lugares'], ['BIBLIOTECA', 'MUSEO', 'Lugares'], ['PARQUE', 'JARDÍN', 'Lugares'],
  ['AEROPUERTO', 'ESTACIÓN', 'Lugares'], ['HOTEL', 'HOSTAL', 'Lugares'], ['MERCADO', 'SUPERMERCADO', 'Lugares'],
  ['DESIERTO', 'SABANA', 'Lugares'], ['RÍO', 'LAGO', 'Lugares'], ['BOSQUE', 'SELVA', 'Lugares'],
  ['ISLA', 'PENÍNSULA', 'Lugares'], ['ESTADIO', 'CANCHA', 'Lugares'], ['TEATRO', 'CINE', 'Lugares'],
  ['CASTILLO', 'PALACIO', 'Lugares'], ['GRANJA', 'RANCHO', 'Lugares'], ['VOLCÁN', 'CRÁTER', 'Lugares'],
  ['PUENTE', 'TÚNEL', 'Lugares'], ['ZOOLÓGICO', 'ACUARIO', 'Lugares'], ['CÁRCEL', 'PRISIÓN', 'Lugares'],
  ['FÁBRICA', 'TALLER', 'Lugares'],

  // ---- Objetos del hogar ----
  ['MESA', 'ESCRITORIO', 'Hogar'], ['SILLA', 'BANCO', 'Hogar'], ['CAMA', 'SOFÁ', 'Hogar'],
  ['ESPEJO', 'VENTANA', 'Hogar'], ['LÁMPARA', 'VELA', 'Hogar'], ['RELOJ', 'CALENDARIO', 'Hogar'],
  ['CUCHILLO', 'TIJERAS', 'Hogar'], ['TENEDOR', 'CUCHARA', 'Hogar'], ['OLLA', 'SARTÉN', 'Hogar'],
  ['TOALLA', 'SÁBANA', 'Hogar'], ['ALMOHADA', 'COBIJA', 'Hogar'], ['ESCOBA', 'TRAPEADOR', 'Hogar'],
  ['LLAVE', 'CANDADO', 'Hogar'], ['MALETA', 'MOCHILA', 'Hogar'], ['PARAGUAS', 'SOMBRILLA', 'Hogar'],
  ['RADIO', 'TELEVISOR', 'Hogar'], ['NEVERA', 'CONGELADOR', 'Hogar'], ['ARMARIO', 'CLÓSET', 'Hogar'],
  ['CORTINA', 'PERSIANA', 'Hogar'], ['ALFOMBRA', 'TAPETE', 'Hogar'], ['MANTEL', 'SERVILLETA', 'Hogar'],
  ['VASO', 'COPA', 'Hogar'], ['PLATO', 'BANDEJA', 'Hogar'], ['JABÓN', 'CHAMPÚ', 'Hogar'],
  ['CEPILLO', 'PEINE', 'Hogar'],

  // ---- Deportes ----
  ['FÚTBOL', 'BALONCESTO', 'Deportes'], ['TENIS', 'BÁDMINTON', 'Deportes'], ['NATACIÓN', 'BUCEO', 'Deportes'],
  ['BOXEO', 'KARATE', 'Deportes'], ['CICLISMO', 'ATLETISMO', 'Deportes'], ['GOLF', 'BOLICHE', 'Deportes'],
  ['VOLEIBOL', 'BALONMANO', 'Deportes'], ['BÉISBOL', 'SÓFTBOL', 'Deportes'], ['ESQUÍ', 'SNOWBOARD', 'Deportes'],
  ['SURF', 'PATINAJE', 'Deportes'], ['RUGBY', 'FÚTBOL AMERICANO', 'Deportes'], ['GIMNASIA', 'YOGA', 'Deportes'],
  ['ESGRIMA', 'JUDO', 'Deportes'], ['REMO', 'KAYAK', 'Deportes'], ['ESCALADA', 'SENDERISMO', 'Deportes'],
  ['PING PONG', 'BILLAR', 'Deportes'], ['MARATÓN', 'TRIATLÓN', 'Deportes'], ['LUCHA', 'TAEKWONDO', 'Deportes'],
  ['HOCKEY', 'CURLING', 'Deportes'], ['ARQUERÍA', 'TIRO', 'Deportes'], ['CROSSFIT', 'PESAS', 'Deportes'],
  ['EQUITACIÓN', 'POLO', 'Deportes'], ['MOTOCROSS', 'AUTOMOVILISMO', 'Deportes'], ['VELA', 'CANOTAJE', 'Deportes'],
  ['HALTEROFILIA', 'CALISTENIA', 'Deportes'],

  // ---- Tecnología ----
  ['CELULAR', 'TABLET', 'Tecnología'], ['COMPUTADORA', 'LAPTOP', 'Tecnología'], ['INTERNET', 'WIFI', 'Tecnología'],
  ['EMAIL', 'MENSAJE', 'Tecnología'], ['FACEBOOK', 'INSTAGRAM', 'Tecnología'], ['WHATSAPP', 'TELEGRAM', 'Tecnología'],
  ['NETFLIX', 'YOUTUBE', 'Tecnología'], ['TECLADO', 'MOUSE', 'Tecnología'], ['IMPRESORA', 'ESCÁNER', 'Tecnología'],
  ['AURICULARES', 'PARLANTES', 'Tecnología'], ['CÁMARA', 'VIDEOCÁMARA', 'Tecnología'], ['BATERÍA', 'CARGADOR', 'Tecnología'],
  ['SOFTWARE', 'APLICACIÓN', 'Tecnología'], ['ROBOT', 'DRON', 'Tecnología'], ['VIDEOJUEGO', 'CONSOLA', 'Tecnología'],
  ['BLUETOOTH', 'USB', 'Tecnología'], ['CONTRASEÑA', 'PIN', 'Tecnología'], ['NUBE', 'SERVIDOR', 'Tecnología'],
  ['PANTALLA', 'MONITOR', 'Tecnología'], ['SATÉLITE', 'ANTENA', 'Tecnología'], ['CHIP', 'PROCESADOR', 'Tecnología'],
  ['ROUTER', 'MÓDEM', 'Tecnología'], ['GPS', 'MAPA', 'Tecnología'], ['REALIDAD VIRTUAL', 'REALIDAD AUMENTADA', 'Tecnología'],
  ['INTELIGENCIA ARTIFICIAL', 'ROBÓTICA', 'Tecnología'],

  // ---- Cuerpo humano y salud ----
  ['CORAZÓN', 'PULMÓN', 'Salud'], ['CEREBRO', 'MÉDULA', 'Salud'], ['HUESO', 'MÚSCULO', 'Salud'],
  ['SANGRE', 'VENA', 'Salud'], ['PIEL', 'CABELLO', 'Salud'], ['OJO', 'OREJA', 'Salud'],
  ['NARIZ', 'BOCA', 'Salud'], ['MANO', 'PIE', 'Salud'], ['BRAZO', 'PIERNA', 'Salud'],
  ['DEDO', 'UÑA', 'Salud'], ['FIEBRE', 'GRIPE', 'Salud'], ['DOLOR', 'MOLESTIA', 'Salud'],
  ['VACUNA', 'MEDICINA', 'Salud'], ['CIRUGÍA', 'OPERACIÓN', 'Salud'], ['RADIOGRAFÍA', 'ECOGRAFÍA', 'Salud'],
  ['VITAMINA', 'PROTEÍNA', 'Salud'], ['ALERGIA', 'INFECCIÓN', 'Salud'], ['ESTRÉS', 'ANSIEDAD', 'Salud'],
  ['INSOMNIO', 'CANSANCIO', 'Salud'], ['TERAPIA', 'CONSULTA', 'Salud'], ['VENDAJE', 'CURITA', 'Salud'],
  ['PASTILLA', 'JARABE', 'Salud'], ['TERMÓMETRO', 'BALANZA', 'Salud'], ['SILLA DE RUEDAS', 'MULETAS', 'Salud'],
  ['MASCARILLA', 'GUANTES', 'Salud'],

  // ---- Transporte ----
  ['CARRO', 'MOTO', 'Transporte'], ['BUS', 'BUSETA', 'Transporte'], ['AVIÓN', 'HELICÓPTERO', 'Transporte'],
  ['BARCO', 'LANCHA', 'Transporte'], ['TREN', 'METRO', 'Transporte'], ['BICICLETA', 'PATINETA', 'Transporte'],
  ['TAXI', 'UBER', 'Transporte'], ['CAMIÓN', 'TRACTOMULA', 'Transporte'], ['AMBULANCIA', 'PATRULLA', 'Transporte'],
  ['SUBMARINO', 'YATE', 'Transporte'], ['COHETE', 'NAVE ESPACIAL', 'Transporte'], ['CARRETA', 'CARRUAJE', 'Transporte'],
  ['TELEFÉRICO', 'FUNICULAR', 'Transporte'], ['MONOPATÍN', 'PATINES', 'Transporte'], ['TRACTOR', 'EXCAVADORA', 'Transporte'],
  ['GLOBO AEROSTÁTICO', 'PARAPENTE', 'Transporte'], ['FERRY', 'CRUCERO', 'Transporte'], ['CAMIONETA', 'FURGONETA', 'Transporte'],
  ['LIMUSINA', 'CARRO DEPORTIVO', 'Transporte'], ['CANOA', 'KAYAK', 'Transporte'], ['SEGWAY', 'PATINETA ELÉCTRICA', 'Transporte'],
  ['GRÚA', 'MONTACARGAS', 'Transporte'], ['VAGÓN', 'LOCOMOTORA', 'Transporte'], ['CARRO DE BOMBEROS', 'CAMIÓN DE BASURA', 'Transporte'],
  ['TRINEO', 'MOTONIEVE', 'Transporte'],

  // ---- Naturaleza ----
  ['LLUVIA', 'GRANIZO', 'Naturaleza'], ['TRUENO', 'RELÁMPAGO', 'Naturaleza'], ['NUBE', 'NIEBLA', 'Naturaleza'],
  ['SOL', 'LUNA', 'Naturaleza'], ['ESTRELLA', 'COMETA', 'Naturaleza'], ['VOLCÁN', 'TERREMOTO', 'Naturaleza'],
  ['HURACÁN', 'TORNADO', 'Naturaleza'], ['NIEVE', 'HIELO', 'Naturaleza'], ['ARCOÍRIS', 'AURORA BOREAL', 'Naturaleza'],
  ['ÁRBOL', 'ARBUSTO', 'Naturaleza'], ['FLOR', 'HOJA', 'Naturaleza'], ['PIEDRA', 'ROCA', 'Naturaleza'],
  ['ARENA', 'TIERRA', 'Naturaleza'], ['OLA', 'MAREA', 'Naturaleza'], ['GLACIAR', 'ICEBERG', 'Naturaleza'],
  ['DESIERTO', 'OASIS', 'Naturaleza'], ['CASCADA', 'MANANTIAL', 'Naturaleza'], ['VIENTO', 'BRISA', 'Naturaleza'],
  ['ECLIPSE', 'EQUINOCCIO', 'Naturaleza'], ['MAREMOTO', 'TSUNAMI', 'Naturaleza'], ['SEQUÍA', 'INUNDACIÓN', 'Naturaleza'],
  ['CUEVA', 'CAVERNA', 'Naturaleza'], ['PANTANO', 'HUMEDAL', 'Naturaleza'], ['ARRECIFE', 'CORAL', 'Naturaleza'],
  ['ATARDECER', 'AMANECER', 'Naturaleza'],

  // ---- Entretenimiento y cultura ----
  ['PELÍCULA', 'SERIE', 'Entretenimiento'], ['LIBRO', 'REVISTA', 'Entretenimiento'], ['CANCIÓN', 'POEMA', 'Entretenimiento'],
  ['BAILE', 'CANTO', 'Entretenimiento'], ['PINTURA', 'DIBUJO', 'Entretenimiento'], ['TEATRO', 'ÓPERA', 'Entretenimiento'],
  ['CIRCO', 'CARNAVAL', 'Entretenimiento'], ['CONCIERTO', 'FESTIVAL', 'Entretenimiento'], ['VIDEOJUEGO', 'JUEGO DE MESA', 'Entretenimiento'],
  ['CHISTE', 'ANÉCDOTA', 'Entretenimiento'], ['FIESTA', 'CELEBRACIÓN', 'Entretenimiento'], ['DISFRAZ', 'MÁSCARA', 'Entretenimiento'],
  ['MAGIA', 'ILUSIONISMO', 'Entretenimiento'], ['COMEDIA', 'DRAMA', 'Entretenimiento'], ['NOVELA', 'CUENTO', 'Entretenimiento'],
  ['GUITARRA', 'VIOLÍN', 'Entretenimiento'], ['PIANO', 'ACORDEÓN', 'Entretenimiento'], ['TAMBOR', 'BATERÍA', 'Entretenimiento'],
  ['SALSA', 'MERENGUE', 'Entretenimiento'], ['VALLENATO', 'CUMBIA', 'Entretenimiento'], ['TANGO', 'FLAMENCO', 'Entretenimiento'],
  ['ÓPERA', 'MUSICAL', 'Entretenimiento'], ['CRUCIGRAMA', 'SOPA DE LETRAS', 'Entretenimiento'], ['RIFA', 'LOTERÍA', 'Entretenimiento'],
  ['PARQUE DE DIVERSIONES', 'FERIA', 'Entretenimiento'],

  // ---- Ropa y accesorios ----
  ['CAMISA', 'CAMISETA', 'Ropa'], ['PANTALÓN', 'FALDA', 'Ropa'], ['ZAPATO', 'SANDALIA', 'Ropa'],
  ['CHAQUETA', 'ABRIGO', 'Ropa'], ['GORRA', 'SOMBRERO', 'Ropa'], ['BUFANDA', 'PAÑUELO', 'Ropa'],
  ['GUANTES', 'MEDIAS', 'Ropa'], ['CINTURÓN', 'CORBATA', 'Ropa'], ['VESTIDO', 'BLUSA', 'Ropa'],
  ['RELOJ', 'PULSERA', 'Ropa'], ['ANILLO', 'COLLAR', 'Ropa'], ['ARETE', 'GARGANTILLA', 'Ropa'],
  ['BOLSO', 'CARTERA', 'Ropa'], ['LENTES', 'GAFAS DE SOL', 'Ropa'], ['BOTA', 'TENIS', 'Ropa'],
  ['PIJAMA', 'BATA', 'Ropa'], ['TRAJE DE BAÑO', 'BIKINI', 'Ropa'], ['UNIFORME', 'DISFRAZ', 'Ropa'],
  ['CORONA', 'DIADEMA', 'Ropa'], ['MOCHILA', 'MALETÍN', 'Ropa'], ['PARAGUAS', 'IMPERMEABLE', 'Ropa'],
  ['CACHUCHA', 'BOINA', 'Ropa'], ['CHALECO', 'SUÉTER', 'Ropa'], ['MEDIAS', 'CALCETINES', 'Ropa'],
  ['TACONES', 'ZAPATILLAS', 'Ropa']
];

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ---- Mazo sin repetición (vive en memoria del servidor, compartido entre todas las salas) ----
var mazo = [];

function siguienteParPalabras() {
  if (mazo.length === 0) {
    mazo = shuffle(PAREJAS);
  }
  var siguiente = mazo.pop();
  return { palabraA: siguiente[0], palabraB: siguiente[1], categoria: siguiente[2] };
}

module.exports = {
  total: PAREJAS.length,
  siguienteParPalabras: siguienteParPalabras
};
