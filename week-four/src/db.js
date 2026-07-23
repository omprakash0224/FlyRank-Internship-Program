const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.join(__dirname, '..', 'tasks.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create the tasks table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT 0
    )`, (err) => {
      if (err) {
        console.error('Error creating table', err.message);
      } else {
        // Check if table is empty, if so, insert three example tasks
        db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
          if (err) {
            console.error('Error checking row count', err.message);
          } else if (row.count === 0) {
            console.log('Table is empty. Inserting example tasks...');
            const insert = 'INSERT INTO tasks (title, done) VALUES (?, ?)';
            db.run(insert, ['Learn SQLite', 0]);
            db.run(insert, ['Build CRUD API', 0]);
            db.run(insert, ['Deploy application', 0]);
          }
        });
      }
    });
  }
});

module.exports = db;
