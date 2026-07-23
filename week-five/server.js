const express = require('express');
const next = require('next');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const fs = require('fs');

dotenv.config();

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);
}

app.prepare().then(() => {
  const server = express();

  const openapiPath = path.join(__dirname, 'openapi.json');
  if (fs.existsSync(openapiPath)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
    server.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  // Handle all other Next.js routes
  server.use((req, res) => {
    return handle(req, res);
  });

  server.listen(port, () => {
    console.log(`Server running and connected to Supabase`);
  });
});
