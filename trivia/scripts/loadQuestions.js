require('dotenv').config();
const mysql = require('mysql2/promise');
const axios = require('axios');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Categorías (sin anime, cómics ni videojuegos)
const CATEGORIES = [
  { id: 9,  name: 'General Knowledge' },
  { id: 10, name: 'Entertainment: Books' },
  { id: 11, name: 'Entertainment: Film' },
  { id: 12, name: 'Entertainment: Music' },
  { id: 14, name: 'Entertainment: Television' },
  { id: 17, name: 'Science & Nature' },
  { id: 18, name: 'Science: Computers' },
  { id: 19, name: 'Science: Mathematics' },
  { id: 20, name: 'Mythology' },
  { id: 21, name: 'Sports' },
  { id: 22, name: 'Geography' },
  { id: 23, name: 'History' },
  { id: 24, name: 'Politics' },
  { id: 25, name: 'Art' },
  { id: 26, name: 'Celebrities' },
  { id: 27, name: 'Animals' },
  { id: 28, name: 'Vehicles' },
  { id: 30, name: 'Science: Gadgets' },
  { id: 32, name: 'Entertainment: Cartoon & Animations' },
];

async function translateOne(text) {
  const prompt = `Translate this text from English to Spanish. Keep proper nouns, band names, song titles, movie titles, country names, and brand names in their original form or official Spanish name. Reply with ONLY the translation, nothing else:\n\n${text}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  return data.content?.[0]?.text?.trim() || text;
}

async function translateWithClaude(texts) {
  const results = [];
  for (const text of texts) {
    try {
      const translated = await translateOne(text);
      results.push(translated);
    } catch(e) {
      console.log('Error traduciendo:', e.message);
      results.push(text);
    }
    await sleep(100);
  }
  return results;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function createTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS preguntas (
      id VARCHAR(100) PRIMARY KEY,
      category VARCHAR(100),
      question TEXT,
      opt1 TEXT,
      opt2 TEXT,
      opt3 TEXT,
      opt4 TEXT,
      correct_index TINYINT,
      difficulty VARCHAR(10)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS jugadas (
      pregunta_id VARCHAR(100),
      played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (pregunta_id)
    )
  `);
  console.log('Tablas creadas OK');
}

async function loadCategory(cat) {
  console.log(`\n=== Categoría ${cat.id}: ${cat.name} ===`);

  const [existing] = await db.query('SELECT id FROM preguntas WHERE id LIKE ?', [`${cat.id}_%`]);
  const existingIds = new Set(existing.map(r => r.id));
  console.log(`Ya en DB: ${existingIds.size}`);

  let saved = 0;
  let emptyPages = 0;
  let page = 0;

  while (true) {
    await sleep(6000);
    try {
      const url = `https://opentdb.com/api.php?amount=50&category=${cat.id}&type=multiple&encode=url3986`;
      const res = await axios.get(url, { timeout: 15000 });
      const data = res.data;

      if (data.response_code !== 0 || !data.results?.length) break;

      const newOnes = [];
      for (const item of data.results) {
        const id = `${cat.id}_${encodeURIComponent(item.question).substring(0, 40)}`;
        if (existingIds.has(id)) continue;

        const correct = decodeURIComponent(item.correct_answer);
        const opts = [correct, ...item.incorrect_answers.map(a => decodeURIComponent(a))].sort(() => Math.random() - 0.5);
        newOnes.push({
          id,
          category: cat.name,
          question: decodeURIComponent(item.question),
          options: opts,
          correct: opts.indexOf(correct),
          difficulty: item.difficulty
        });
      }

      if (newOnes.length === 0) {
        emptyPages++;
        if (emptyPages >= 3) { console.log('3 páginas vacías, parando.'); break; }
        page++;
        continue;
      }
      emptyPages = 0;

      // Traducir con Claude en lotes de 10 preguntas (50 textos)
      const texts = [];
      newOnes.forEach(q => { texts.push(q.question); q.options.forEach(o => texts.push(o)); });

      let translated;
      try {
        translated = await translateWithClaude(texts);
      } catch (e) {
        console.log('Error traduciendo, guardando en inglés:', e.message);
        translated = texts;
      }

      let ti = 0;
      for (const q of newOnes) {
        q.question = translated[ti++] || q.question;
        q.options = [translated[ti++]||q.options[0], translated[ti++]||q.options[1], translated[ti++]||q.options[2], translated[ti++]||q.options[3]];

        await db.query(
          'INSERT IGNORE INTO preguntas (id, category, question, opt1, opt2, opt3, opt4, correct_index, difficulty) VALUES (?,?,?,?,?,?,?,?,?)',
          [q.id, q.category, q.question, q.options[0], q.options[1], q.options[2], q.options[3], q.correct, q.difficulty]
        );
        existingIds.add(q.id);
        saved++;
      }

      console.log(`Pág ${page} — guardadas: ${saved}`);
      page++;

    } catch (e) {
      console.log('Error:', e.message);
      break;
    }
  }

  console.log(`=== FIN ${cat.name}: ${saved} nuevas ===`);
  return saved;
}

async function clearAll() {
  await db.query('DELETE FROM jugadas');
  await db.query('DELETE FROM preguntas');
  console.log('🗑️  Base de datos limpiada');
}

async function main() {
  const args = process.argv.slice(2);
  await createTable();

  if (args.includes('--clear')) {
    await clearAll();
    process.exit(0);
  }

  let total = 0;
  for (const cat of CATEGORIES) {
    total += await loadCategory(cat);
  }
  console.log(`\n✅ TOTAL CARGADAS: ${total}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
