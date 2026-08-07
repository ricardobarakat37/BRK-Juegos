# BRK Trivia

Juego de trivia familiar con preguntas en español, desarrollado por BRK Arte.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML/CSS/JS estático en GoDaddy (`brkarte.com/trivia/`) |
| Backend | Node.js + Express en Railway |
| Base de datos | MySQL en Railway |
| Traducción | Claude Haiku (Anthropic API) |
| Verificación de dato | Claude Sonnet (Anthropic API) |
| Preguntas fuente | Open Trivia DB (opentdb.com) |

## URLs

| Recurso | URL |
|---------|-----|
| Juego en producción | `brkarte.com/trivia/` |
| Servidor Railway | `https://trivia-production-c295.up.railway.app` |
| Health check | `https://trivia-production-c295.up.railway.app/` |
| Categorías disponibles | `https://trivia-production-c295.up.railway.app/categories` |
| Batch de preguntas | `https://trivia-production-c295.up.railway.app/batch` |
| Railway dashboard | `railway.app` |
| Créditos Anthropic | `console.anthropic.com/settings/billing` |

## Estructura del repositorio

```
trivia/
  server.js           ← servidor Node.js (Railway lo corre automáticamente)
  package.json
  .gitignore
  scripts/
    loadQuestions.js  ← script de carga y mantenimiento de preguntas
  .env                ← NO está en git, solo local
```

## Variables de entorno

Las variables sensibles se configuran en Railway (servicio `brk-trivia`) y en el archivo `.env` local. **Nunca subirlas a GitHub.**

| Variable | Descripción |
|----------|-------------|
| `DB_HOST` | Host de MySQL (referencia Railway: `${{MySQL.MYSQLHOST}}`) |
| `DB_PORT` | Puerto MySQL (`${{MySQL.MYSQLPORT}}`) |
| `DB_USER` | Usuario MySQL (`${{MySQL.MYSQLUSER}}`) |
| `DB_PASSWORD` | Password MySQL (`${{MySQL.MYSQLPASSWORD}}`) |
| `DB_NAME` | Nombre de la DB (`${{MySQL.MYSQLDATABASE}}`) |
| `ANTHROPIC_API_KEY` | API key de Anthropic (console.anthropic.com) |
| `ADMIN_KEY` | Clave para resetear historial de jugadas desde el juego |

### Archivo `.env` local (para correr scripts desde tu PC)

Crea `trivia/.env` con los valores reales (ver Railway → MySQL → Variables para los datos de conexión):

```
DB_HOST=turntable.proxy.rlwy.net
DB_PORT=30543
DB_USER=root
DB_PASSWORD=<ver Railway>
DB_NAME=railway
ANTHROPIC_API_KEY=<ver console.anthropic.com>
```

> El `.env` usa el host **público** de MySQL (`turntable.proxy.rlwy.net`) porque se corre desde tu PC. El servidor en Railway usa el host interno automáticamente vía las referencias `${{MySQL.*}}`.

## Comandos del script de preguntas

Todos se corren desde la carpeta `trivia/` en PowerShell:

```powershell
# Bajar preguntas nuevas de Open Trivia DB y traducirlas con Claude
node scripts/loadQuestions.js

# Borrar preguntas que quedaron en inglés (detector automático)
node scripts/loadQuestions.js --clean

# ⚠️ PELIGRO: borra TODAS las preguntas y jugadas. No usar salvo emergencia.
node scripts/loadQuestions.js --clear
```

> El script retoma automáticamente donde quedó — si lo interrumpes y lo vuelves a correr, solo descarga las preguntas que no estaban en la DB.

## Endpoints del servidor

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/categories` | Lista de categorías disponibles |
| GET | `/batch` | 10 preguntas aleatorias (acepta `?difficulties=easy,medium&categories=Historia\|Música&exclude=id1,id2`) |
| POST | `/played` | Marcar preguntas como jugadas (`{ ids: ["id1","id2"] }`) |
| POST | `/verify` | Verificar dato con Claude (`{ question: "...", answer: "..." }`) |
| POST | `/reset` | Borrar historial de jugadas (`{ adminKey: "..." }`) |

## SQL útil (Railway → MySQL → Query)

```sql
-- Total de preguntas en la DB
SELECT COUNT(*) FROM preguntas;

-- Preguntas jugadas
SELECT COUNT(*) FROM jugadas;

-- Categorías disponibles
SELECT DISTINCT category FROM preguntas ORDER BY category;

-- Ver preguntas en inglés que podrían quedar (preview del --clean)
SELECT id, question FROM preguntas
WHERE question REGEXP '^(Which|What|Who|How|When|Where|In which|According|True or false)'
AND question NOT REGEXP '[áéíóúñü¿¡]'
LIMIT 50;

-- Borrar historial de jugadas manualmente
DELETE FROM jugadas;
```

## Deploy

El servidor en Railway se redeploya automáticamente cada vez que haces push a GitHub. El frontend en GoDaddy hay que subirlo manualmente via el File Manager de cPanel.

## Categorías cargadas

| ID | Categoría | Estado |
|----|-----------|--------|
| 9 | General Knowledge | ✅ |
| 10 | Entertainment: Books | ✅ |
| 11 | Entertainment: Film | ✅ |
| 12 | Entertainment: Music | ✅ |
| 14 | Entertainment: Television | ✅ |
| 17 | Science & Nature | ✅ |
| 18 | Science: Computers | ✅ |
| 19 | Science: Mathematics | ✅ |
| 20 | Mythology | ✅ |
| 21 | Sports | ✅ |
| 22 | Geography | ✅ |
| 23 | History | ✅ |
| 24 | Politics | ✅ |
| 25 | Art | ✅ |
| 26 | Celebrities | ⚠️ Sin preguntas en Open Trivia DB |
| 27 | Animals | ✅ |
| 28 | Vehicles | ✅ |
| 30 | Science: Gadgets | ✅ |
| 32 | Entertainment: Cartoon & Animations | ✅ |
| 15 | Video Games | ❌ Excluida por preferencia |
| 29 | Comics | ❌ Excluida por preferencia |
| 31 | Anime & Manga | ❌ Excluida por preferencia |
