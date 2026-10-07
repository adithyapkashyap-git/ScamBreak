import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import { config } from '../config/index.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

let memoryServerInstance: { getUri(name?: string): string; stop(): Promise<boolean> } | null = null;

async function startEmbeddedDatabase(): Promise<string> {
  const { MongoMemoryServer } = await import('mongodb-memory-server');

  // Attempt to use a persistent local data directory so developer data persists across reboots
  const devDbPath = path.resolve(process.cwd(), 'data', 'dev-mongodb');
  try {
    fs.mkdirSync(devDbPath, { recursive: true });
    const instance = await MongoMemoryServer.create({
      instance: {
        dbName: 'scambreak',
        dbPath: devDbPath,
        storageEngine: 'wiredTiger'
      }
    });
    memoryServerInstance = instance;
    return instance.getUri('scambreak');
  } catch (error) {
    logger.warn(
      {
        operation: 'database.embedded.persistent_fallback',
        error: error instanceof Error ? error.message : String(error)
      },
      'Could not start embedded database with persistent storage path, falling back to in-memory instance'
    );
    const instance = await MongoMemoryServer.create({
      instance: {
        dbName: 'scambreak'
      }
    });
    memoryServerInstance = instance;
    return instance.getUri('scambreak');
  }
}

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  // Production environments strictly require the configured external database
  if (config.nodeEnv === 'production') {
    await mongoose.connect(config.mongoUri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 20,
      minPoolSize: 2
    });
    logger.info({ operation: 'database.connect' }, 'MongoDB connected');
    return;
  }

  // In development and test, attempt the configured URI first
  try {
    await mongoose.connect(config.mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 3_000,
      maxPoolSize: 20,
      minPoolSize: 0
    });
    logger.info({ operation: 'database.connect' }, 'MongoDB connected to configured URI');
    return;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(
      { operation: 'database.connect.fallback', reason: errorMsg },
      'Configured MongoDB connection failed (e.g. Atlas IP whitelist or network issue). Starting embedded local MongoDB fallback...'
    );

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }

    const embeddedUri = await startEmbeddedDatabase();
    await mongoose.connect(embeddedUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5_000,
      maxPoolSize: 20,
      minPoolSize: 0
    });
    logger.info(
      { operation: 'database.connect.embedded' },
      'Embedded local MongoDB is ready and connected. ScamBreak API is operational.'
    );
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info({ operation: 'database.disconnect' }, 'MongoDB disconnected');
  }

  if (memoryServerInstance) {
    try {
      await memoryServerInstance.stop();
    } catch {
      // Ignore stop errors on graceful exit
    }
    memoryServerInstance = null;
    logger.info({ operation: 'database.embedded.stopped' }, 'Embedded local MongoDB stopped');
  }
};

export const isDatabaseReady = (): boolean => mongoose.connection.readyState === 1;

