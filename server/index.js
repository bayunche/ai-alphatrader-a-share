
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Initialize DB
const db = new sqlite3.Database('./database.sqlite');

// Initialize Schema
const schema = fs.readFileSync('./server/schema.sql', 'utf8');
db.exec(schema, (err) => {
  if (err) console.error("DB Schema Error:", err);
  else console.log("Database initialized.");
});

// --- Routes ---

// Login / Get User
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!row) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: row });
  });
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { username } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  
  db.run('INSERT INTO users (id, username) VALUES (?, ?)', [id, username], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: 'Username exists' });
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, data: { id, username } });
  });
});

// Load Workspace
app.get('/api/workspace/:userId', (req, res) => {
  const { userId } = req.params;
  db.get('SELECT data FROM workspaces WHERE user_id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    
    if (!row) {
      return res.json({ success: true, data: null }); // No saved workspace yet
    }
    try {
      res.json({ success: true, data: JSON.parse(row.data) });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Corrupt data' });
    }
  });
});

// Save Workspace
app.post('/api/workspace', (req, res) => {
  const { userId, data } = req.body;
  const jsonStr = JSON.stringify(data);
  
  db.run(`INSERT INTO workspaces (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP`,
    [userId, jsonStr], (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
