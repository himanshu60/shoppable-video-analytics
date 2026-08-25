/**
 * Thin fetch wrapper for the analytics API.
 *
 * Paths are origin-relative because Vite proxies /api to the backend in
 * development (see vite.config.js). In production the same build works
 * unchanged behind a reverse proxy.
 */

const BASE = '/api';

/** Error carrying the HTTP status and any field-level details from the API. */
export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (cause) {
    // fetch only rejects on network failure, so this branch means the API is
    // unreachable - almost always "the backend isn't running".
    throw new ApiError('Cannot reach the API. Is the server running on port 4000?', {
      status: 0,
      cause,
    });
  }

  // Read the body once, then decide: an error response may not be JSON at all
  // (a proxy 502 returns HTML), and calling .json() on that would throw a
  // confusing SyntaxError instead of the real status.
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.message || `Request failed with status ${response.status}`, {
      status: response.status,
      details: payload?.details,
    });
  }

  return payload;
}

/** One page of videos with aggregated view/click/conversion counts. */
export function fetchVideoAnalytics({ page = 1, limit = 10, sortBy = 'views', order = 'desc' } = {}) {
  const query = new URLSearchParams({ page, limit, sortBy, order });
  return request(`/analytics/videos?${query}`);
}

/** Site-wide totals for the dashboard header. */
export function fetchSummary() {
  return request('/analytics/summary');
}

/** id + title for every video; used to pick a random simulation target. */
export function fetchVideos() {
  return request('/videos');
}

/** Records one engagement event. */
export function postEvent({ videoId, eventType }) {
  return request('/events', {
    method: 'POST',
    body: JSON.stringify({ videoId, eventType }),
  });
}
