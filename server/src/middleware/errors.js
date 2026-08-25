/** Human-readable labels for the statuses this API actually returns. */
const STATUS_TEXT = {
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

/** An error carrying an HTTP status, so route handlers can just throw. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: STATUS_TEXT[404],
    message: `No route for ${req.method} ${req.path}`,
  });
}

/* eslint-disable-next-line no-unused-vars -- Express identifies error
   middleware by arity, so `next` must stay in the signature. */
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  // 5xx means we have a bug: log the stack, but never leak it to the client.
  if (status >= 500) console.error(err);

  res.status(status).json({
    error: STATUS_TEXT[status] || 'Error',
    message: status >= 500 ? 'Something went wrong handling the request.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
