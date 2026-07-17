// src/routes/tasks.js
// The route file is identical in shape to the week-two version.
// The ONLY change: import the Postgres repo instead of the in-memory array,
// and await each call.  The HTTP contract (paths, status codes, JSON shapes)
// is 100% unchanged.
'use strict';

const { Router } = require('express');
const repo = require('../data/postgresTasks');   // ← swap this line to switch storage

const router = Router();

// GET /tasks — list all tasks
router.get('/', async (req, res) => {
  const tasks = await repo.getAll();
  res.json(tasks);
});

// GET /tasks/:id — get one task
router.get('/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const task   = await repo.getById(taskId);

  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  res.json(task);
});

// POST /tasks — create a task
router.post('/', async (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }

  const newTask = await repo.create(title.trim());
  res.status(201).json(newTask);
});

// PUT /tasks/:id — update title and/or done
router.put('/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);

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

  const updated = await repo.update(taskId, {
    title: hasTitle ? title.trim() : undefined,
    done:  hasDone  ? done         : undefined,
  });

  if (!updated) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  res.json(updated);
});

// DELETE /tasks/:id — remove a task
router.delete('/:id', async (req, res) => {
  const taskId  = parseInt(req.params.id, 10);
  const deleted = await repo.remove(taskId);

  if (!deleted) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  res.status(204).send();
});

module.exports = router;
