import pool from '../db/connection';

interface LoginAttempt {
  email: string;
  ip: string;
  attempts: number;
  lockedUntil?: Date;
  lastAttempt: Date;
}

interface SecurityEvent {
  id: string;
  userId?: string;
  email: string;
  eventType: 'login_success' | 'login_failure' | 'account_locked' | 'account_unlocked' | 'password_reset_requested' | 'password_changed';
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

class AccountSecurityManager {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 30;
  private readonly ATTEMPT_WINDOW_MINUTES = 15;

  // Track failed login attempts
  async recordLoginAttempt(email: string, ip: string, success: boolean, userAgent: string): Promise<{ isLocked: boolean; attemptsRemaining: number; lockedUntil?: Date }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Log the security event
      await this.logSecurityEvent({
        email,
        eventType: success ? 'login_success' : 'login_failure',
        ipAddress: ip,
        userAgent,
        metadata: { success }
      });

      if (success) {
        // Reset attempts on successful login
        await client.query(`
          DELETE FROM login_attempts 
          WHERE email = $1 OR ip_address = $2
        `, [email, ip]);
        
        await client.query('COMMIT');
        return { isLocked: false, attemptsRemaining: this.MAX_LOGIN_ATTEMPTS };
      }

      // Handle failed login
      const attemptWindow = new Date(Date.now() - this.ATTEMPT_WINDOW_MINUTES * 60 * 1000);
      
      // Get current attempts
      const existingAttempt = await client.query(`
        SELECT attempts, locked_until, last_attempt 
        FROM login_attempts 
        WHERE (email = $1 OR ip_address = $2) AND last_attempt > $3
      `, [email, ip, attemptWindow]);

      let attempts = 1;
      let lockedUntil: Date | undefined;

      if (existingAttempt.rows.length > 0) {
        const existing = existingAttempt.rows[0];
        
        // Check if currently locked
        if (existing.locked_until && new Date(existing.locked_until) > new Date()) {
          await client.query('COMMIT');
          return { 
            isLocked: true, 
            attemptsRemaining: 0, 
            lockedUntil: new Date(existing.locked_until) 
          };
        }

        attempts = existing.attempts + 1;
      }

      // Check if we should lock the account
      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION_MINUTES * 60 * 1000);
        
        // Log lockout event
        await this.logSecurityEvent({
          email,
          eventType: 'account_locked',
          ipAddress: ip,
          userAgent,
          metadata: { attempts, lockedUntil }
        });
      }

      // Upsert login attempt record
      await client.query(`
        INSERT INTO login_attempts (email, ip_address, attempts, locked_until, last_attempt)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (email, ip_address)
        DO UPDATE SET 
          attempts = $3,
          locked_until = $4,
          last_attempt = NOW()
      `, [email, ip, attempts, lockedUntil]);

      await client.query('COMMIT');

      return {
        isLocked: lockedUntil !== undefined,
        attemptsRemaining: Math.max(0, this.MAX_LOGIN_ATTEMPTS - attempts),
        lockedUntil
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Check if account is currently locked
  async isAccountLocked(email: string, ip: string): Promise<{ isLocked: boolean; lockedUntil?: Date; attemptsRemaining: number }> {
    const attemptWindow = new Date(Date.now() - this.ATTEMPT_WINDOW_MINUTES * 60 * 1000);
    
    const result = await pool.query(`
      SELECT attempts, locked_until 
      FROM login_attempts 
      WHERE (email = $1 OR ip_address = $2) AND last_attempt > $3
    `, [email, ip, attemptWindow]);

    if (result.rows.length === 0) {
      return { isLocked: false, attemptsRemaining: this.MAX_LOGIN_ATTEMPTS };
    }

    const attempt = result.rows[0];
    const lockedUntil = attempt.locked_until ? new Date(attempt.locked_until) : undefined;
    
    if (lockedUntil && lockedUntil > new Date()) {
      return { 
        isLocked: true, 
        lockedUntil,
        attemptsRemaining: 0 
      };
    }

    return { 
      isLocked: false, 
      attemptsRemaining: Math.max(0, this.MAX_LOGIN_ATTEMPTS - attempt.attempts)
    };
  }

  // Manually unlock account (admin function)
  async unlockAccount(email: string): Promise<void> {
    await pool.query(`
      DELETE FROM login_attempts WHERE email = $1
    `, [email]);

    await this.logSecurityEvent({
      email,
      eventType: 'account_unlocked',
      ipAddress: 'admin',
      userAgent: 'admin',
      metadata: { manual: true }
    });
  }

  // Log security events for audit trail
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    await pool.query(`
      INSERT INTO security_events (user_id, email, event_type, ip_address, user_agent, metadata, timestamp)
      VALUES (
        (SELECT id FROM users WHERE email = $1), 
        $1, $2, $3, $4, $5, NOW()
      )
    `, [
      event.email,
      event.eventType,
      event.ipAddress,
      event.userAgent,
      event.metadata ? JSON.stringify(event.metadata) : null
    ]);
  }

  // Get security events for user (audit trail)
  async getSecurityEvents(email: string, limit: number = 50): Promise<SecurityEvent[]> {
    const result = await pool.query(`
      SELECT id, user_id, email, event_type, ip_address, user_agent, metadata, timestamp
      FROM security_events 
      WHERE email = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `, [email, limit]);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      eventType: row.event_type,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamp: new Date(row.timestamp)
    }));
  }

  // Initialize database tables
  async initializeTables(): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Create login_attempts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          ip_address INET NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 1,
          locked_until TIMESTAMP,
          last_attempt TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(email, ip_address)
        )
      `);

      // Create security_events table  
      await client.query(`
        CREATE TABLE IF NOT EXISTS security_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id),
          email VARCHAR(255) NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          ip_address INET NOT NULL,
          user_agent TEXT,
          metadata JSONB,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_last_attempt ON login_attempts(last_attempt);
        CREATE INDEX IF NOT EXISTS idx_security_events_email ON security_events(email);
        CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
      `);

      console.log('✅ Account security tables initialized');

    } catch (error) {
      console.error('❌ Error initializing security tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Cleanup old records (run periodically)
  async cleanup(): Promise<void> {
    const expiredCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    const eventsCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days

    await pool.query(`
      DELETE FROM login_attempts 
      WHERE last_attempt < $1 AND (locked_until IS NULL OR locked_until < NOW())
    `, [expiredCutoff]);

    await pool.query(`
      DELETE FROM security_events 
      WHERE timestamp < $1 AND event_type NOT IN ('account_locked', 'password_changed')
    `, [eventsCutoff]);

    console.log('🧹 Security records cleanup completed');
  }
}

export const accountSecurity = new AccountSecurityManager();
export { SecurityEvent };