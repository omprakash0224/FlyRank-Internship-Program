const express     = require('express');
const swaggerUi   = require('swagger-ui-express');
const openApiSpec = require('../openapi.json');
const tasksRouter = require('./routes/tasks');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks', '/docs'] });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/tasks', tasksRouter);

// ── API Docs ───────────────────────────────────────────────────────────────────
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

module.exports = app;
