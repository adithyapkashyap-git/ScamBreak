import type { RequestHandler } from 'express';

import { AppError } from '../lib/AppError.js';

export const notFoundHandler: RequestHandler = (req, _res, next): void => {
  next(new AppError(404, 'NOT_FOUND', `No API resource exists at ${req.method} ${req.path}.`));
};
