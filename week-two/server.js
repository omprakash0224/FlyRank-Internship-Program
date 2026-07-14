const express = require('express');
const app = express();
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
