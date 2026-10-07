import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import errorHandler from './middlewares/errorHandler';

const app = express();

const CORS_ORIGIN =
  process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(morgan('dev'));

app.use(
  cors({
    origin: CORS_ORIGIN,
  }),
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'take-and-go-api',
    timestamp: new Date(),
  });
});

app.use((_req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
  });
});

app.use(errorHandler);

export default app;