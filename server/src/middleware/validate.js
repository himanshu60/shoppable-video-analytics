import { HttpError } from './errors.js';

/**
 * Runs a Zod schema against one part of the request and replaces it with the
 * parsed result, so handlers receive coerced values (numbers, defaults)
 * rather than raw query strings.
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(new HttpError(400, `Invalid request ${source}`, details));
    }

    // req.query is a getter in Express 5; assigning to a local is safer.
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;

    return next();
  };
}
