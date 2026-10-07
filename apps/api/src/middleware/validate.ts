import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../lib/AppError.js';

type RequestSchemas = Readonly<{
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}>;

export const validate = (schemas: RequestSchemas): RequestHandler => (req, _res, next): void => {
  const target = {
    ...(schemas.body ? { body: req.body } : {}),
    ...(schemas.query ? { query: req.query } : {}),
    ...(schemas.params ? { params: req.params } : {})
  };

  const schemaEntries = Object.entries(schemas) as Array<[keyof RequestSchemas, ZodType]>;
  const issues: Array<{ location: keyof RequestSchemas; path: string; message: string; code: string }> = [];
  const parsed: Record<string, unknown> = {};

  for (const [location, schema] of schemaEntries) {
    const result = schema.safeParse(target[location]);
    if (result.success) {
      parsed[location] = result.data;
      continue;
    }

    for (const issue of result.error.issues) {
      issues.push({
        location,
        path: issue.path.join('.') || location,
        message: issue.message,
        code: issue.code
      });
    }
  }

  if (issues.length > 0) {
    next(new AppError(400, 'VALIDATION_ERROR', 'One or more fields are invalid.', { details: issues }));
    return;
  }

  req.validated = parsed;
  next();
};
