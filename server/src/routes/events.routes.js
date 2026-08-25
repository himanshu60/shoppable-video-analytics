import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../middleware/errors.js';
import { createEventSchema } from '../schemas.js';
import { createEvent, videoExists } from '../services/events.service.js';

export const eventsRouter = Router();

/**
 * POST /api/events
 * Ingests a single engagement event, standing in for storefront webhook
 * traffic. Returns 201 with the stored row.
 */
eventsRouter.post('/', validate(createEventSchema), (req, res, next) => {
  const { videoId, eventType, timestamp } = req.body;

  // Checked explicitly so the caller gets a 404 with a useful message rather
  // than a raw SQLITE_CONSTRAINT_FOREIGNKEY bubbling up as a 500.
  if (!videoExists(videoId)) {
    return next(new HttpError(404, `No video with id ${videoId}`));
  }

  return res.status(201).json({ data: createEvent({ videoId, eventType, timestamp }) });
});
