const express = require('express');
const cors = require('cors');

const requestId = require('./middleware/requestId');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { pool } = require('./db/pool');

const healthRoutes = require('./routes/health');
const dashboardRoutes = require('./routes/dashboard');
const inventoryRoutes = require('./routes/inventory');
const clientsRoutes = require('./routes/clients');
const lookupRoutes = require('./routes/lookup');
const logsRoutes = require('./routes/logs');
const inboundRoutes = require('./routes/inbound');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(requestId);

app.use('/api', healthRoutes({ pool }));
app.use('/api', dashboardRoutes({ pool }));
app.use('/api', inventoryRoutes({ pool }));
app.use('/api', clientsRoutes({ pool }));
app.use('/api', lookupRoutes({ pool }));
app.use('/api', logsRoutes({ pool }));
app.use('/api', inboundRoutes({ pool }));

// --- Global error contract ---
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
