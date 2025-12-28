import alertRepository, { Alert } from '../repositories/alertRepository';
import budgetRepository from '../repositories/budgetRepository';
import goalRepository from '../repositories/goalRepository';
import transactionRepository from '../repositories/transactionRepository';
import analyticsRepository from '../repositories/analyticsRepository';
import financialIntelligenceService from './financialIntelligenceService';

export interface DailyDigest {
  date: string;
  cash_balance: number;
  daily_income: number;
  daily_expenses: number;
  daily_profit: number;
  active_alerts: number;
  budget_status: string;
  top_insight?: string;
  goal_progress?: string;
}

class NotificationService {
  /**
   * Monitor cash balance and create alerts if below threshold
   */
  async monitorCashBalance(userId: string, threshold: number = 5000): Promise<void> {
    const summary = transactionRepository.getFinancialSummary(userId);
    
    if (summary.profit < threshold) {
      // Check if alert already exists for today
      const existingAlerts = alertRepository.getAlerts(userId, false, false);
      const hasRecentCashAlert = existingAlerts.some(
        a => a.alert_type === 'low_cash' && 
        new Date(a.created_at || '').toDateString() === new Date().toDateString()
      );

      if (!hasRecentCashAlert) {
        alertRepository.createAlert({
          user_id: userId,
          alert_type: 'low_cash',
          severity: summary.profit < threshold * 0.5 ? 'critical' : 'warning',
          title: 'Low Cash Reserves',
          message: `Your cash balance is $${summary.profit.toLocaleString()}, which is below the recommended threshold of $${threshold.toLocaleString()}.`,
          data: JSON.stringify({ current_balance: summary.profit, threshold }),
          read: 0,
          dismissed: 0
        });
      }
    }
  }

  /**
   * Check budget status and create alerts for overruns
   */
  async monitorBudgets(userId: string): Promise<void> {
    const budgetAlerts = budgetRepository.checkBudgetAlerts(userId);

    for (const variance of budgetAlerts) {
      // Check if alert already exists for this budget
      const existingAlerts = alertRepository.getAlerts(userId, false, false);
      const hasRecentBudgetAlert = existingAlerts.some(
        a => a.alert_type === 'budget_overrun' && 
        a.data?.includes(variance.budget.category) &&
        new Date(a.created_at || '').toDateString() === new Date().toDateString()
      );

      if (!hasRecentBudgetAlert) {
        const severity = variance.actual > variance.budget.amount * 1.2 ? 'critical' : 'warning';
        
        alertRepository.createAlert({
          user_id: userId,
          alert_type: 'budget_overrun',
          severity,
          title: `${variance.budget.category} Budget Alert`,
          message: `You've spent $${variance.actual.toLocaleString()} against a budget of $${variance.budget.amount.toLocaleString()} (${Math.abs(variance.variancePercentage).toFixed(0)}% over).`,
          data: JSON.stringify({ 
            category: variance.budget.category, 
            budget: variance.budget.amount, 
            actual: variance.actual 
          }),
          read: 0,
          dismissed: 0
        });
      }
    }
  }

  /**
   * Monitor goal progress and create motivational alerts
   */
  async monitorGoals(userId: string): Promise<void> {
    const goalProgress = goalRepository.getGoalProgress(userId);

    for (const progress of goalProgress) {
      // Alert if goal is at risk
      if (progress.days_remaining && progress.days_remaining < 30 && !progress.on_track) {
        const existingAlerts = alertRepository.getAlerts(userId, false, false);
        const hasRecentGoalAlert = existingAlerts.some(
          a => a.alert_type === 'goal_progress' && 
          a.data?.includes(progress.goal.id?.toString() || '') &&
          new Date(a.created_at || '').toDateString() === new Date().toDateString()
        );

        if (!hasRecentGoalAlert) {
          alertRepository.createAlert({
            user_id: userId,
            alert_type: 'goal_progress',
            severity: 'warning',
            title: `Goal At Risk: ${progress.goal.description || progress.goal.goal_type}`,
            message: `You're ${progress.progress_percentage.toFixed(0)}% towards your goal with ${progress.days_remaining} days remaining. You may need to accelerate progress.`,
            data: JSON.stringify({ goal_id: progress.goal.id, progress: progress.progress_percentage }),
            read: 0,
            dismissed: 0
          });
        }
      }

      // Celebrate milestones
      if (progress.progress_percentage >= 50 && progress.progress_percentage < 55 && progress.on_track) {
        const existingAlerts = alertRepository.getAlerts(userId, true, true);
        const hasMilestoneAlert = existingAlerts.some(
          a => a.alert_type === 'goal_progress' && 
          a.data?.includes(progress.goal.id?.toString() || '') &&
          a.message.includes('50%')
        );

        if (!hasMilestoneAlert) {
          alertRepository.createAlert({
            user_id: userId,
            alert_type: 'goal_progress',
            severity: 'info',
            title: '🎉 Halfway There!',
            message: `You've reached 50% of your ${progress.goal.description || progress.goal.goal_type} goal. Keep up the great work!`,
            data: JSON.stringify({ goal_id: progress.goal.id, milestone: 50 }),
            read: 0,
            dismissed: 0
          });
        }
      }
    }
  }

