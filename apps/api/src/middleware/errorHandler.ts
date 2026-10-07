import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { config } from '../config/index.js';
import { AppError, isAppError } from '../lib/AppError.js';
import { logger, safeErrorMetadata } from '../lib/logger.js';

const normalizeError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'One or more fields are invalid.', {
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return new AppError(400, 'VALIDATION_ERROR', 'One or more fields are invalid.');
  }

  if (error instanceof mongoose.Error.CastError) {
    return new AppError(400, 'INVALID_IDENTIFIER', 'The supplied identifier is invalid.');
  }

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return new AppError(
      tooLarge ? 413 : 400,
      tooLarge ? 'UPLOAD_FILE_TOO_LARGE' : 'UPLOAD_INVALID_MULTIPART',
      tooLarge ? 'The uploaded file is too large.' : 'The uploaded file could not be processed safely.'
    );
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  ) {
    return new AppError(409, 'CONFLICT', 'A record with one of those values already exists.');
  }

  return new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.', {
    isOperational: false,
    cause: error
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next): void => {
  const normalized = normalizeError(error);

  logger.error(
    {
      requestId: req.requestId,
      operation: 'http.error',
      statusCode: normalized.statusCode,
      errorCode: normalized.code,
      isOperational: normalized.isOperational,
      ...safeErrorMetadata(error)
    },
    normalized.isOperational ? 'Request rejected' : 'Unhandled request error'
  );

  if (res.headersSent) {
    return;
  }

  const includeDetails = normalized.statusCode < 500;
  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message:
        normalized.statusCode >= 500 && config.nodeEnv === 'production'
          ? 'An unexpected error occurred.'
          : normalized.message,
      requestId: req.requestId,
      ...(includeDetails && normalized.details !== undefined ? { details: normalized.details } : {})
    }
  });
};
