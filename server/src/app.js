import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import { eventsRouter } from './routes/events.routes.js';
import { analyticsRouter, videosRouter } from './routes/analytics.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

/**
 * Builds the Express app without binding a port, so the test suite can drive
 * it through supertest and the entrypoint can own the listener.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  if (!config.isTest) app.use(morgan('dev'));

  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.use('/api/events', eventsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/videos', videosRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
