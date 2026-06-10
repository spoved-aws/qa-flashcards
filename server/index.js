const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/cards.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Init DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cards (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed default data if empty
const count = db.prepare('SELECT COUNT(*) as n FROM cards').get();
if (count.n === 0) {
  const DOTS = ['#7F77DD','#1D9E75','#D85A30','#378ADD','#BA7517','#D4537E'];
  const defaults = [
    {
      cat: 'Technical', color: DOTS[0], cards: [
        { q: 'What is the difference between a process and a thread?', a: 'A process is an independent program in execution with its own memory space. A thread is a lighter-weight unit of execution that shares memory with other threads inside the same process.' },
        { q: 'Explain RESTful API principles.', a: 'REST APIs use stateless client-server communication over HTTP. Key constraints: statelessness, uniform interface (standard HTTP verbs), resource-based URLs, and cacheable responses.' },
        { q: 'What is Big-O notation?', a: "A notation that describes the upper bound of an algorithm's time or space complexity as input size grows. O(1) = constant, O(n) = linear, O(n²) = quadratic, etc." },
      ]
    },
    {
      cat: 'Behavioral', color: DOTS[1], cards: [
        { q: 'Tell me about a time you resolved a conflict with a coworker.', a: 'Use the STAR method: describe the Situation, your Task, the Action you took, and the Result. Focus on listening, finding common ground, and a constructive outcome.' },
        { q: 'How do you handle tight deadlines?', a: 'Explain how you prioritize tasks, communicate early when risks arise, break work into milestones, and stay focused under pressure. Give a concrete example.' },
      ]
    },
    {
      cat: 'System Design', color: DOTS[2], cards: [
        { q: 'How would you design a URL shortener?', a: 'Key components: hash function (e.g. base62), key-value store mapping short→long URL, redirect service (301 vs 302), CDN for speed, analytics pipeline, and rate limiting to prevent abuse.' },
        { q: 'What is horizontal vs vertical scaling?', a: 'Vertical scaling = adding more power (CPU, RAM) to one machine. Horizontal scaling = adding more machines. Horizontal is preferred for large-scale distributed systems due to fault tolerance.' },
      ]
    },
  ];

  const insertCat  = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  const insertCard = db.prepare('INSERT INTO cards (category_id, question, answer) VALUES (?, ?, ?)');

  const seedAll = db.transaction(() => {
    for (const group of defaults) {
      const { lastInsertRowid: catId } = insertCat.run(group.cat, group.color);
      for (const c of group.cards) insertCard.run(catId, c.q, c.a);
    }
  });
  seedAll();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── GET /api/cards  →  all categories + their cards ──────────────────────────
app.get('/api/cards', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
  const cards      = db.prepare('SELECT * FROM cards ORDER BY created_at').all();

  const result = categories.map(cat => ({
    ...cat,
    cards: cards.filter(c => c.category_id === cat.id),
  }));
  res.json(result);
});

// ── POST /api/categories  →  create category ─────────────────────────────────
app.post('/api/categories', (req, res) => {
  const { name, color } = req.body;
  if (!name || !color) return res.status(400).json({ error: 'name and color required' });
  try {
    const { lastInsertRowid } = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name, color);
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists' });
    throw e;
  }
});

// ── DELETE /api/categories/:id  →  delete category + its cards ───────────────
app.delete('/api/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/cards  →  create card ──────────────────────────────────────────
app.post('/api/cards', (req, res) => {
  const { category_id, question, answer } = req.body;
  if (!category_id || !question || !answer)
    return res.status(400).json({ error: 'category_id, question, and answer required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO cards (category_id, question, answer) VALUES (?, ?, ?)'
  ).run(category_id, question, answer);
  res.json(db.prepare('SELECT * FROM cards WHERE id = ?').get(lastInsertRowid));
});

// ── PUT /api/cards/:id  →  edit card ─────────────────────────────────────────
app.put('/api/cards/:id', (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
  db.prepare('UPDATE cards SET question = ?, answer = ? WHERE id = ?')
    .run(question, answer, req.params.id);
  res.json(db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id));
});

// ── DELETE /api/cards/:id  →  delete card ────────────────────────────────────
app.delete('/api/cards/:id', (req, res) => {
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Q&A server running on port ${PORT}  |  DB: ${DB_PATH}`));
