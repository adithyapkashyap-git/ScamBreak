import { Router } from 'express';

import { authRateLimiter, requireAuth, validate } from '../../middleware/index.js';

import { getCsrfToken, getCurrentUser, login, logout, register } from './auth.controller.js';
import { loginBodySchema, registerBodySchema } from './auth.schemas.js';

export const authRouter = Router();

authRouter.get('/csrf', getCsrfToken);
authRouter.post('/register', authRateLimiter, validate({ body: registerBodySchema }), register);
authRouter.post('/login', authRateLimiter, validate({ body: loginBodySchema }), login);
authRouter.post('/logout', requireAuth, logout);
authRouter.get('/me', requireAuth, getCurrentUser);
