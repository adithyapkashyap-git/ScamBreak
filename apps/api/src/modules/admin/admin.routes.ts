import { Router } from 'express';

import { requireAuth, requireRole, validate } from '../../middleware/index.js';

import { adminOverview, listAbuseReports, listAuditLogs } from './admin.controller.js';
import { adminListQuerySchema } from './admin.schemas.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));
adminRouter.get('/overview', adminOverview);
adminRouter.get('/audit-logs', validate({ query: adminListQuerySchema }), listAuditLogs);
adminRouter.get('/abuse-reports', validate({ query: adminListQuerySchema }), listAbuseReports);
