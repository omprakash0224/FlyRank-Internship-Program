const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /tasks — list all tasks
router.get('/', (req, res) => {
  db.all('SELECT * FROM tasks', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    const allTasks = rows.map(t => ({ ...t, done: t.done === 1 }));
    res.json(allTasks);
  });
});

// GET /tasks/:id — get one task
router.get('/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  
  db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (!row) {
      return res.status(404).json({ error: `Task ${taskId} not found` });
    }
    res.json({ ...row, done: row.done === 1 });
  });
});

// POST /tasks — create a task
router.post('/', (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }

  db.run('INSERT INTO tasks (title, done) VALUES (?, ?)', [title.trim(), 0], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    const newTask = { id: this.lastID, title: title.trim(), done: false };
    res.status(201).json(newTask);
  });
});

// PUT /tasks/:id — update title and/or done
router.put('/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  
  db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: 'Internal Server Error' });
    if (!task) return res.status(404).json({ error: `Task ${taskId} not found` });

    const { title, done } = req.body;
    const hasTitle = title !== undefined;
    const hasDone  = done  !== undefined;

    if (!hasTitle && !hasDone) {
      return res.status(400).json({ error: 'Request body must include at least one of: title, done' });
    }

    if (hasTitle && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }

    if (hasDone && typeof done !== 'boolean') {
      return res.status(400).json({ error: 'done must be a boolean' });
    }

    const newTitle = hasTitle ? title.trim() : task.title;
    const newDone  = hasDone ? (done ? 1 : 0) : task.done;

    db.run('UPDATE tasks SET title = ?, done = ? WHERE id = ?', [newTitle, newDone, taskId], function(err) {
      if (err) return res.status(500).json({ error: 'Internal Server Error' });
      res.json({ id: taskId, title: newTitle, done: newDone === 1 });
    });
  });
});

// DELETE /tasks/:id — remove a task
router.delete('/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  
  db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
    if (err) return res.status(500).json({ error: 'Internal Server Error' });
    
    if (this.changes === 0) {
      return res.status(404).json({ error: `Task ${taskId} not found` });
    }
    
    res.status(204).send();
  });
});

module.exports = router;
