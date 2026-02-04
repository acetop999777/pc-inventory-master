import express from 'express';
import cors from 'cors';
import type { Pool } from 'pg';
import { requestId } from './middleware/requestId';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { registerRoutes } from './routes';

type AppDeps = { pool: Pool };

function createApp({ pool }: AppDeps) {
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

export { createApp };
