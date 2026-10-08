import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import errorHandler from './middlewares/errorHandler';
import { checkDatabaseConnection } from './infrastructure/database/checkDatabase';

export type AppDependencies = {
  checkDatabase: () => Promise<boolean>;
};

const defaultDependencies: AppDependencies = {
  checkDatabase: checkDatabaseConnection,
};

export function createApp(dependencies: AppDependencies = defaultDependencies) {
  const app = express();

  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

  app.use(morgan('dev'));

  app.use(
    cors({
      origin: CORS_ORIGIN,
    }),
  );

  app.use(express.json());

  app.get('/health', async (_req, res) => {
    const databaseOk = await dependencies.checkDatabase();

    res.status(200).json({
      status: 'ok',
      service: 'take-and-go-api',
      database: databaseOk ? 'ok' : 'error',
      timestamp: new Date(),
    });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: 'Ruta no encontrada',
    });
  });

  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;