import express from 'express';
import { z } from 'zod';
import { userStore } from '../models/UserPG';
import { generateTokens, verifyRefreshToken, verifyToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
});

const refreshSchema = z.object({
  refreshToken: z.string()
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    
    const user = await userStore.create({ email, password, name });
    const tokens = generateTokens({ id: user.id, email: user.email });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      ...tokens
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    if ((error as Error).message === 'User already exists') {
      return res.status(409).json({ error: 'User already exists' });
    }

    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const user = await userStore.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await userStore.validatePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokens = generateTokens({ id: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      ...tokens
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    
    const decoded = verifyRefreshToken(refreshToken);
    const tokens = generateTokens({ id: decoded.id, email: decoded.email });

    res.json(tokens);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// Get current user (protected route)
router.get('/me', verifyToken, async (req: AuthRequest, res) => {
  try {
    const user = await userStore.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile endpoint
const updateProfileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional()
});

router.put('/profile', verifyToken, async (req: AuthRequest, res) => {
  try {
    const updates = updateProfileSchema.parse(req.body);
    
    const updatedUser = await userStore.updateProfile(req.user!.id, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint (client should discard tokens)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

export default router;