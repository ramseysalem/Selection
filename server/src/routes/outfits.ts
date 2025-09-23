import express from 'express';
import { z } from 'zod';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { savedOutfitStore, OutfitOccasion, createSavedOutfitSchema } from '../models/SavedOutfitPG';

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// Get all saved outfits for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const outfits = await savedOutfitStore.findByUserId(req.user!.id);
    res.json({ outfits });
  } catch (error) {
    console.error('Get saved outfits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get saved outfits by occasion
router.get('/occasion/:occasion', async (req: AuthRequest, res) => {
  try {
    const occasion = req.params.occasion as OutfitOccasion;
    
    if (!Object.values(OutfitOccasion).includes(occasion)) {
      return res.status(400).json({ error: 'Invalid occasion' });
    }

    const outfits = await savedOutfitStore.findByUserIdAndOccasion(req.user!.id, occasion);
    res.json({ outfits });
  } catch (error) {
    console.error('Get saved outfits by occasion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get saved outfit statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const stats = await savedOutfitStore.getStatsByUserId(req.user!.id);
    const totalOutfits = Object.values(stats).reduce((sum, count) => sum + count, 0);
    
    res.json({ 
      stats,
      totalOutfits,
      occasions: Object.values(OutfitOccasion)
    });
  } catch (error) {
    console.error('Get saved outfit stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save new outfit
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = createSavedOutfitSchema.parse(req.body);

    const newOutfit = await savedOutfitStore.create({
      ...validatedData,
      user_id: req.user!.id
    });

    res.status(201).json({ 
      message: 'Outfit saved successfully', 
      outfit: newOutfit 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Save outfit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single saved outfit
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const outfit = await savedOutfitStore.findById(req.params.id);
    
    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    if (outfit.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ outfit });
  } catch (error) {
    console.error('Get saved outfit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update saved outfit
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const outfit = await savedOutfitStore.findById(req.params.id);
    
    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    if (outfit.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const validatedData = createSavedOutfitSchema.partial().parse(req.body);
    
    const updatedOutfit = await savedOutfitStore.update(req.params.id, validatedData);
    
    if (!updatedOutfit) {
      return res.status(404).json({ error: 'Failed to update outfit' });
    }

    res.json({ 
      message: 'Outfit updated successfully', 
      outfit: updatedOutfit 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Update saved outfit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete saved outfit
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const outfit = await savedOutfitStore.findById(req.params.id);
    
    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    if (outfit.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = await savedOutfitStore.delete(req.params.id);
    
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete outfit' });
    }

    res.json({ message: 'Outfit deleted successfully' });
  } catch (error) {
    console.error('Delete saved outfit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;