import db from '../database/db';
import transactionRepository from './transactionRepository';

export interface CashFlowForecast {
  id?: number;
  user_id: string;
  forecast_date: string;
  projected_income: number;
  projected_expenses: number;
  projected_balance: number;
  confidence_level: number;
  assumptions?: string;
  created_at?: string;
}

export interface TrendData {
  period: string;
  income: number;
  expenses: number;
  profit: number;
}

export interface SpendingPattern {
  category: string;
  total: number;
  count: number;
  average: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

class AnalyticsRepository {
  // Get monthly trends for the last N months
  getMonthlyTrends(userId: string, months: number = 6): TrendData[] {
    const stmt = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as period,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as profit
      FROM transactions
      WHERE user_id = ?
      AND date >= date('now', '-' || ? || ' months')
      GROUP BY period
      ORDER BY period DESC
    `);
    
    return stmt.all(userId, months) as TrendData[];
  }

  // Get spending patterns by category
  getSpendingPatterns(userId: string, startDate?: string, endDate?: string): SpendingPattern[] {
    let query = `
      SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as count,
        AVG(amount) as average
      FROM transactions
      WHERE user_id = ?
      AND type = 'expense'
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
    
    query += ` GROUP BY category ORDER BY total DESC`;
    
    const stmt = db.prepare(query);
    const results = stmt.all(...params) as any[];
    
    const totalExpenses = results.reduce((sum, r) => sum + r.total, 0);
    
    return results.map(r => ({
      category: r.category,
      total: r.total,
      count: r.count,
      average: r.average,
      percentage: totalExpenses > 0 ? (r.total / totalExpenses) * 100 : 0,
      trend: this.getCategoryTrend(userId, r.category)
    }));
  }

  // Determine if spending in a category is increasing, decreasing, or stable
  private getCategoryTrend(userId: string, category: string): 'increasing' | 'decreasing' | 'stable' {
    const stmt = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(amount) as total
      FROM transactions
      WHERE user_id = ?
      AND category = ?
      AND type = 'expense'
      AND date >= date('now', '-3 months')
      GROUP BY month
      ORDER BY month ASC
    `);
    
    const monthlyData = stmt.all(userId, category) as { month: string; total: number }[];
    
    if (monthlyData.length < 2) return 'stable';
    
    const first = monthlyData[0].total;
    const last = monthlyData[monthlyData.length - 1].total;
    const change = ((last - first) / first) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  // Get category totals for a date range
  getCategoryTotals(userId: string, startDate: string, endDate: string): { category: string; income: number; expenses: number }[] {
    const stmt = db.prepare(`
      SELECT 
        category,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE user_id = ?
      AND date >= ?
      AND date <= ?
      GROUP BY category
      ORDER BY (income + expenses) DESC
    `);
    
    return stmt.all(userId, startDate, endDate) as any[];
  }

  // Calculate growth rate
  getGrowthRate(userId: string, metric: 'income' | 'expenses' | 'profit', months: number = 3): number {
    const trends = this.getMonthlyTrends(userId, months);
    
    if (trends.length < 2) return 0;
    
    const first = trends[trends.length - 1][metric];
    const last = trends[0][metric];
    
    if (first === 0) return 0;
    
    return ((last - first) / first) * 100;
  }

  // Store cash flow forecast
  saveForecast(forecast: CashFlowForecast): number {
    const stmt = db.prepare(`
      INSERT INTO cash_flow_forecasts 
      (user_id, forecast_date, projected_income, projected_expenses, projected_balance, confidence_level, assumptions)
      VALUES (@user_id, @forecast_date, @projected_income, @projected_expenses, @projected_balance, @confidence_level, @assumptions)
    `);
    const info = stmt.run(forecast);
    return info.lastInsertRowid as number;
  }

  // Get forecasts for a user
  getForecasts(userId: string, limit: number = 12): CashFlowForecast[] {
    const stmt = db.prepare(`
      SELECT * FROM cash_flow_forecasts
      WHERE user_id = ?
      ORDER BY forecast_date ASC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as CashFlowForecast[];
  }

  // Clear old forecasts
  clearOldForecasts(userId: string): void {
    const stmt = db.prepare(`
      DELETE FROM cash_flow_forecasts
      WHERE user_id = ?
      AND forecast_date < date('now')
    `);
    stmt.run(userId);
  }

  // Get average transaction amount by category
  getAverageAmountByCategory(userId: string, category: string, type: 'income' | 'expense'): number {
    const stmt = db.prepare(`
      SELECT AVG(amount) as avg_amount
      FROM transactions
      WHERE user_id = ?
      AND category = ?
      AND type = ?
    `);
    
    const result = stmt.get(userId, category, type) as { avg_amount: number };
    return result.avg_amount || 0;
  }

  // Get transaction frequency (transactions per month)
  getTransactionFrequency(userId: string, months: number = 3): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE user_id = ?
      AND date >= date('now', '-' || ? || ' months')
    `);
    
    const result = stmt.get(userId, months) as { count: number };
    return result.count / months;
  }
}

export default new AnalyticsRepository();
