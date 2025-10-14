import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Store for tracking IP addresses with repeated violations
const suspiciousIPs = new Map<string, { violations: number; blockedUntil?: Date }>();

// Custom key generator to handle different user scenarios
const createKeyGenerator = (prefix: string) => {
  return (req: Request): string => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Create a unique key combining IP and user agent hash
    const userAgentHash = Buffer.from(userAgent).toString('base64').slice(0, 10);
    return `${prefix}:${ip}:${userAgentHash}`;
  };
};

// Custom handler for rate limit exceeded
const createRateLimitHandler = (limitType: string) => {
  return (req: Request, res: Response) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Track violations
    const current = suspiciousIPs.get(ip) || { violations: 0 };
    current.violations += 1;
    
    // Block IP if too many violations (progressive blocking)
    if (current.violations >= 5) {
      const blockDuration = Math.min(current.violations * 5, 60); // Max 60 minutes
      current.blockedUntil = new Date(Date.now() + blockDuration * 60 * 1000);
      console.warn(`🚨 [SECURITY] Blocking IP ${ip} for ${blockDuration} minutes due to repeated rate limit violations`);
    }
    
    suspiciousIPs.set(ip, current);
    
    console.warn(`⚠️ [RATE_LIMIT] ${limitType} limit exceeded for IP: ${ip}`);
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      type: limitType,
      message: 'Please wait before making more requests',
      retryAfter: Math.ceil((res.getHeader('Retry-After') as number) || 60)
    });
  };
};

// Check if IP is currently blocked
export const checkBlockedIP = (req: Request, res: Response, next: any) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const blocked = suspiciousIPs.get(ip);
  
  if (blocked?.blockedUntil && blocked.blockedUntil > new Date()) {
    const remainingTime = Math.ceil((blocked.blockedUntil.getTime() - Date.now()) / 60000);
    console.warn(`🚨 [SECURITY] Blocked IP ${ip} attempted access (${remainingTime}m remaining)`);
    
    return res.status(429).json({
      error: 'IP temporarily blocked',
      message: `Your IP has been temporarily blocked due to suspicious activity. Please try again in ${remainingTime} minutes.`,
      blockedUntil: blocked.blockedUntil
    });
  }
  
  next();
};

// Authentication endpoints (login, register) - very strict
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  keyGenerator: createKeyGenerator('auth'),
  handler: createRateLimitHandler('authentication'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please wait 15 minutes before trying again'
  }
});

// Password reset - even stricter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  keyGenerator: createKeyGenerator('password_reset'),
  handler: createRateLimitHandler('password reset'),
  standardHeaders: true,
  legacyHeaders: false
});

// File uploads - moderate (prevent abuse)
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 minutes
  keyGenerator: createKeyGenerator('upload'),
  handler: createRateLimitHandler('file upload'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Upload limit exceeded',
    message: 'Please wait before uploading more files'
  }
});

// API endpoints - reasonable for normal usage
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  keyGenerator: createKeyGenerator('api'),
  handler: createRateLimitHandler('API'),
  standardHeaders: true,
  legacyHeaders: false
});

// AI-powered endpoints - more expensive, limit more
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 AI requests per 15 minutes
  keyGenerator: createKeyGenerator('ai'),
  handler: createRateLimitHandler('AI processing'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI processing limit exceeded',
    message: 'AI features are rate limited. Please wait before making more requests.'
  }
});

// Weather API - external service, be conservative
export const weatherLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 weather requests per 10 minutes
  keyGenerator: createKeyGenerator('weather'),
  handler: createRateLimitHandler('weather API'),
  standardHeaders: true,
  legacyHeaders: false
});

// Cleanup blocked IPs periodically (remove expired blocks)
setInterval(() => {
  const now = new Date();
  for (const [ip, data] of suspiciousIPs.entries()) {
    if (data.blockedUntil && data.blockedUntil <= now) {
      // Reset violations but keep some history
      data.violations = Math.max(0, data.violations - 2);
      data.blockedUntil = undefined;
      
      if (data.violations === 0) {
        suspiciousIPs.delete(ip);
      } else {
        suspiciousIPs.set(ip, data);
      }
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

export { suspiciousIPs };