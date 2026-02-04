const healthRoutes = require('./health');
const dashboardRoutes = require('./dashboard');
const inventoryRoutes = require('./inventory');
const clientsRoutes = require('./clients');
const lookupRoutes = require('./lookup');
const logsRoutes = require('./logs');
const inboundRoutes = require('./inbound');

/**
 * @param {import('express').Express} app
 * @param {{ pool: import('pg').Pool }} deps
 */
function registerRoutes(app, { pool }) {
  app.use('/api', healthRoutes({ pool }));
  app.use('/api', dashboardRoutes({ pool }));
  app.use('/api', inventoryRoutes({ pool }));
  app.use('/api', clientsRoutes({ pool }));
  app.use('/api', lookupRoutes({ pool }));
  app.use('/api', logsRoutes({ pool }));
  app.use('/api', inboundRoutes({ pool }));
}

module.exports = { registerRoutes };
