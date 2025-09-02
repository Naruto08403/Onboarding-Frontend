const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { runMigrations, verifyMigrations } = require('./database/migrations');
const { testConnection } = require('./database/connection');

require('dotenv').config();

const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/admin-auth'); // NEW
const driverRoutes = require('./routes/drivers');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const integrationRoutes = require('./routes/integration'); // NEW

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting
app.set('trust proxy', 1);

app.use(helmet());
const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health'
});
app.use(limiter);
app.use(cors({ 
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://onboarding-backend-mu.vercel.app',
    'https://onboarding-backend-mu.vercel.app/',
  ], 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Driver Onboarding Backend System is running',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'PostgreSQL',
      authentication: 'JWT + Firebase',
      storage: 'Firebase Storage',
      payments: 'Stripe',
      backgroundChecks: 'External APIs',
      insuranceVerification: 'External APIs'
    }
  });
});

// API information endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Driver Onboarding Backend API',
    version: '2.0.0',
    description: 'Comprehensive driver onboarding system with external integrations',
    baseUrl: '/api',
    endpoints: {
      auth: '/api/auth/*',
      drivers: '/api/drivers/*',
      documents: '/api/documents/*',
      admin: '/api/admin/*',
      notifications: '/api/notifications/*',
      integration: '/api/integration/*' // NEW
    },
    features: [
      'User Authentication & Authorization',
      'Driver Profile Management',
      'Document Upload & Storage',
      'Background Check Integration',
      'Insurance Verification',
      'Payment Processing (Stripe)',
      'Firebase Integration',
      'PostgreSQL Database',
      'Admin Dashboard',
      'Notification System'
    ],
    documentation: '/api/docs',
    health: '/health'
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin-auth', adminAuthRoutes); // NEW
app.use('/api/drivers', driverRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/integration', integrationRoutes); // NEW

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      '/health',
      '/api',
      '/api/auth/*',
      '/api/drivers/*',
      '/api/documents/*',
      '/api/admin/*',
      '/api/notifications/*',
      '/api/integration/*' // NEW
    ],
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: 'File Upload Error',
      message: 'File upload failed',
      details: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

if (!process.env.VERCEL && process.env.RUN_MIGRATIONS_ON_START === 'true') {
  (async () => {
    const ok = await testConnection();
    if (ok) {
      await runMigrations();
      await verifyMigrations();
      console.log('Migrations applied on start');
    } else {
      console.warn('Skipped migrations: DB not reachable');
    }
  })().catch(err => console.error('Startup migrations failed:', err));
}

// Start server only when not running in a serverless environment (e.g., Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('🚀 Driver Onboarding Backend System Started!');
    console.log(`📍 Server running on port ${PORT}`);
    console.log(`🌐 API Base: http://localhost:${PORT}/api`);
    console.log(`📊 Health Check: http://localhost:${PORT}/health`);
    console.log(`📚 API Info: http://localhost:${PORT}/api`);
    console.log(`🔐 Authentication: http://localhost:${PORT}/api/auth`);
    console.log(`🚗 Driver Management: http://localhost:${PORT}/api/drivers`);
    console.log(`📄 Document Management: http://localhost:${PORT}/api/documents`);
    console.log(`👨‍💼 Admin Functions: http://localhost:${PORT}/api/admin`);
    console.log(`🔔 Notifications: http://localhost:${PORT}/api/notifications`);
    console.log(`🔗 Integration Services: http://localhost:${PORT}/api/integration`); // NEW
    console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database: PostgreSQL`);
    console.log(`🔥 Firebase: ${process.env.FIREBASE_PROJECT_ID ? 'Configured' : 'Not configured'}`);
    console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured'}`);
    console.log('✨ Ready to onboard drivers!');
  });
}

module.exports = app; 
