import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  password: string;
  name?: string;
  createdAt: Date;
}

// Simple in-memory user storage for now
// TODO: Replace with database integration
class UserStore {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map();

  async create(userData: { email: string; password: string; name?: string }): Promise<User> {
    if (this.emailIndex.has(userData.email)) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      createdAt: new Date()
    };

    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);
    
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email);
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
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
    }
  }
}

export const userStore = new UserStore();