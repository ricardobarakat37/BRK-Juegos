require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ---- Health check ----
app.get('/', (req, res) => {
  res.json({ status: 'BRK Trivia OK' });
});

// ---- Obtener categorías disponibles ----
app.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT DISTINCT category FROM preguntas ORDER BY category'
    );
    res.json({ categories: rows.map(r => r.category) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Obtener batch de preguntas ----
app.get('/batch', async (req, res) => {
  try {
    const difficulties = req.query.difficulties ? req.query.difficulties.split(',') : ['easy', 'medium', 'hard'];
    const categories = req.query.categories ? req.query.categories.split('|') : [];
    const exclude = req.query.exclude ? req.query.exclude.split(',').filter(Boolean) : [];

    let query = `
      SELECT p.* FROM preguntas p
      LEFT JOIN jugadas j ON p.id = j.pregunta_id
      WHERE j.pregunta_id IS NULL
    `;
    const params = [];

    if (difficulties.length > 0) {
      query += ` AND (p.difficulty IN (${difficulties.map(() => '?').join(',')}) OR p.difficulty IS NULL OR p.difficulty = '')`;
      params.push(...difficulties);
    }

    if (categories.length > 0) {
      query += ` AND p.category IN (${categories.map(() => '?').join(',')})`;
      params.push(...categories);
    }

    if (exclude.length > 0) {
      query += ` AND p.id NOT IN (${exclude.map(() => '?').join(',')})`;
      params.push(...exclude);
    }

    query += ' ORDER BY RAND() LIMIT 10';

    let [rows] = await db.query(query, params);

    // Si no hay preguntas con esos filtros, ignorar jugadas y buscar de nuevo
    if (rows.length === 0) {
      let q2 = 'SELECT * FROM preguntas WHERE 1=1';
      const p2 = [];
      if (difficulties.length > 0) {
        q2 += ` AND (difficulty IN (${difficulties.map(() => '?').join(',')}) OR difficulty IS NULL OR difficulty = '')`;
        p2.push(...difficulties);
      }
      if (categories.length > 0) {
        q2 += ` AND category IN (${categories.map(() => '?').join(',')})`;
        p2.push(...categories);
      }
      q2 += ' ORDER BY RAND() LIMIT 10';
      [rows] = await db.query(q2, p2);
    }

    const questions = rows.map(r => ({
      id: r.id,
      category: r.category,
      question: r.question,
      options: [r.opt1, r.opt2, r.opt3, r.opt4],
      correct: r.correct_index,
      difficulty: r.difficulty || ''
    }));

    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM preguntas');
    const [[{ played }]] = await db.query('SELECT COUNT(*) as played FROM jugadas');

    res.json({ questions, total, played });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Marcar preguntas como jugadas ----
app.post('/played', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.json({ success: true });
    const values = ids.map(id => [id]);
    await db.query(
      'INSERT IGNORE INTO jugadas (pregunta_id) VALUES ?',
      [values]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Verificar dato con Claude ----
app.post('/verify', async (req, res) => {
  try {
    const { question, answer } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `En un juego de trivia salió esta pregunta: "${question}"\nLa respuesta correcta es: "${answer}"\n\nExplica en 3 oraciones en español por qué esa es la respuesta correcta. La primera debe confirmar la respuesta y dar contexto. La segunda debe explicar el porqué con detalle. La tercera debe añadir un dato curioso relacionado. Sin markdown, solo texto corrido.`
        }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || 'No se pudo obtener la verificación.';
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Reset jugadas ----
app.post('/reset', async (req, res) => {
  try {
    await db.query('DELETE FROM jugadas');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BRK Trivia corriendo en puerto ${PORT}`));
