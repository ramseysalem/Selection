import crypto from 'crypto';
import pool from '../db/connection';

// Email provider interfaces
interface EmailProvider {
  send(to: string, template: EmailTemplate): Promise<boolean>;
}

// SendGrid implementation using direct API calls
class SendGridProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async send(to: string, template: EmailTemplate): Promise<boolean> {
    try {
      const emailData = {
        personalizations: [{
          to: [{ email: to }],
          subject: template.subject
        }],
        from: { email: this.fromEmail },
        content: [
          {
            type: 'text/plain',
            value: template.text
          },
          {
            type: 'text/html',
            value: template.html
          }
        ]
      };

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (response.ok) {
        console.log(`📧 [SENDGRID] Email sent successfully to ${to}`);
        return true;
      } else {
        const errorData = await response.text();
        console.error(`📧 [SENDGRID] Failed to send email: ${response.status} - ${errorData}`);
        return false;
      }
    } catch (error) {
      console.error('📧 [SENDGRID] Network error sending email:', error);
      return false;
    }
  }
}

// Nodemailer SMTP implementation
class SMTPProvider implements EmailProvider {
  private config: any;
  private fromEmail: string;

  constructor(config: any, fromEmail: string) {
    this.config = config;
    this.fromEmail = fromEmail;
  }

