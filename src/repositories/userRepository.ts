import db from '../database/db';

export interface User {
  id?: number;
  user_id: string;
  name: string;
  email: string;
  company: string;
  profile_picture?: string;
  created_at?: string;
}

class UserRepository {
  getUser(userId: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
    return stmt.get(userId) as User || null;
  }

  createUser(user: User): number {
    const stmt = db.prepare(`
      INSERT INTO users (user_id, name, email, company, profile_picture)
      VALUES (@user_id, @name, @email, @company, @profile_picture)
    `);
    const info = stmt.run(user);
    return info.lastInsertRowid as number;
  }

  updateUser(user: User): void {
    const stmt = db.prepare(`
      UPDATE users 
      SET name = @name, email = @email, company = @company, profile_picture = @profile_picture
      WHERE user_id = @user_id
    `);
    stmt.run(user);
  }

  getUserStats(userId: string): {
    totalTransactions: number;
    totalRevenue: number;
    totalExpenses: number;
    accountAge: number;
  } {
    const transactionStmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions 
      WHERE user_id = ?
    `);
    
    const userStmt = db.prepare('SELECT created_at FROM users WHERE user_id = ?');
    
    const transData = transactionStmt.get(userId) as any;
    const userData = userStmt.get(userId) as any;
    
    const accountAge = userData?.created_at 
      ? Math.floor((Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalTransactions: transData?.total || 0,
      totalRevenue: transData?.revenue || 0,
      totalExpenses: transData?.expenses || 0,
      accountAge
    };
  }
}

export default new UserRepository();
