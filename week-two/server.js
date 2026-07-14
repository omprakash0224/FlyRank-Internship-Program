const express = require('express');
const app = express();

app.use(express.json()); // parse JSON request bodies
const port = process.env.PORT || 3000;

const tasks = [
  { id: 1, title: "Learn Express", done: true },
  { id: 2, title: "Build an API", done: false },
  { id: 3, title: "Deploy to production", done: false }
];

app.get('/', (req, res) => {
  res.json({ name: "Task API", version: "1.0", endpoints: ["/tasks"] });
});

app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

app.get('/tasks', (req, res) => {
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  res.json(task);
});

app.post('/tasks', (req, res) => {
  const { title } = req.body;

  // Validate: title must be present and non-empty
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }

  // Assign the next free id
  const nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;

  const newTask = { id: nextId, title: title.trim(), done: false };
  tasks.push(newTask);

  res.status(201).json(newTask);
});

app.put('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  const { title, done } = req.body;

  // At least one valid field must be provided
  const hasTitle = title !== undefined;
  const hasDone  = done  !== undefined;

  if (!hasTitle && !hasDone) {
    return res.status(400).json({ error: 'Request body must include at least one of: title, done' });
  }

  // Validate title if provided
  if (hasTitle && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }

  // Validate done if provided
  if (hasDone && typeof done !== 'boolean') {
    return res.status(400).json({ error: 'done must be a boolean' });
  }

  // Apply updates in-place
  if (hasTitle) task.title = title.trim();
  if (hasDone)  task.done  = done;

  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const index  = tasks.findIndex(t => t.id === taskId);

  if (index === -1) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  tasks.splice(index, 1);

  res.status(204).send(); // No Content — deleted successfully
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
