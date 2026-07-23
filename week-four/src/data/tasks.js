// In-memory data store — shared across all route handlers
const tasks = [
  { id: 1, title: 'Learn Express',        done: true  },
  { id: 2, title: 'Build an API',         done: false },
  { id: 3, title: 'Deploy to production', done: false },
];

module.exports = tasks;
