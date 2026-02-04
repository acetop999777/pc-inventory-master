const express = require('express');
const cors = require('cors');

const requestId = require('./middleware/requestId');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { registerRoutes } = require('./routes');

/**
 * @param {{ pool: import('pg').Pool }} deps
 */
function createApp({ pool }) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(requestId);

  registerRoutes(app, { pool });

  // --- Global error contract ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
