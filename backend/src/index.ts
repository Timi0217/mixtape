import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { prisma } from './config/database';
import { CronService } from './services/cronService';

// 🚀 MAJOR DEPLOYMENT v2.0.0 - FIXED MERGE PAGE ISSUE - DEPLOY NOW!!! 🚀

const app = express();

// Trust proxy for Railway deployment
app.set('trust proxy', true);

// Configure helmet with disabled CSP to allow route-specific CSP policies
app.use(helmet({
  contentSecurityPolicy: false, // Disable global CSP to allow route-specific CSP
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Comprehensive request logging middleware for debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🌐 [${timestamp}] ${req.method} ${req.url}`);
  console.log(`   IP: ${req.ip}`);
  console.log(`   User-Agent: ${req.headers['user-agent']}`);
  console.log(`   Authorization: ${req.headers.authorization ? 'Present' : 'Missing'}`);
  console.log(`   Content-Type: ${req.headers['content-type']}`);
  console.log(`   Params: ${JSON.stringify(req.params)}`);
  console.log(`   Query: ${JSON.stringify(req.query)}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`   Body: ${JSON.stringify(req.body)}`);
  }
  
  // Log response status when request completes
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`   Response: ${res.statusCode} ${res.statusMessage}`);
    if (res.statusCode >= 400) {
      console.log(`   Error Response Body: ${data}`);
    }
    console.log(`   ================================================\n`);
    return originalSend.call(this, data);
  };
  
  next();
});

// Temporarily disable rate limiting for development
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 500,
//   message: 'Too many requests from this IP, please try again later.',
// });
// app.use(limiter);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.1.0-TESTING-DEPLOYMENT',
    deployment: 'TESTING-IF-RAILWAY-WORKS',
    mergePageFixed: true,
    lastUpdate: '3:35 PM - Testing deployment' 
  });
});

console.log('🔄 Starting route imports...');

console.log('Importing auth routes...');
import authRoutes from './routes/auth';
console.log('✅ Auth routes imported');

console.log('Importing oauth routes...');
import oauthRoutes from './routes/oauth';
console.log('✅ OAuth routes imported');

console.log('Importing user routes...');
import userRoutes from './routes/users';
console.log('✅ User routes imported');

console.log('Importing group routes...');
import groupRoutes from './routes/groups';
console.log('✅ Group routes imported');

console.log('Importing submission routes...');
import submissionRoutes from './routes/submissions';
console.log('✅ Submission routes imported');

console.log('Importing music routes...');
import musicRoutes from './routes/music';
console.log('✅ Music routes imported');

console.log('Importing playlist routes...');
import playlistRoutes from './routes/playlists';
console.log('✅ Playlist routes imported');

console.log('Importing notification routes...');
import notificationRoutes from './routes/notifications';
console.log('✅ Notification routes imported');

console.log('Importing votes routes...');
import voteRoutes from './routes/votes';
console.log('✅ Vote routes imported');

console.log('Importing test routes...');
import testRoutes from './routes/test';
console.log('✅ Test routes imported');

console.log('Importing clean Apple Music routes...');
import appleMusicCleanRoutes from './routes/apple-music-clean';
console.log('✅ Clean Apple Music routes imported');

console.log('🛣️ Registering routes with Express app...');

app.use('/api/auth', authRoutes);
console.log('✅ Auth routes registered at /api/auth');

app.use('/api/oauth', oauthRoutes);
console.log('✅ OAuth routes registered at /api/oauth');

app.use('/api/users', userRoutes);
console.log('✅ User routes registered at /api/users');

app.use('/api/groups', groupRoutes);
console.log('✅ Group routes registered at /api/groups');

app.use('/api/submissions', submissionRoutes);
console.log('✅ Submission routes registered at /api/submissions');

app.use('/api/music', musicRoutes);
console.log('✅ Music routes registered at /api/music');

app.use('/api/playlists', playlistRoutes);
console.log('✅ Playlist routes registered at /api/playlists');

app.use('/api/notifications', notificationRoutes);
console.log('✅ Notification routes registered at /api/notifications');

app.use('/api/votes', voteRoutes);
console.log('✅ Vote routes registered at /api/votes');

app.use('/test', testRoutes);
console.log('✅ Test routes registered at /test');

app.use('/api/oauth', appleMusicCleanRoutes);
console.log('✅ Clean Apple Music routes registered at /api/oauth');

// Root level OAuth callback for Spotify
app.use('/', oauthRoutes);
console.log('✅ Root level OAuth routes registered');

console.log('🎉 All routes registered successfully!');

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const server = app.listen(Number(config.port), '0.0.0.0', () => {
  console.log(`Mixtape API server running on port ${config.port}`);
  console.log(`Accessible on both localhost and network IP`);
  
  // Start scheduled tasks after server is running
  CronService.startScheduledTasks();
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

export default app;