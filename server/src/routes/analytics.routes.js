import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { analyticsQuerySchema } from '../schemas.js';
import { getSummary, getVideoAnalytics, listVideos } from '../services/analytics.service.js';

export const analyticsRouter = Router();

/**
 * GET /api/analytics/videos?page=&limit=&sortBy=&order=
 * One page of videos with their aggregated view/click/conversion counts.
 */
analyticsRouter.get('/videos', validate(analyticsQuerySchema, 'query'), (req, res) => {
  res.json(getVideoAnalytics(req.validatedQuery));
});

/** GET /api/analytics/summary - site-wide totals for the dashboard header. */
analyticsRouter.get('/summary', (req, res) => {
  res.json({ data: getSummary() });
});

export const videosRouter = Router();

/** GET /api/videos - id + title only; used to pick a random simulation target. */
videosRouter.get('/', (req, res) => {
  res.json({ data: listVideos() });
});
