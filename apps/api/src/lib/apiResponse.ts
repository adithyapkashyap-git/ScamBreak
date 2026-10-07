import type { Response } from 'express';

import type { ApiMeta } from '../types/api.js';

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200, meta?: ApiMeta): Response =>
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {})
  });

export const sendNoContent = (res: Response): Response => res.status(204).send();
