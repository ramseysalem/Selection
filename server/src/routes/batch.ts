import express from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { wardrobeBatchProcessor } from '../services/wardrobeBatchProcessor';

const router = express.Router();

// Start batch processing of unanalyzed wardrobe items
router.post('/process-wardrobe', verifyToken, async (req: AuthRequest, res) => {
  console.log('🔄 [BATCH API] Processing wardrobe batch request...');
  
  try {
    if (wardrobeBatchProcessor.isCurrentlyProcessing()) {
      return res.status(409).json({ 
        error: 'Batch processing already in progress',
        stats: wardrobeBatchProcessor.getStats()
      });
    }

    const { batchSize = 5 } = req.body;
    
    console.log(`📊 [BATCH API] Starting batch processing for user ${req.user!.id}, batch size: ${batchSize}`);

    // Start batch processing (this runs in background)
    const stats = await wardrobeBatchProcessor.processUnanalyzedItems(req.user!.id, batchSize);

    res.json({
      success: true,
      message: 'Batch processing completed',
      stats: stats
    });

  } catch (error) {
    console.error('❌ [BATCH API] Batch processing failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Batch processing failed',
      stats: wardrobeBatchProcessor.getStats()
    });
  }
});

// Get batch processing status
router.get('/status', verifyToken, async (req: AuthRequest, res) => {
  const stats = wardrobeBatchProcessor.getStats();
  const isProcessing = wardrobeBatchProcessor.isCurrentlyProcessing();
  
  res.json({
    isProcessing,
    stats,
    message: isProcessing ? 'Batch processing in progress' : 'No active batch processing'
  });
});

export default router;