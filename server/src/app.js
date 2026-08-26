import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config, SERVER_ROOT } from './config.js';
import { eventsRouter } from './routes/events.routes.js';
import { analyticsRouter, eventsFeedRouter, videosRouter } from './routes/analytics.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

const CLIENT_DIST = path.resolve(SERVER_ROOT, '../client/dist');

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

  // The feed router is mounted first so GET /api/events/recent resolves
  // before the ingestion router, which only handles POST /.
  app.use('/api/events', eventsFeedRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/videos', videosRouter);

  /*
   * In production one process serves both the API and the built React app, so
   * a single deployment (and a single origin) covers the whole project. In
   * development this is skipped and Vite serves the frontend with HMR.
   */
  if (config.serveClient && fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));

    // SPA fallback. Guarded so an unknown /api path still returns a JSON 404
    // instead of index.html, which would turn a typo into a confusing
    // "unexpected token <" parse error in the client.
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      if (req.method !== 'GET') return next();
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
