import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const asyncHandler = <TRequest extends Request = Request>(
  handler: (req: TRequest, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler =>
  (req, res, next): void => {
    void Promise.resolve(handler(req as TRequest, res, next)).catch(next);
  };
