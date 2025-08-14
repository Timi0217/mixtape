import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL!,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI!,
  },
  
  appleMusic: {
    keyId: process.env.APPLE_MUSIC_KEY_ID!,
    teamId: process.env.APPLE_MUSIC_TEAM_ID!,
    privateKeyPath: process.env.APPLE_MUSIC_PRIVATE_KEY_PATH!,
  },
  
};

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const requiredApiKeys = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET', 
  'SPOTIFY_REDIRECT_URI',
  'APPLE_MUSIC_KEY_ID',
  'APPLE_MUSIC_TEAM_ID',
  'APPLE_MUSIC_PRIVATE_KEY_PATH',
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Validate JWT secrets are not default values
if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production' ||
    process.env.JWT_SECRET === 'CHANGE_ME_GENERATE_STRONG_SECRET_256_BITS') {
  throw new Error('JWT_SECRET must be changed from default value. Generate a strong random secret.');
}

if (process.env.JWT_REFRESH_SECRET === 'your-super-secret-refresh-jwt-key-change-in-production' ||
    process.env.JWT_REFRESH_SECRET === 'CHANGE_ME_GENERATE_STRONG_REFRESH_SECRET_256_BITS') {
  throw new Error('JWT_REFRESH_SECRET must be changed from default value. Generate a strong random secret.');
}

// In production, validate API keys are provided
if (config.nodeEnv === 'production') {
  for (const apiKey of requiredApiKeys) {
    if (!process.env[apiKey] || process.env[apiKey].startsWith('your_')) {
      console.warn(`Warning: ${apiKey} appears to be using a placeholder value. Music services may not work properly.`);
    }
  }
}