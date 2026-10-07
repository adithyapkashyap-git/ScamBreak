import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { config } from './config/index.js';
import { isDatabaseReady } from './lib/database.js';
import {
  apiRateLimiter,
  corsMiddleware,
  csrfProtection,
  errorHandler,
  notFoundHandler,
  requestContext
} from './middleware/index.js';
import { analysisRouter } from './modules/analyses/analysis.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { communityModerationRouter, communityRouter } from './modules/community/community.routes.js';
import { adminEntityRouter, entityRouter } from './modules/entities/entity.routes.js';
import { evidenceRouter } from './modules/evidence/evidence.routes.js';
import { incidentRouter } from './modules/incidents/incident.routes.js';
import { adminPatternRouter, patternRouter } from './modules/patterns/pattern.routes.js';
import { urlAnalysisRouter } from './modules/urlAnalysis/urlAnalysis.routes.js';
import { userRouter } from './modules/users/user.routes.js';

/**
 * Creates the HTTP application without connecting to MongoDB. This makes route
 * integration testable and keeps process lifecycle separate from HTTP wiring.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(requestContext);
  app.use(
    helmet({
      // The API never renders user-controlled HTML. Keep a restrictive header
      // baseline while avoiding an HTML-specific policy dependency here.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' }
    })
  );
  app.use(corsMiddleware);
  app.use(cookieParser(config.auth.cookieSigningSecret));
  app.use(express.json({ limit: config.limits.requestBodyBytes, strict: true, type: 'application/json' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));

  app.get('/healthz', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { status: 'ok' } });
  });
  app.get('/readyz', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isDatabaseReady()) {
      res.status(503).json({ success: false, error: { code: 'NOT_READY', message: 'Database connectivity is not ready.' } });
      return;
    }
    res.status(200).json({ success: true, data: { status: 'ready' } });
  });

  app.use('/api', apiRateLimiter);
  app.use('/api', csrfProtection);
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/analyses', analysisRouter);
  app.use('/api/evidence', evidenceRouter);
  app.use('/api/incidents', incidentRouter);
  app.use('/api/community-reports', communityRouter);
  app.use('/api/patterns', patternRouter);
  app.use('/api/entities', entityRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/community', communityModerationRouter);
  app.use('/api/admin/patterns', adminPatternRouter);
  app.use('/api/admin/entities', adminEntityRouter);
  app.use('/api/url-analysis', urlAnalysisRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
