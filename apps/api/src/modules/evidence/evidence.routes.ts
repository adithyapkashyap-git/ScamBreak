import multer from 'multer';
import { Router } from 'express';

import { config } from '../../config/index.js';
import { requireAuth } from '../../middleware/index.js';

import { uploadImage } from './evidence.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: Math.min(config.limits.uploadBytes, 10 * 1024 * 1024),
    fields: 4,
    fieldSize: 8 * 1024
  }
});

export const evidenceRouter = Router();

evidenceRouter.use(requireAuth);
evidenceRouter.post('/images', upload.single('image'), uploadImage);
