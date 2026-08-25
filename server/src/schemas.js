import { z } from 'zod';
import { EVENT_TYPES } from './config.js';

/**
 * Body of POST /api/events.
 *
 * videoId is coerced so both `1` and `"1"` are accepted from webhook-style
 * payloads. Coercion turns a missing field into NaN, so invalid_type_error
 * carries the "required" wording rather than leaking "received nan".
 */
export const createEventSchema = z.object({
  videoId: z.coerce
    .number({ invalid_type_error: 'videoId is required and must be a positive integer' })
    .int({ message: 'videoId must be a whole number' })
    .positive({ message: 'videoId must be a positive integer' }),
  eventType: z.enum(EVENT_TYPES, {
    errorMap: () => ({ message: `eventType must be one of: ${EVENT_TYPES.join(', ')}` }),
  }),
  timestamp: z.string().datetime({ message: 'timestamp must be an ISO 8601 datetime' }).optional(),
});

/** Query string of GET /api/analytics/videos. */
export const analyticsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Capped at 100 so a client cannot ask for the whole table in one request.
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['views', 'clicks', 'conversions', 'title', 'createdAt']).default('views'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
