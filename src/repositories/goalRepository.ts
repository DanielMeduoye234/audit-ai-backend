import db from '../database/db';

export interface FinancialGoal {
  id?: number;
  user_id: string;
  goal_type: 'revenue' | 'profit' | 'savings' | 'expense_reduction' | 'custom';
  target_amount: number;
  current_amount: number;
  deadline?: string;
  description?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface GoalProgress {
  goal: FinancialGoal;
  progress_percentage: number;
  remaining_amount: number;
  days_remaining?: number;
  on_track: boolean;
}

class GoalRepository {
  createGoal(goal: FinancialGoal): number {
    const stmt = db.prepare(`
      INSERT INTO financial_goals (user_id, goal_type, target_amount, current_amount, deadline, description, status)
      VALUES (@user_id, @goal_type, @target_amount, @current_amount, @deadline, @description, @status)
    `);
    const info = stmt.run(goal);
    return info.lastInsertRowid as number;
  }

  getGoals(userId: string, status?: 'active' | 'completed' | 'cancelled'): FinancialGoal[] {
    let query = `SELECT * FROM financial_goals WHERE user_id = ?`;
    const params: any[] = [userId];
    
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const stmt = db.prepare(query);
    return stmt.all(...params) as FinancialGoal[];
  }

  getGoalById(id: number): FinancialGoal | undefined {
    const stmt = db.prepare(`SELECT * FROM financial_goals WHERE id = ?`);
    return stmt.get(id) as FinancialGoal | undefined;
  }

  updateGoal(goal: FinancialGoal): void {
    const stmt = db.prepare(`
      UPDATE financial_goals 
      SET goal_type = @goal_type, target_amount = @target_amount, current_amount = @current_amount,
          deadline = @deadline, description = @description, status = @status, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    stmt.run(goal);
  }

  updateGoalProgress(goalId: number, currentAmount: number): void {
    const stmt = db.prepare(`
      UPDATE financial_goals 
      SET current_amount = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(currentAmount, goalId);
  }

  deleteGoal(id: number): void {
    const stmt = db.prepare(`DELETE FROM financial_goals WHERE id = ?`);
    stmt.run(id);
  }

  getGoalProgress(userId: string): GoalProgress[] {
    const goals = this.getGoals(userId, 'active');
    const now = new Date();
    
    return goals.map(goal => {
      const progress_percentage = goal.target_amount > 0 
        ? (goal.current_amount / goal.target_amount) * 100 
        : 0;
      
      const remaining_amount = goal.target_amount - goal.current_amount;
      
      let days_remaining: number | undefined;
      let on_track = true;
      
      if (goal.deadline) {
        const deadline = new Date(goal.deadline);
        days_remaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Simple on-track calculation: progress should match time elapsed
        const created = new Date(goal.created_at || now);
        const totalDays = Math.ceil((deadline.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        const expectedProgress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;
        
        on_track = progress_percentage >= expectedProgress * 0.9; // 90% of expected is "on track"
      }
      
      return {
        goal,
        progress_percentage,
        remaining_amount,
        days_remaining,
        on_track
      };
    });
  }

  checkGoalCompletion(userId: string): FinancialGoal[] {
    const stmt = db.prepare(`
      SELECT * FROM financial_goals
      WHERE user_id = ?
      AND status = 'active'
      AND current_amount >= target_amount
    `);
    
    const completedGoals = stmt.all(userId) as FinancialGoal[];
    
    // Auto-update status to completed
    for (const goal of completedGoals) {
      if (goal.id) {
        const updateStmt = db.prepare(`
          UPDATE financial_goals 
          SET status = 'completed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateStmt.run(goal.id);
      }
    }
    
    return completedGoals;
  }
}

export default new GoalRepository();
