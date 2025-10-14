import express from 'express';
import { z } from 'zod';
import { userStore } from '../models/UserPG';
import { generateTokens, verifyRefreshToken, verifyToken, AuthRequest } from '../middleware/auth';
import { validatePassword, generatePasswordRequirements } from '../utils/passwordValidation';
import { accountSecurity } from '../utils/accountSecurity';
import { inputSanitizer, sanitizeRequestBody } from '../utils/inputSanitization';
import { emailService } from '../utils/emailService';

const router = express.Router();

// Apply input sanitization to all auth routes
router.use(sanitizeRequestBody);

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8), // Updated minimum length
  name: z.string().optional()
});

const refreshSchema = z.object({
  refreshToken: z.string()
});

const verifyEmailSchema = z.object({
  token: z.string().min(1)
});

const passwordResetRequestSchema = z.object({
  email: z.string().email()
});

const passwordResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

// Get password requirements endpoint
router.get('/password-requirements', (req, res) => {
  res.json({
    requirements: generatePasswordRequirements()
  });
});

// Register endpoint
router.post('/register', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  try {
    let { email, password, name } = registerSchema.parse(req.body);
    
    // Sanitize inputs
    email = inputSanitizer.sanitizeEmail(email);
    name = name ? inputSanitizer.sanitizeName(name) : undefined;
    
    if (!email) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        details: passwordValidation.errors,
        strength: passwordValidation.strength,
        requirements: generatePasswordRequirements()
      });
    }
    
    const user = await userStore.create({ email, password, name });
    
    // Generate email verification token
    const verificationToken = await emailService.createEmailVerification(user.id, user.email);
    
    // Send verification email
    const emailTemplate = emailService.generateVerificationEmail(verificationToken, user.email);
    await emailService.sendEmail(user.email, emailTemplate);
    
    const tokens = generateTokens({ id: user.id, email: user.email });

    // Log successful registration
    await accountSecurity.logSecurityEvent({
      email: user.email,
      eventType: 'login_success',
      ipAddress: ip,
      userAgent,
      metadata: { registration: true }
    });

    res.status(201).json({
      message: 'User created successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: false
      },
      passwordStrength: passwordValidation.strength,
      verificationEmailSent: true,
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
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  try {
    let { email, password } = loginSchema.parse(req.body);
    
    // Sanitize email
    email = inputSanitizer.sanitizeEmail(email);
    
    if (!email) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if account is locked
    const lockStatus = await accountSecurity.isAccountLocked(email, ip);
    if (lockStatus.isLocked) {
      const remainingTime = lockStatus.lockedUntil 
        ? Math.ceil((lockStatus.lockedUntil.getTime() - Date.now()) / 60000)
        : 30;
      
      return res.status(429).json({
        error: 'Account temporarily locked',
        message: `Account locked due to multiple failed login attempts. Try again in ${remainingTime} minutes.`,
        lockedUntil: lockStatus.lockedUntil,
        attemptsRemaining: 0
      });
    }
    
    const user = await userStore.findByEmail(email);
    if (!user) {
      // Record failed attempt even if user doesn't exist (prevent enumeration)
      await accountSecurity.recordLoginAttempt(email, ip, false, userAgent);
      return res.status(401).json({ 
        error: 'Invalid credentials',
        attemptsRemaining: lockStatus.attemptsRemaining - 1
      });
    }

    const isValidPassword = await userStore.validatePassword(password, user.password);
    if (!isValidPassword) {
      const attemptResult = await accountSecurity.recordLoginAttempt(email, ip, false, userAgent);
      
      const response: any = { error: 'Invalid credentials' };
      
      if (attemptResult.isLocked) {
        const remainingTime = attemptResult.lockedUntil 
          ? Math.ceil((attemptResult.lockedUntil.getTime() - Date.now()) / 60000)
          : 30;
        
        response.error = 'Account locked due to multiple failed attempts';
        response.message = `Account locked for ${remainingTime} minutes`;
        response.lockedUntil = attemptResult.lockedUntil;
        return res.status(429).json(response);
      } else {
        response.attemptsRemaining = attemptResult.attemptsRemaining;
        response.message = `${attemptResult.attemptsRemaining} attempts remaining before account lockout`;
      }
      
      return res.status(401).json(response);
    }

    // Successful login - reset attempts and generate tokens
    await accountSecurity.recordLoginAttempt(email, ip, true, userAgent);
    const tokens = generateTokens({ id: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified || false
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
        name: user.name,
        emailVerified: user.email_verified || false
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

// Email verification endpoint
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    
    const verificationResult = await emailService.verifyEmailToken(token);
    
    if (!verificationResult.isValid) {
      return res.status(400).json({
        error: 'Invalid or expired verification token',
        message: 'The verification link may have expired. Please request a new one.'
      });
    }
    
    // Log verification event
    await accountSecurity.logSecurityEvent({
      email: verificationResult.email!,
      eventType: 'login_success',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      metadata: { emailVerified: true }
    });
    
    res.json({
      message: 'Email verified successfully',
      emailVerified: true
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend verification email
router.post('/resend-verification', verifyToken, async (req: AuthRequest, res) => {
  try {
    const user = await userStore.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    // Generate new verification token
    const verificationToken = await emailService.createEmailVerification(user.id, user.email);
    
    // Send verification email
    const emailTemplate = emailService.generateVerificationEmail(verificationToken, user.email);
    await emailService.sendEmail(user.email, emailTemplate);
    
    res.json({
      message: 'Verification email sent successfully',
      verificationEmailSent: true
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Password reset request
router.post('/forgot-password', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  try {
    let { email } = passwordResetRequestSchema.parse(req.body);
    
    // Sanitize email
    email = inputSanitizer.sanitizeEmail(email);
    
    if (!email) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const user = await userStore.findByEmail(email);
    
    // Always return success to prevent email enumeration
    const successResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.',
      resetEmailSent: true
    };
    
    if (!user) {
      // Log suspicious activity for non-existent emails
      await accountSecurity.logSecurityEvent({
        email,
        eventType: 'password_reset_requested',
        ipAddress: ip,
        userAgent,
        metadata: { userExists: false }
      });
      
      return res.json(successResponse);
    }
    
    // Generate password reset token
    const resetToken = await emailService.createPasswordReset(user.id, user.email);
    
    // Send reset email
    const emailTemplate = emailService.generatePasswordResetEmail(resetToken, user.email);
    await emailService.sendEmail(user.email, emailTemplate);
    
    // Log password reset request
    await accountSecurity.logSecurityEvent({
      email: user.email,
      eventType: 'password_reset_requested',
      ipAddress: ip,
      userAgent,
      metadata: { userExists: true }
    });
    
    res.json(successResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Password reset completion
router.post('/reset-password', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  try {
    const { token, newPassword } = passwordResetSchema.parse(req.body);
    
    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        details: passwordValidation.errors,
        strength: passwordValidation.strength,
        requirements: generatePasswordRequirements()
      });
    }
    
    // Verify reset token
    const tokenResult = await emailService.verifyPasswordResetToken(token);
    
    if (!tokenResult.isValid) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        message: 'The reset link may have expired. Please request a new password reset.'
      });
    }
    
    // Update user password
    const user = await userStore.findById(tokenResult.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await userStore.updatePassword(tokenResult.userId!, newPassword);
    
    // Complete password reset (removes token)
    await emailService.completePasswordReset(token);
    
    // Log password change
    await accountSecurity.logSecurityEvent({
      email: user.email,
      eventType: 'password_changed',
      ipAddress: ip,
      userAgent,
      metadata: { method: 'reset_token' }
    });
    
    res.json({
      message: 'Password reset successfully',
      passwordChanged: true
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint (client should discard tokens)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

export default router;