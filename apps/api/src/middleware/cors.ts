import cors from 'cors';
import type { RequestHandler } from 'express';

import { config } from '../config/index.js';
import { AppError } from '../lib/AppError.js';

export const corsMiddleware: RequestHandler = cors({
  credentials: true,
  origin(origin, callback) {
    // Requests without an Origin are non-browser clients or same-origin requests;
    // CORS does not grant them browser access, so allow the request to proceed.
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed to access the API.'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'RateLimit', 'RateLimit-Policy'],
  maxAge: 600,
  optionsSuccessStatus: 204
});
