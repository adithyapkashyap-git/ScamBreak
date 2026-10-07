import { Router } from 'express';

import { requireAuth, validate } from '../../middleware/index.js';

import { deleteMe, getMe, patchMe, patchMyPassword } from './user.controller.js';
import {
  deleteAccountBodySchema,
  updateCurrentUserBodySchema,
  updatePasswordBodySchema
} from './user.schemas.js';

export const userRouter = Router();

userRouter.use(requireAuth);
userRouter.get('/me', getMe);
userRouter.patch('/me', validate({ body: updateCurrentUserBodySchema }), patchMe);
userRouter.patch('/me/password', validate({ body: updatePasswordBodySchema }), patchMyPassword);
userRouter.delete('/me', validate({ body: deleteAccountBodySchema }), deleteMe);
