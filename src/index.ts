import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { prisma } from './config/database';
import { CronService } from './services/cronService';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Debug endpoint to check if routes are loading
app.get('/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(function(middleware) {
    if (middleware.route) { 
      routes.push(middleware.route);
    } else if (middleware.name === 'router') { 
      middleware.handle.stack.forEach(function(handler) {
        if (handler.route) {
          routes.push(handler.route);
        }
      });
    }
  });
  res.json({ routeCount: routes.length, routes: routes.slice(0, 10) });
});

// Add a simple test API route to verify basic functionality
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown'
  });
});

console.log('🚀 Loading application routes...');

// Only load routes if we can import them successfully
try {
  console.log('Attempting to import music routes...');
  const musicRoutes = require('./routes/music');
  app.use('/api/music', musicRoutes.default || musicRoutes);
  console.log('✅ Music routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load music routes:', error.message);
}

try {  
  console.log('Attempting to import auth routes...');
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes.default || authRoutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message);
}

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