import 'dotenv/config';

import { z } from 'zod';

const booleanFromEnvironment = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? fallback : value === 'true'));

const integerFromEnvironment = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().trim().default('0.0.0.0'),
  PORT: integerFromEnvironment(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/scambreak'),
  AUTH_JWT_SECRET: z.string().min(1).default('development-only-jwt-secret-do-not-use-in-production'),
  COOKIE_SIGNING_SECRET: z
    .string()
    .min(1)
    .default('development-only-cookie-secret-do-not-use-in-production'),
  AUTH_JWT_EXPIRES_IN: z.string().min(2).default('8h'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'none', 'strict']).optional(),
  TRUST_PROXY: booleanFromEnvironment(false),
  RATE_LIMIT_WINDOW_MS: integerFromEnvironment(15 * 60 * 1000),
  RATE_LIMIT_MAX: integerFromEnvironment(120),
  AUTH_RATE_LIMIT_MAX: integerFromEnvironment(10),
  MAX_REQUEST_BODY_KB: integerFromEnvironment(256),
  MAX_UPLOAD_BYTES: integerFromEnvironment(10 * 1024 * 1024),
  PRIVATE_STORAGE_PATH: z.string().trim().min(1).default('./data/private-evidence'),
  ENTITY_HASH_PEPPER: z.string().min(1).default('development-only-entity-hash-pepper-do-not-use-in-production'),
  ANALYSIS_RETENTION_DAYS: integerFromEnvironment(90),
  UPLOAD_RETENTION_HOURS: integerFromEnvironment(24),
  /** Explicit opt-in: production deployers choose when automatic analysis deletion runs. */
  RETENTION_ENFORCEMENT_ENABLED: booleanFromEnvironment(false),
  PRIVACY_MAINTENANCE_SWEEP_HOURS: integerFromEnvironment(1),
  AI_PROVIDER: z.string().trim().default('none'),
  AI_API_KEY: z.string().optional(),
  URL_REPUTATION_PROVIDER: z.string().trim().default('none'),
  URL_REPUTATION_API_KEY: z.string().optional(),
  STORAGE_PROVIDER: z.string().trim().default('local'),
  STORAGE_BUCKET: z.string().optional(),
  EMAIL_PROVIDER: z.string().trim().default('none'),
  EMAIL_API_KEY: z.string().optional(),
  FEATURE_COMMUNITY_REPORTS: booleanFromEnvironment(false),
  FEATURE_EXTERNAL_INTELLIGENCE: booleanFromEnvironment(false)
});

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  appUrl: string;
  mongoUri: string;
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    cookieSigningSecret: string;
    sessionCookieName: string;
    csrfCookieName: string;
    secureCookies: boolean;
    cookieSameSite: 'lax' | 'none' | 'strict';
  };
  corsOrigins: string[];
  trustProxy: boolean;
  rateLimit: {
    windowMs: number;
    max: number;
    authMax: number;
  };
  limits: {
    requestBodyBytes: number;
    uploadBytes: number;
  };
  privacy: {
    privateStoragePath: string;
    entityHashPepper: string;
    analysisRetentionDays: number;
    uploadRetentionHours: number;
    retentionEnforcementEnabled: boolean;
    maintenanceSweepHours: number;
  };
  providers: {
    ai: { name: string; apiKey?: string };
    urlReputation: { name: string; apiKey?: string };
    storage: { name: string; bucket?: string };
    email: { name: string; apiKey?: string };
  };
  features: {
    communityReports: boolean;
    externalIntelligence: boolean;
  };
}>;

const splitOrigins = (value: string): string[] =>
  [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean))];

