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

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    verifySid: process.env.TWILIO_VERIFY_SID || '',
  },
  
  frontendUrl: process.env.FRONTEND_URL || 'mixtape://',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
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

// Validate JWT secrets are not default values (only in production)
if (config.nodeEnv === 'production') {
  const insecureSecrets = [
    'your-super-secret-jwt-key-change-in-production',
    'CHANGE_ME_GENERATE_STRONG_SECRET_256_BITS'
  ];
  
  if (insecureSecrets.includes(process.env.JWT_SECRET!)) {
    throw new Error('JWT_SECRET must be changed from default value in production. Generate a strong random secret.');
  }

  if (insecureSecrets.includes(process.env.JWT_REFRESH_SECRET!)) {
    throw new Error('JWT_REFRESH_SECRET must be changed from default value in production. Generate a strong random secret.');
  }
  
  // Validate minimum length in production
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long in production.');
  }
  
  if (process.env.JWT_REFRESH_SECRET!.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long in production.');
  }
} else {
  // Development warning for weak secrets
  if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
    console.warn('⚠️  Using default JWT_SECRET in development. This is fine for local development but change it for production.');
  }
}

// In production, validate API keys are provided
if (config.nodeEnv === 'production') {
  for (const apiKey of requiredApiKeys) {
    if (!process.env[apiKey] || process.env[apiKey].startsWith('your_')) {
      console.warn(`Warning: ${apiKey} appears to be using a placeholder value. Music services may not work properly.`);
    }
  }
}