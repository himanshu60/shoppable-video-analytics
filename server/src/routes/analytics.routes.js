import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../middleware/errors.js';
import {
  analyticsQuerySchema,
  recentEventsQuerySchema,
  timeseriesQuerySchema,
  videoIdParamSchema,
} from '../schemas.js';
import {
  getRecentEvents,
  getSummary,
  getTimeseries,
  getVideoAnalytics,
  getVideoDetail,
  listVideos,
} from '../services/analytics.service.js';

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

/**
 * GET /api/analytics/timeseries?days=
 * Daily counts per event type. Days with no activity are returned as zeroes
 * so the chart's x-axis stays evenly spaced.
 */
analyticsRouter.get('/timeseries', validate(timeseriesQuerySchema, 'query'), (req, res) => {
  res.json({ data: getTimeseries(req.validatedQuery) });
});

export const videosRouter = Router();

/** GET /api/videos - id + title only; used to pick a random simulation target. */
videosRouter.get('/', (req, res) => {
  res.json({ data: listVideos() });
});

/** GET /api/videos/:id - one video with its metrics, series and recent events. */
videosRouter.get('/:id', validate(videoIdParamSchema, 'params'), (req, res, next) => {
  const detail = getVideoDetail(req.params.id);
  if (!detail) return next(new HttpError(404, `No video with id ${req.params.id}`));
  return res.json({ data: detail });
});

export const eventsFeedRouter = Router();

/** GET /api/events/recent?limit= - newest events across all videos. */
eventsFeedRouter.get('/recent', validate(recentEventsQuerySchema, 'query'), (req, res) => {
  res.json({ data: getRecentEvents(req.validatedQuery.limit) });
});