const assertProductionSafety = (input: z.infer<typeof environmentSchema>, origins: string[]): void => {
  if (input.NODE_ENV !== 'production') {
    return;
  }

  const developmentSecrets = new Set([
    'development-only-jwt-secret-do-not-use-in-production',
    'development-only-cookie-secret-do-not-use-in-production'
  ]);

  if (
    input.AUTH_JWT_SECRET.length < 32 ||
    input.COOKIE_SIGNING_SECRET.length < 32 ||
    developmentSecrets.has(input.AUTH_JWT_SECRET) ||
    developmentSecrets.has(input.COOKIE_SIGNING_SECRET) ||
    input.AUTH_JWT_SECRET === input.COOKIE_SIGNING_SECRET
  ) {
    throw new Error(
      'Production requires distinct AUTH_JWT_SECRET and COOKIE_SIGNING_SECRET values of at least 32 characters.'
    );
  }

  if (
    input.ENTITY_HASH_PEPPER.length < 32 ||
    input.ENTITY_HASH_PEPPER === 'development-only-entity-hash-pepper-do-not-use-in-production'
  ) {
    throw new Error('Production requires ENTITY_HASH_PEPPER to be a distinct random value of at least 32 characters.');
  }

  if (origins.length === 0 || origins.some((origin) => origin === '*' || !origin.startsWith('https://'))) {
    throw new Error('Production CORS_ORIGINS must contain explicit HTTPS origins and must not contain wildcards.');
  }

  if (!input.APP_URL.startsWith('https://')) {
    throw new Error('Production APP_URL must use HTTPS.');
  }
};

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const fields = parsedEnvironment.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration: ${fields}`);
}

const environment = parsedEnvironment.data;
const corsOrigins = splitOrigins(environment.CORS_ORIGINS);
assertProductionSafety(environment, corsOrigins);

export const config: AppConfig = Object.freeze({
  nodeEnv: environment.NODE_ENV,
  host: environment.HOST,
  port: environment.PORT,
  appUrl: environment.APP_URL,
  mongoUri: environment.MONGODB_URI,
  auth: {
    jwtSecret: environment.AUTH_JWT_SECRET,
    jwtExpiresIn: environment.AUTH_JWT_EXPIRES_IN,
    cookieSigningSecret: environment.COOKIE_SIGNING_SECRET,
    sessionCookieName:
      environment.NODE_ENV === 'production' ? '__Host-scambreak_session' : 'scambreak_session',
    csrfCookieName:
      environment.NODE_ENV === 'production' ? '__Host-scambreak_csrf' : 'scambreak_csrf',
    secureCookies:
      environment.NODE_ENV === 'production' || environment.COOKIE_SAMESITE === 'none',
    cookieSameSite:
      environment.COOKIE_SAMESITE ?? (environment.NODE_ENV === 'production' ? 'none' : 'lax')
  },
  corsOrigins,
  trustProxy: environment.TRUST_PROXY,
  rateLimit: {
    windowMs: environment.RATE_LIMIT_WINDOW_MS,
    max: environment.RATE_LIMIT_MAX,
    authMax: environment.AUTH_RATE_LIMIT_MAX
  },
  limits: {
    requestBodyBytes: environment.MAX_REQUEST_BODY_KB * 1024,
    uploadBytes: environment.MAX_UPLOAD_BYTES
  },
  privacy: {
    privateStoragePath: environment.PRIVATE_STORAGE_PATH,
    entityHashPepper: environment.ENTITY_HASH_PEPPER,
    analysisRetentionDays: environment.ANALYSIS_RETENTION_DAYS,
    uploadRetentionHours: environment.UPLOAD_RETENTION_HOURS,
    retentionEnforcementEnabled: environment.RETENTION_ENFORCEMENT_ENABLED,
    maintenanceSweepHours: environment.PRIVACY_MAINTENANCE_SWEEP_HOURS
  },
  providers: {
    ai: { name: environment.AI_PROVIDER, apiKey: environment.AI_API_KEY || undefined },
    urlReputation: {
      name: environment.URL_REPUTATION_PROVIDER,
      apiKey: environment.URL_REPUTATION_API_KEY || undefined
    },
    storage: { name: environment.STORAGE_PROVIDER, bucket: environment.STORAGE_BUCKET || undefined },
    email: { name: environment.EMAIL_PROVIDER, apiKey: environment.EMAIL_API_KEY || undefined }
  },
  features: {
    communityReports: environment.FEATURE_COMMUNITY_REPORTS,
    externalIntelligence: environment.FEATURE_EXTERNAL_INTELLIGENCE
  }
});