  /**
   * Detect and alert on unusual trends
   */
  async monitorTrends(userId: string): Promise<void> {
    const trends = analyticsRepository.getMonthlyTrends(userId, 3);
    
    if (trends.length < 2) return;

    const latestMonth = trends[0];
    const previousMonth = trends[1];

    // Significant revenue drop
    if (latestMonth.income < previousMonth.income * 0.8) {
      const existingAlerts = alertRepository.getAlerts(userId, false, false);
      const hasRecentTrendAlert = existingAlerts.some(
        a => a.alert_type === 'trend' && 
        a.message.includes('revenue') &&
        new Date(a.created_at || '').toDateString() === new Date().toDateString()
      );

      if (!hasRecentTrendAlert) {
        const dropPercentage = ((previousMonth.income - latestMonth.income) / previousMonth.income * 100).toFixed(0);
        
        alertRepository.createAlert({
          user_id: userId,
          alert_type: 'trend',
          severity: 'warning',
          title: 'Revenue Decline Detected',
          message: `Your revenue dropped by ${dropPercentage}% this month compared to last month. From $${previousMonth.income.toLocaleString()} to $${latestMonth.income.toLocaleString()}.`,
          data: JSON.stringify({ previous: previousMonth.income, current: latestMonth.income }),
          read: 0,
          dismissed: 0
        });
      }
    }

    // Significant expense increase
    if (latestMonth.expenses > previousMonth.expenses * 1.2) {
      const existingAlerts = alertRepository.getAlerts(userId, false, false);
      const hasRecentTrendAlert = existingAlerts.some(
        a => a.alert_type === 'trend' && 
        a.message.includes('expenses') &&
        new Date(a.created_at || '').toDateString() === new Date().toDateString()
      );

      if (!hasRecentTrendAlert) {
        const increasePercentage = ((latestMonth.expenses - previousMonth.expenses) / previousMonth.expenses * 100).toFixed(0);
        
        alertRepository.createAlert({
          user_id: userId,
          alert_type: 'trend',
          severity: 'warning',
          title: 'Expense Spike Detected',
          message: `Your expenses increased by ${increasePercentage}% this month. From $${previousMonth.expenses.toLocaleString()} to $${latestMonth.expenses.toLocaleString()}.`,
          data: JSON.stringify({ previous: previousMonth.expenses, current: latestMonth.expenses }),
          read: 0,
          dismissed: 0
        });
      }
    }
  }

  /**
   * Run all monitoring tasks
   */
  async runAllMonitoring(userId: string): Promise<void> {
    await this.monitorCashBalance(userId);
    await this.monitorBudgets(userId);
    await this.monitorGoals(userId);
    await this.monitorTrends(userId);
    await financialIntelligenceService.detectAnomalies(userId);
  }

  /**
   * Generate daily financial digest
   */
  async generateDailyDigest(userId: string): Promise<DailyDigest> {
    const today = new Date().toISOString().split('T')[0];
    const summary = transactionRepository.getFinancialSummary(userId);
    
    // Get today's transactions
    const todayTransactions = transactionRepository.getTransactionsByDateRange(userId, today, today);
    const dailyIncome = todayTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const dailyExpenses = todayTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Get active alerts
    const activeAlerts = alertRepository.getAlerts(userId, false, false);

    // Get budget status
    const budgetVariances = budgetRepository.checkBudgetAlerts(userId);
    const budgetStatus = budgetVariances.length === 0 
      ? 'All budgets on track' 
      : `${budgetVariances.length} budget${budgetVariances.length > 1 ? 's' : ''} need attention`;

    // Get top insight
    const insights = await financialIntelligenceService.generateInsights(userId);
    const topInsight = insights.length > 0 ? insights[0].title : undefined;

    // Get goal progress
    const goalProgress = goalRepository.getGoalProgress(userId);
    const activeGoals = goalProgress.filter(g => g.goal.status === 'active');
    const goalProgressStr = activeGoals.length > 0
      ? `${activeGoals.length} active goal${activeGoals.length > 1 ? 's' : ''}, avg ${(activeGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / activeGoals.length).toFixed(0)}% complete`
      : undefined;

    return {
      date: today,
      cash_balance: summary.profit,
      daily_income: dailyIncome,
      daily_expenses: dailyExpenses,
      daily_profit: dailyIncome - dailyExpenses,
      active_alerts: activeAlerts.length,
      budget_status: budgetStatus,
      top_insight: topInsight,
      goal_progress: goalProgressStr
    };
  }

  /**
   * Send daily digest as an alert
   */
  async sendDailyDigest(userId: string): Promise<void> {
    const digest = await this.generateDailyDigest(userId);
    
    const message = `
📊 Daily Financial Summary

💰 Cash Balance: $${digest.cash_balance.toLocaleString()}
📈 Today's Income: $${digest.daily_income.toLocaleString()}
📉 Today's Expenses: $${digest.daily_expenses.toLocaleString()}
${digest.daily_profit >= 0 ? '✅' : '⚠️'} Net: $${digest.daily_profit.toLocaleString()}

${digest.active_alerts > 0 ? `🔔 ${digest.active_alerts} active alert${digest.active_alerts > 1 ? 's' : ''}` : ''}
📊 ${digest.budget_status}
${digest.top_insight ? `💡 ${digest.top_insight}` : ''}
${digest.goal_progress ? `🎯 ${digest.goal_progress}` : ''}
    `.trim();

    alertRepository.createAlert({
      user_id: userId,
      alert_type: 'custom',
      severity: 'info',
      title: 'Daily Financial Digest',
      message,
      data: JSON.stringify(digest),
      read: 0,
      dismissed: 0
    });
  }
}

export default new NotificationService();
