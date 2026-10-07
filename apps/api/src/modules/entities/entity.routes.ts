import { Router } from 'express';

import { requireAuth, requireRole, validate } from '../../middleware/index.js';

import {
  createTrustedEntity,
  getTrustedEntityForAdmin,
  listVerifiedEntities,
  updateTrustedEntity,
  verifyEntityClaim
} from './entity.controller.js';
import { entityListQuerySchema, entityParamsSchema, entityVerifyQuerySchema } from './entity.schemas.js';
import { trustedEntitySchema } from './trustedEntity.schemas.js';

export const entityRouter = Router();
entityRouter.use(requireAuth);
entityRouter.get('/', validate({ query: entityListQuerySchema }), listVerifiedEntities);
entityRouter.get('/verify', validate({ query: entityVerifyQuerySchema }), verifyEntityClaim);

export const adminEntityRouter = Router();
adminEntityRouter.use(requireAuth, requireRole('admin'));
adminEntityRouter.get('/', validate({ query: entityListQuerySchema }), listVerifiedEntities);
adminEntityRouter.post('/', validate({ body: trustedEntitySchema }), createTrustedEntity);
adminEntityRouter.get('/:entityId', validate({ params: entityParamsSchema }), getTrustedEntityForAdmin);
adminEntityRouter.put('/:entityId', validate({ params: entityParamsSchema, body: trustedEntitySchema }), updateTrustedEntity);

