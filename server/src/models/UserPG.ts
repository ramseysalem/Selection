import bcrypt from 'bcryptjs';
import pool from '../db/connection';

export interface User {
  id: string;
  email: string;
  password: string;
  name?: string;
  email_verified?: boolean;
  email_verified_at?: Date;
  createdAt: Date;
}

// PostgreSQL-based user storage
class UserStore {
  async create(userData: { email: string; password: string; name?: string }): Promise<User> {
    // Check if user already exists
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const query = `
      INSERT INTO users (email, password_hash, name) 
      VALUES ($1, $2, $3) 
      RETURNING id, email, password_hash as password, name, email_verified, email_verified_at, created_at as "createdAt"
    `;
    
    const values = [userData.email, hashedPassword, userData.name || null];
    const result = await pool.query(query, values);
    
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash as password, name, email_verified, email_verified_at, created_at as "createdAt" 
      FROM users 
      WHERE email = $1
    `;
    
    const result = await pool.query(query, [email]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash as password, name, email_verified, email_verified_at, created_at as "createdAt" 
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async updateProfile(id: string, updates: { name?: string; email?: string }): Promise<User | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setParts.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (setParts.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE users 
      SET ${setParts.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING id, email, password_hash as password, name, email_verified, email_verified_at, created_at as "createdAt"
    `;

    const result = await pool.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userId]
    );
  }

  // For development - create a default user
  async createDefaultUser() {
    try {
      await this.create({
        email: 'demo@example.com',
        password: 'password123',
        name: 'Demo User'
      });
      console.log('Default user created: demo@example.com / password123');
    } catch (error) {
      // User already exists, ignore
      console.log('Default user already exists');
    }
  }
}

export const userStore = new UserStore();