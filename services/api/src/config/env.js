import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET'
];

function trimTrailingSlash(value) {
  return typeof value === 'string' ? value.replace(/\/+$/, '') : value;
}

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// PORT is optional - Render provides it automatically
if (!process.env.PORT && process.env.NODE_ENV === 'production') {
  console.warn('Warning: PORT not set, using default 3000');
}

const frontendUrl = trimTrailingSlash(process.env.FRONTEND_URL || 'http://localhost:8080');
const corsOrigin = trimTrailingSlash(process.env.CORS_ORIGIN || frontendUrl);

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Auth
  jwtSecret: process.env.JWT_SECRET,
  magicLinkExpiry: parseInt(process.env.MAGIC_LINK_EXPIRY || '3600', 10), // 1 hour default

  // Email (Resend)
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,

  // Storage (S3/R2)
  storageType: process.env.STORAGE_TYPE || 's3',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  s3BucketName: process.env.S3_BUCKET_NAME,
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2Endpoint: process.env.R2_ENDPOINT,

  // Frontend
  frontendUrl,

  // CORS
  corsOrigin
};
