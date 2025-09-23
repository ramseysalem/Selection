import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { userStore } from './models/UserPG';
import { wardrobeStore } from './models/WardrobeItemPG';
import { savedOutfitStore } from './models/SavedOutfitPG';
import pool from './db/connection';

// Load environment variables
config();

// Initialize express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Routes will be imported here
import authRoutes from './routes/auth';
import wardrobeRoutes from './routes/wardrobe';
import outfitRoutes from './routes/outfits';
import weatherRoutes from './routes/weather';
import aiTestRoutes from './routes/ai-test';
import batchRoutes from './routes/batch';
import aiCorrectionRoutes from './routes/ai-correction';

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/outfits', outfitRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/ai-test', aiTestRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/ai-correction', aiCorrectionRoutes);

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
    
    // Initialize default user for development
    await userStore.createDefaultUser();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
});
