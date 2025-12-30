import db from '../database/db';

export interface Transaction {
  id?: number;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  created_at?: string;
}

class TransactionRepository {
  addTransaction(transaction: Transaction): number {
    const stmt = db.prepare(`
      INSERT INTO transactions (user_id, date, description, amount, category, type)
      VALUES (@user_id, @date, @description, @amount, @category, @type)
    `);
    const info = stmt.run(transaction);
    return info.lastInsertRowid as number;
  }

  getRecentTransactions(userId: string, limit: number = 10): Transaction[] {
    const stmt = db.prepare(`
      SELECT * FROM transactions 
      WHERE user_id = ? 
      ORDER BY date DESC, created_at DESC 
      LIMIT ?
    `);
    return stmt.all(userId, limit) as Transaction[];
  }

  getFinancialSummary(userId: string): { revenue: number; expenses: number; profit: number } {
    const stmt = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions 
      WHERE user_id = ?
    `);
    
    const result = stmt.get(userId) as { revenue: number; expenses: number };
    const revenue = result.revenue || 0;
    const expenses = result.expenses || 0;
    
    return {
      revenue,
      expenses,
      profit: revenue - expenses
    };
  }

  updateTransaction(transaction: Transaction): void {
    const stmt = db.prepare(`
      UPDATE transactions 
      SET date = @date, description = @description, amount = @amount, 
          category = @category, type = @type
      WHERE id = @id
    `);
    stmt.run(transaction);
  }

  deleteTransaction(id: number): void {
    const stmt = db.prepare(`DELETE FROM transactions WHERE id = ?`);
    stmt.run(id);
  }

  // Advanced query methods for analytics
  getTransactionsByDateRange(userId: string, startDate: string, endDate: string): Transaction[] {
    const stmt = db.prepare(`
      SELECT * FROM transactions
      WHERE user_id = ?
      AND date >= ?
      AND date <= ?
      ORDER BY date DESC, created_at DESC
    `);
    return stmt.all(userId, startDate, endDate) as Transaction[];
  }

  getTransactionsByCategory(userId: string, category: string, startDate?: string, endDate?: string): Transaction[] {
    let query = `SELECT * FROM transactions WHERE user_id = ? AND category = ?`;
    const params: any[] = [userId, category];
    
    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY date DESC`;
    
    const stmt = db.prepare(query);
    return stmt.all(...params) as Transaction[];
  }

  getCategoryTotals(userId: string, startDate?: string, endDate?: string): { category: string; total: number; type: string }[] {
    let query = `
      SELECT category, type, SUM(amount) as total
      FROM transactions
      WHERE user_id = ?
    `;
    const params: any[] = [userId];
    
    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }
    
    query += ` GROUP BY category, type ORDER BY total DESC`;
    
    const stmt = db.prepare(query);
    return stmt.all(...params) as any[];
  }

  getMonthlyComparison(userId: string, months: number = 3): any[] {
    const stmt = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as profit
      FROM transactions
      WHERE user_id = ?
      AND date >= date('now', '-' || ? || ' months')
      GROUP BY month
      ORDER BY month DESC
    `);
    return stmt.all(userId, months) as any[];
  }

  // Detect potentially anomalous transactions
  getAnomalousTransactions(userId: string, threshold: number = 3): Transaction[] {
    // Get average and standard deviation for each category
    const statsStmt = db.prepare(`
      SELECT 
        category,
        type,
        AVG(amount) as avg_amount,
        COUNT(*) as count
      FROM transactions
      WHERE user_id = ?
      GROUP BY category, type
      HAVING count >= 3
    `);
    
    const stats = statsStmt.all(userId) as any[];
    const anomalies: Transaction[] = [];
    
    for (const stat of stats) {
      // Get transactions that are significantly higher than average
      const transStmt = db.prepare(`
        SELECT * FROM transactions
        WHERE user_id = ?
        AND category = ?
        AND type = ?
        AND amount > ?
        ORDER BY amount DESC
      `);
      
      const highThreshold = stat.avg_amount * threshold;
      const highTransactions = transStmt.all(userId, stat.category, stat.type, highThreshold) as Transaction[];
      anomalies.push(...highTransactions);
    }
    
    return anomalies;
  }

  // Detect recurring transaction patterns
  detectRecurringTransactions(userId: string): any[] {
    const stmt = db.prepare(`
      SELECT 
        description,
        category,
        type,
        AVG(amount) as avg_amount,
        COUNT(*) as occurrence_count,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM transactions
      WHERE user_id = ?
      GROUP BY description, category, type
      HAVING occurrence_count >= 3
      ORDER BY occurrence_count DESC
    `);
    
    return stmt.all(userId) as any[];
  }

  getAllTransactions(userId: string): Transaction[] {
    const stmt = db.prepare(`
      SELECT * FROM transactions
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
    `);
    return stmt.all(userId) as Transaction[];
  }

  /**
   * Bulk update category for transactions matching a description pattern (vendor)
   */
  bulkUpdateCategory(userId: string, vendorName: string, newCategory: string): number {
    const stmt = db.prepare(`
      UPDATE transactions 
      SET category = @newCategory
      WHERE user_id = @userId 
      AND description LIKE @pattern
    `);
    
    const info = stmt.run({
      newCategory,
      userId,
      pattern: `%${vendorName}%`
    });
    
    return info.changes;
  }
}


export default new TransactionRepository();
