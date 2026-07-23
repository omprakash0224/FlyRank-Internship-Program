const { Router } = require('express');
const tasks = require('../data/tasks');
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

  const nextId  = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
  const newTask = { id: nextId, title: title.trim(), done: false };
  tasks.push(newTask);

  res.status(201).json(newTask);
});

// PUT /tasks/:id — update title and/or done
router.put('/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const task   = tasks.find(t => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

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

  if (hasTitle) task.title = title.trim();
  if (hasDone)  task.done  = done;

  res.json(task);
});

// DELETE /tasks/:id — remove a task
router.delete('/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const index  = tasks.findIndex(t => t.id === taskId);

  if (index === -1) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  tasks.splice(index, 1);

  res.status(204).send();
});

module.exports = router;
