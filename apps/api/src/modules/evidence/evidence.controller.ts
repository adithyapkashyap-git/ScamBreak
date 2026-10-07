import type { RequestHandler } from 'express';

import { AppError } from '../../lib/AppError.js';
import { sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

import { stageImageUpload } from './upload.service.js';

export const uploadImage: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, 'IMAGE_REQUIRED', 'Attach one JPEG, PNG, or WebP image in the image field.');
  }
  const upload = await stageImageUpload({
    ownerUserId: req.auth!.id,
    file: { buffer: req.file.buffer, mimetype: req.file.mimetype }
  });
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { upload }, 201);
});
