import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'github_bounty_tracker_jwt_secret_key_12345',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', // 32-byte hex key for development
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/github_bounty?schema=public',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  SCAN_INTERVAL_MS: parseInt(process.env.SCAN_INTERVAL_MS || '1800000', 10), // Default: 30 minutes (1800000 ms)
};
