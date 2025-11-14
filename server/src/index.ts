import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { userStore } from './models/UserPG';
import { wardrobeStore } from './models/WardrobeItemPG';
import { savedOutfitStore } from './models/SavedOutfitPG';
import { accountSecurity } from './utils/accountSecurity';
import { emailService, validateEmailConfiguration } from './utils/emailService';
import { sanitizeRequestBody, sanitizeQueryParams } from './utils/inputSanitization';
import pool from './db/connection';
import { 
  checkBlockedIP, 
  authLimiter, 
  uploadLimiter, 
  apiLimiter, 
  aiLimiter, 
  weatherLimiter 
} from './middleware/rateLimiting';

// Load environment variables
config();

// Initialize express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request size limits for different types of requests
app.use('/api/wardrobe/upload', express.json({ limit: '20mb' })); // Image uploads
app.use('/api/auth', express.json({ limit: '1mb' })); // Auth requests
app.use(express.json({ limit: '5mb' })); // Default limit
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Global IP blocking check (must be before other rate limiters)
app.use(checkBlockedIP);

// Global input sanitization (apply to all routes)
app.use(sanitizeQueryParams);
app.use(sanitizeRequestBody);

// Apply different rate limits to different route groups

// Routes will be imported here
import authRoutes from './routes/auth';
import wardrobeRoutes from './routes/wardrobe';
import outfitRoutes from './routes/outfits';
import weatherRoutes from './routes/weather';
import aiTestRoutes from './routes/ai-test';
import batchRoutes from './routes/batch';
import aiCorrectionRoutes from './routes/ai-correction';

// Apply specific rate limits to different routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/wardrobe', uploadLimiter, wardrobeRoutes); // Has photo uploads
app.use('/api/outfits', apiLimiter, outfitRoutes);
app.use('/api/weather', weatherLimiter, weatherRoutes);
app.use('/api/ai-test', aiLimiter, aiTestRoutes); // AI processing
app.use('/api/batch', aiLimiter, batchRoutes); // Batch AI processing
app.use('/api/ai-correction', aiLimiter, aiCorrectionRoutes); // AI processing
app.use('/api/usage', apiLimiter, require('./routes/usage').default); // Usage tracking

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    
    // Initialize database tables
    await savedOutfitStore.initializeTables();
    await accountSecurity.initializeTables();
    await emailService.initializeTables();
    
    // Initialize default user for development
    await userStore.createDefaultUser();
    
    // Validate email configuration
    const emailConfig = validateEmailConfiguration();
    if (emailConfig.isValid) {
      console.log(`📧 [EMAIL] Provider configured: ${emailConfig.provider}`);
    } else {
      console.warn(`⚠️ [EMAIL] Configuration issues with ${emailConfig.provider}:`, emailConfig.errors.join(', '));
      console.warn('📧 [EMAIL] Falling back to console logging for emails');
    }
    
    // Set up periodic cleanup tasks
    setInterval(async () => {
      try {
        await accountSecurity.cleanup();
        await emailService.cleanup();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
});
