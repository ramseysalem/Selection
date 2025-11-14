import express from 'express';
import { z } from 'zod';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// Validation schema
const wearConfirmationSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  occasion: z.string().optional()
});

// Simple wear confirmation endpoint
router.post('/wear-confirmation', async (req: AuthRequest, res) => {
  try {
    const validatedData = wearConfirmationSchema.parse(req.body);
    
    // Simply update last worn date for each item
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    const updatePromises = validatedData.itemIds.map(async (itemId) => {
      await pool.query(
        'UPDATE clothing_items SET last_worn_date = CURRENT_TIMESTAMP, wear_count = COALESCE(wear_count, 0) + 1 WHERE id = $1 AND user_id = $2',
        [itemId, req.user!.id]
      );
    });
    
    await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: `Items marked as worn - won't be suggested for 3 days`,
      itemsUpdated: validatedData.itemIds.length
    });
    
  } catch (error) {
    console.error('Wear confirmation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to confirm wear' });
  }
});

export default router;