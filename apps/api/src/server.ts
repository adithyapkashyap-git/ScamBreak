import { createServer, type Server } from 'node:http';

import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './lib/database.js';
import { logger, safeErrorMetadata } from './lib/logger.js';
import { seedTrustedEntities } from './modules/entities/trustedEntitySeed.service.js';
import { seedBuiltInPatterns } from './modules/patterns/patternSeed.service.js';
import { startPrivacyMaintenanceScheduler } from './modules/retention/privacyMaintenance.service.js';
import { createApp } from './app.js';

export async function startServer(): Promise<Server> {
  await connectDatabase();
  await seedBuiltInPatterns();
  await seedTrustedEntities();
  const app = createApp();
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const stopPrivacyMaintenance = startPrivacyMaintenanceScheduler();
  server.once('close', stopPrivacyMaintenance);
  logger.info({ operation: 'server.listen', host: config.host, port: config.port }, 'ScamBreak API listening');
  return server;
}

async function run(): Promise<void> {
  const server = await startServer();
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ operation: 'server.shutdown', signal }, 'Graceful shutdown started');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  run().catch((error: unknown) => {
    logger.fatal({ operation: 'server.start', ...safeErrorMetadata(error) }, 'ScamBreak API could not start');
    process.exitCode = 1;
  });
}
