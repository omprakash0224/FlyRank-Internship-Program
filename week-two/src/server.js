// Entry point — only responsible for starting the HTTP server
const app  = require('./app');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`API docs:  http://localhost:${port}/docs`);
});
