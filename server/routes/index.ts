import type { Express } from 'express';
import type { Pool } from 'pg';
import healthRoutes from './health';
import dashboardRoutes from './dashboard';
import inventoryRoutes from './inventory';
import clientsRoutes from './clients';
import lookupRoutes from './lookup';
import logsRoutes from './logs';
import inboundRoutes from './inbound';

type RouteDeps = { pool: Pool };

function registerRoutes(app: Express, { pool }: RouteDeps) {
  app.use('/api', healthRoutes({ pool }));
  app.use('/api', dashboardRoutes({ pool }));
  app.use('/api', inventoryRoutes({ pool }));
  app.use('/api', clientsRoutes({ pool }));
  app.use('/api', lookupRoutes({ pool }));
  app.use('/api', logsRoutes({ pool }));
  app.use('/api', inboundRoutes({ pool }));
}

export { registerRoutes };
