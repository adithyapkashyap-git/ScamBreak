export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  public constructor(
    statusCode: number,
    code: string,
    message: string,
    options: { details?: unknown; cause?: unknown; isOperational?: boolean } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;