  async send(to: string, template: EmailTemplate): Promise<boolean> {
    try {
      // Dynamic import to handle optional dependency
      const nodemailer = await this.loadNodemailer();
      
      const transporter = nodemailer.createTransporter(this.config);
      
      await transporter.sendMail({
        from: this.fromEmail,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
      
      console.log(`📧 [SMTP] Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error('📧 [SMTP] Failed to send email:', error);
      console.error('📧 [SMTP] Make sure to install: npm install nodemailer');
      return false;
    }
  }
  
  private async loadNodemailer(): Promise<any> {
    try {
      return require('nodemailer');
    } catch {
      throw new Error('Nodemailer package not installed. Run: npm install nodemailer');
    }
  }
}

// Development/Console provider
class ConsoleProvider implements EmailProvider {
  async send(to: string, template: EmailTemplate): Promise<boolean> {
    console.log('\n📧 [CONSOLE] Simulated email send:');
    console.log(`To: ${to}`);
    console.log(`Subject: ${template.subject}`);
    console.log('Text Content:');
    console.log(template.text);
    console.log('\n--- End Email ---\n');
    return true;
  }
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface EmailVerificationData {
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
}

interface PasswordResetData {
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
}

class EmailService {
  private readonly VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly RESET_TOKEN_EXPIRY = 1 * 60 * 60 * 1000; // 1 hour

  constructor() {
    // Debug logging at startup
    const emailProvider = process.env.EMAIL_PROVIDER || 'console';
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL;
    
    console.log(`🔍 [DEBUG] EMAIL_PROVIDER: "${emailProvider}"`);
    console.log(`🔍 [DEBUG] SENDGRID_API_KEY: ${sendGridApiKey ? 'SET' : 'MISSING'}`);
    console.log(`🔍 [DEBUG] SENDGRID_FROM_EMAIL: ${sendGridFromEmail ? sendGridFromEmail : 'MISSING'}`);
  }

  // Generate secure random token
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create email verification record
  async createEmailVerification(userId: string, email: string): Promise<string> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.VERIFICATION_TOKEN_EXPIRY);

    await pool.query(`
      INSERT INTO email_verifications (user_id, email, token, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        token = $3,
        expires_at = $4,
        created_at = NOW()
    `, [userId, email, token, expiresAt]);

    return token;
  }

  // Verify email token
  async verifyEmailToken(token: string): Promise<{ isValid: boolean; userId?: string; email?: string }> {
    const result = await pool.query(`
      SELECT user_id, email, expires_at
      FROM email_verifications 
      WHERE token = $1 AND expires_at > NOW()
    `, [token]);

    if (result.rows.length === 0) {
      return { isValid: false };
    }

    const verification = result.rows[0];
    
    // Mark user as verified and remove verification record
    await pool.query('BEGIN');
    
    try {
      await pool.query(`
        UPDATE users SET email_verified = true, email_verified_at = NOW()
        WHERE id = $1
      `, [verification.user_id]);

      await pool.query(`
        DELETE FROM email_verifications WHERE token = $1
      `, [token]);

      await pool.query('COMMIT');

      return { 
        isValid: true, 
        userId: verification.user_id,
        email: verification.email 
      };
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  // Create password reset record
  async createPasswordReset(userId: string, email: string): Promise<string> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.RESET_TOKEN_EXPIRY);

    await pool.query(`
      INSERT INTO password_resets (user_id, email, token, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id)
      DO UPDATE SET 
        token = $3,
        expires_at = $4,
        created_at = NOW()
    `, [userId, email, token, expiresAt]);

    return token;
  }

  // Verify password reset token
  async verifyPasswordResetToken(token: string): Promise<{ isValid: boolean; userId?: string; email?: string }> {
    const result = await pool.query(`
      SELECT user_id, email, expires_at
      FROM password_resets 
      WHERE token = $1 AND expires_at > NOW()
    `, [token]);

    if (result.rows.length === 0) {
      return { isValid: false };
    }

    return { 
      isValid: true, 
      userId: result.rows[0].user_id,
      email: result.rows[0].email 
    };
  }

  // Complete password reset
  async completePasswordReset(token: string): Promise<boolean> {
    const result = await pool.query(`
      DELETE FROM password_resets 
      WHERE token = $1 AND expires_at > NOW()
      RETURNING user_id
    `, [token]);

    return result.rows.length > 0;
  }

  // Generate email templates
  generateVerificationEmail(token: string, userEmail: string): EmailTemplate {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: white; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Outfit Matcher!</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up! Please click the button below to verify your email address and activate your account.</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            
            <p><strong>This link will expire in 24 hours.</strong></p>
            
            <p>If you didn't create an account with us, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Outfit Matcher. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to Outfit Matcher!

Thank you for signing up! Please verify your email address by visiting this link:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with us, please ignore this email.

© 2025 Outfit Matcher. All rights reserved.
    `;

    return {
      subject: 'Verify Your Email - Outfit Matcher',
      html,
      text
    };
  }

  generatePasswordResetEmail(token: string, userEmail: string): EmailTemplate {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: white; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #dc3545; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset the password for your Outfit Matcher account.</p>
            
            <div class="warning">
              <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </div>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            
            <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
            
            <p>For your security, this link can only be used once. If you need another password reset link, please request it again from the login page.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Outfit Matcher. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request

We received a request to reset the password for your Outfit Matcher account.

Reset your password by visiting this link:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

© 2025 Outfit Matcher. All rights reserved.
    `;

    return {
      subject: 'Password Reset Request - Outfit Matcher',
      html,
      text
    };
  }

  // Get configured email provider
  private getEmailProvider(): EmailProvider {
    const emailProvider = process.env.EMAIL_PROVIDER || 'console';
    console.log(`🔍 [DEBUG] EMAIL_PROVIDER: "${emailProvider}"`);
    
    switch (emailProvider.toLowerCase()) {
      case 'sendgrid':
        const sendGridApiKey = process.env.SENDGRID_API_KEY;
        const sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL;
        
        console.log(`🔍 [DEBUG] SENDGRID_API_KEY: ${sendGridApiKey ? 'SET' : 'MISSING'}`);
        console.log(`🔍 [DEBUG] SENDGRID_FROM_EMAIL: ${sendGridFromEmail ? sendGridFromEmail : 'MISSING'}`);
        
        if (!sendGridApiKey || !sendGridFromEmail) {
          throw new Error(`SendGrid credentials missing: API_KEY=${sendGridApiKey ? 'SET' : 'MISSING'}, FROM_EMAIL=${sendGridFromEmail || 'MISSING'}`);
        }
        
        console.log('🔧 [EMAIL] Initializing SendGrid provider...');
        return new SendGridProvider(sendGridApiKey, sendGridFromEmail);
        
      case 'smtp':
        const smtpConfig = {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        };
        const smtpFromEmail = process.env.SMTP_FROM_EMAIL || process.env.FROM_EMAIL;
        
        if (!smtpConfig.host || !smtpConfig.auth.user || !smtpFromEmail) {
          console.warn('⚠️ [EMAIL] SMTP credentials missing, falling back to console');
          return new ConsoleProvider();
        }
        
        return new SMTPProvider(smtpConfig, smtpFromEmail);
        
      default:
        return new ConsoleProvider();
    }
  }

  // Production-ready email sending with multiple provider support
  async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    // Validate email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.error(`📧 [EMAIL] Invalid email address: ${to}`);
      return false;
    }
    
    const provider = this.getEmailProvider();
    
    try {
      const success = await provider.send(to, template);
      
      if (success) {
        console.log(`📧 [EMAIL] Successfully sent "${template.subject}" to ${to}`);
      } else {
        console.error(`📧 [EMAIL] Failed to send "${template.subject}" to ${to}`);
      }
      
      return success;
    } catch (error) {
      console.error(`📧 [EMAIL] Error sending email to ${to}:`, error);
      return false;
    }
  }

  // Initialize database tables
  async initializeTables(): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Add email verification columns to users table
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP
      `);

      // Create email verifications table
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_verifications (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          token VARCHAR(64) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(user_id)
        )
      `);

      // Create password resets table
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          token VARCHAR(64) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(user_id)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
        CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON email_verifications(expires_at);
        CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
        CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);
      `);

      console.log('✅ Email service tables initialized');

    } catch (error) {
      console.error('❌ Error initializing email service tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Cleanup expired tokens (run periodically)
  async cleanup(): Promise<void> {
    await pool.query(`
      DELETE FROM email_verifications WHERE expires_at < NOW()
    `);

    await pool.query(`
      DELETE FROM password_resets WHERE expires_at < NOW()
    `);

    console.log('🧹 Email service cleanup completed');
  }
}

export const emailService = new EmailService();

// Email configuration validation
export const validateEmailConfiguration = (): { isValid: boolean; provider: string; errors: string[] } => {
  const errors: string[] = [];
  const provider = process.env.EMAIL_PROVIDER || 'console';
  
  switch (provider.toLowerCase()) {
    case 'sendgrid':
      if (!process.env.SENDGRID_API_KEY) {
        errors.push('SENDGRID_API_KEY environment variable is required');
      }
      if (!process.env.SENDGRID_FROM_EMAIL && !process.env.FROM_EMAIL) {
        errors.push('SENDGRID_FROM_EMAIL or FROM_EMAIL environment variable is required');
      }
      break;
      
    case 'smtp':
      if (!process.env.SMTP_HOST) {
        errors.push('SMTP_HOST environment variable is required');
      }
      if (!process.env.SMTP_USER) {
        errors.push('SMTP_USER environment variable is required');
      }
      if (!process.env.SMTP_PASS) {
        errors.push('SMTP_PASS environment variable is required');
      }
      if (!process.env.SMTP_FROM_EMAIL && !process.env.FROM_EMAIL) {
        errors.push('SMTP_FROM_EMAIL or FROM_EMAIL environment variable is required');
      }
      break;
      
    case 'console':
      // Console provider doesn't need configuration
      break;
      
    default:
      errors.push(`Unsupported email provider: ${provider}. Supported: sendgrid, smtp, console`);
  }
  
  return {
    isValid: errors.length === 0,
    provider,
    errors
  };
};

// Email provider health check
export const testEmailConfiguration = async (): Promise<{ success: boolean; provider: string; error?: string }> => {
  const validation = validateEmailConfiguration();
  
  if (!validation.isValid) {
    return {
      success: false,
      provider: validation.provider,
      error: validation.errors.join(', ')
    };
  }
  
  try {
    const testEmail = {
      subject: 'Email Configuration Test',
      html: '<p>This is a test email to verify email configuration.</p>',
      text: 'This is a test email to verify email configuration.'
    };
    
    const testAddress = process.env.TEST_EMAIL || 'test@example.com';
    const provider = emailService['getEmailProvider']();
    
    if (provider instanceof ConsoleProvider) {
      return { success: true, provider: 'console' };
    }
    
    // For real providers, you might want to send to a test address
    // const success = await provider.send(testAddress, testEmail);
    
    return { success: true, provider: validation.provider };
  } catch (error) {
    return {
      success: false,
      provider: validation.provider,
      error: (error as Error).message
    };
  }
};