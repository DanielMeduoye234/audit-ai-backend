import db from '../database/db';

export interface Budget {
  id?: number;
  user_id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string;
  alert_threshold?: number;
  created_at?: string;
}

export interface BudgetVariance {
  budget: Budget;
  actual: number;
  variance: number;
  variancePercentage: number;
  status: 'under' | 'on_track' | 'over';
}

class BudgetRepository {
  createBudget(budget: Budget): number {
    const stmt = db.prepare(`
      INSERT INTO budgets (user_id, category, amount, period, start_date, end_date, alert_threshold)
      VALUES (@user_id, @category, @amount, @period, @start_date, @end_date, @alert_threshold)
    `);
    const info = stmt.run(budget);
    return info.lastInsertRowid as number;
  }

  getBudgets(userId: string): Budget[] {
    const stmt = db.prepare(`
      SELECT * FROM budgets 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(userId) as Budget[];
  }

  getBudgetById(id: number): Budget | undefined {
    const stmt = db.prepare(`SELECT * FROM budgets WHERE id = ?`);
    return stmt.get(id) as Budget | undefined;
  }

  getActiveBudgets(userId: string): Budget[] {
    const currentDate = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT * FROM budgets 
      WHERE user_id = ? 
      AND start_date <= ?
      AND (end_date IS NULL OR end_date >= ?)
      ORDER BY category
    `);
    return stmt.all(userId, currentDate, currentDate) as Budget[];
  }

  updateBudget(budget: Budget): void {
    const stmt = db.prepare(`
      UPDATE budgets 
      SET category = @category, amount = @amount, period = @period, 
          start_date = @start_date, end_date = @end_date, alert_threshold = @alert_threshold
      WHERE id = @id
    `);
    stmt.run(budget);
  }

  deleteBudget(id: number): void {
    const stmt = db.prepare(`DELETE FROM budgets WHERE id = ?`);
    stmt.run(id);
  }

  getBudgetVariance(userId: string, startDate: string, endDate: string): BudgetVariance[] {
    const budgets = this.getActiveBudgets(userId);
    const variances: BudgetVariance[] = [];

    for (const budget of budgets) {
      // Get actual spending for this category in the period
      const stmt = db.prepare(`
        SELECT SUM(amount) as total
        FROM transactions
        WHERE user_id = ?
        AND category = ?
        AND date >= ?
        AND date <= ?
        AND type = 'expense'
      `);
      
      const result = stmt.get(userId, budget.category, startDate, endDate) as { total: number };
      const actual = result.total || 0;
      const variance = budget.amount - actual;
      const variancePercentage = budget.amount > 0 ? (variance / budget.amount) * 100 : 0;
      
      let status: 'under' | 'on_track' | 'over' = 'on_track';
      const threshold = budget.alert_threshold || 0.9;
      
      if (actual > budget.amount) {
        status = 'over';
      } else if (actual < budget.amount * threshold) {
        status = 'under';
      }

      variances.push({
        budget,
        actual,
        variance,
        variancePercentage,
        status
      });
    }

    return variances;
  }

  checkBudgetAlerts(userId: string): BudgetVariance[] {
    const currentDate = new Date();
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    const endDate = currentDate.toISOString().split('T')[0];
    
    const variances = this.getBudgetVariance(userId, startDate, endDate);
    return variances.filter(v => v.status === 'over' || (v.actual / v.budget.amount) >= (v.budget.alert_threshold || 0.9));
  }
}

export default new BudgetRepository();
