// Entry point — only responsible for starting the HTTP server
// Load .env first so every subsequent require() sees the environment variables
require('dotenv').config();

const app  = require('./app');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`API docs:  http://localhost:${port}/docs`);
});
