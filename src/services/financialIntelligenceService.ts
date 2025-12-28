import analyticsRepository, { TrendData, SpendingPattern } from '../repositories/analyticsRepository';
import transactionRepository from '../repositories/transactionRepository';
import budgetRepository from '../repositories/budgetRepository';
import goalRepository from '../repositories/goalRepository';
import alertRepository, { RecurringTransaction } from '../repositories/alertRepository';

export interface CashFlowProjection {
  month: string;
  projected_income: number;
  projected_expenses: number;
  projected_balance: number;
  confidence: number;
}

export interface FinancialInsight {
  type: 'opportunity' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  impact: number;
  actionable: boolean;
  recommendation?: string;
}

export interface ScenarioInput {
  type: 'new_hire' | 'price_change' | 'cost_reduction' | 'revenue_increase' | 'custom';
  monthly_impact: number;
  description: string;
  duration_months?: number;
}

export interface ScenarioResult {
  scenario: ScenarioInput;
  current_profit: number;
  projected_profit: number;
  profit_change: number;
  profit_change_percentage: number;
  cash_runway_current: number;
  cash_runway_projected: number;
  break_even_months?: number;
  recommendation: string;
  risk_level: 'low' | 'medium' | 'high';
}

class FinancialIntelligenceService {
  /**
   * Generate cash flow forecast for the next N months
   */
  async forecastCashFlow(userId: string, months: number = 3): Promise<CashFlowProjection[]> {
    // Get historical trends
    const trends = analyticsRepository.getMonthlyTrends(userId, 6);
    
    if (trends.length < 2) {
      // Not enough data for forecasting
      return [];
    }

    // Calculate average income and expenses
    const avgIncome = trends.reduce((sum, t) => sum + t.income, 0) / trends.length;
    const avgExpenses = trends.reduce((sum, t) => sum + t.expenses, 0) / trends.length;

    // Calculate growth rates
    const incomeGrowth = this.calculateGrowthRate(trends.map(t => t.income));
    const expenseGrowth = this.calculateGrowthRate(trends.map(t => t.expenses));

    // Get current balance
    const summary = transactionRepository.getFinancialSummary(userId);
    let runningBalance = summary.profit;

    const projections: CashFlowProjection[] = [];
    const currentDate = new Date();

    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const monthStr = futureDate.toISOString().slice(0, 7);

      // Project with growth rate
      const projectedIncome = avgIncome * Math.pow(1 + incomeGrowth, i);
      const projectedExpenses = avgExpenses * Math.pow(1 + expenseGrowth, i);
      
      runningBalance += (projectedIncome - projectedExpenses);

      // Confidence decreases with time
      const confidence = Math.max(0.5, 0.9 - (i * 0.1));

      projections.push({
        month: monthStr,
        projected_income: Math.round(projectedIncome),
        projected_expenses: Math.round(projectedExpenses),
        projected_balance: Math.round(runningBalance),
        confidence
      });

      // Save to database
      analyticsRepository.saveForecast({
        user_id: userId,
        forecast_date: monthStr,
        projected_income: projectedIncome,
        projected_expenses: projectedExpenses,
        projected_balance: runningBalance,
        confidence_level: confidence,
        assumptions: `Based on ${trends.length} months of historical data with ${(incomeGrowth * 100).toFixed(1)}% income growth and ${(expenseGrowth * 100).toFixed(1)}% expense growth`
      });
    }

    return projections;
  }

  /**
   * Calculate growth rate from time series data
   */
  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;
    
    const first = values[values.length - 1];
    const last = values[0];
    
    if (first === 0) return 0;
    
    const totalGrowth = (last - first) / first;
    const monthlyGrowth = totalGrowth / (values.length - 1);
    
    return monthlyGrowth;
  }

  /**
   * Analyze spending patterns and generate insights
   */
  async analyzeSpending(userId: string): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];
    
    // Get spending patterns
    const currentDate = new Date();
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1).toISOString().split('T')[0];
    const endDate = currentDate.toISOString().split('T')[0];
    
    const patterns = analyticsRepository.getSpendingPatterns(userId, startDate, endDate);

    // Identify high-cost categories
    const totalSpending = patterns.reduce((sum, p) => sum + p.total, 0);
    
    for (const pattern of patterns) {
      // High percentage of spending
      if (pattern.percentage > 25) {
        insights.push({
          type: 'info',
          category: pattern.category,
          title: `${pattern.category} is ${pattern.percentage.toFixed(1)}% of total expenses`,
          description: `You're spending $${pattern.total.toLocaleString()} on ${pattern.category}. This represents a significant portion of your budget.`,
          impact: pattern.total,
          actionable: true,
          recommendation: `Review ${pattern.category} expenses to identify potential savings opportunities.`
        });
      }

      // Increasing trend
      if (pattern.trend === 'increasing') {
        insights.push({
          type: 'warning',
          category: pattern.category,
          title: `${pattern.category} costs are increasing`,
          description: `Spending on ${pattern.category} has been trending upward over the past 3 months.`,
          impact: pattern.total,
          actionable: true,
          recommendation: `Investigate why ${pattern.category} costs are rising and consider cost-control measures.`
        });
      }

      // Decreasing trend (positive)
      if (pattern.trend === 'decreasing') {
        insights.push({
          type: 'opportunity',
          category: pattern.category,
          title: `Great job reducing ${pattern.category} costs`,
          description: `You've successfully decreased spending on ${pattern.category} over recent months.`,
          impact: pattern.total,
          actionable: false
        });
      }
    }

    return insights;
  }

  /**
   * Detect anomalous transactions
   */
  async detectAnomalies(userId: string): Promise<void> {
    const anomalousTransactions = transactionRepository.getAnomalousTransactions(userId, 3);

    for (const transaction of anomalousTransactions) {
      // Check if already recorded
      const existing = alertRepository.getAnomalies(userId, false);
      const alreadyRecorded = existing.some(a => a.transaction_id === transaction.id);

      if (!alreadyRecorded && transaction.id) {
        // Calculate severity (how many standard deviations away)
        const categoryTransactions = transactionRepository.getTransactionsByCategory(userId, transaction.category);
        const amounts = categoryTransactions.map(t => t.amount);
        const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
        const severity = transaction.amount / avg;

        alertRepository.createAnomaly({
          user_id: userId,
          transaction_id: transaction.id,
          anomaly_type: 'unusual_amount',
          severity,
          description: `Transaction of $${transaction.amount.toLocaleString()} for ${transaction.description} is ${severity.toFixed(1)}x higher than average for ${transaction.category}`,
          reviewed: 0,
          false_positive: 0
        });

        // Create alert
        alertRepository.createAlert({
          user_id: userId,
          alert_type: 'anomaly',
          severity: severity > 5 ? 'critical' : 'warning',
          title: 'Unusual Transaction Detected',
          message: `A transaction of $${transaction.amount.toLocaleString()} for "${transaction.description}" is significantly higher than your typical ${transaction.category} expenses.`,
          data: JSON.stringify({ transaction_id: transaction.id }),
          read: 0,
          dismissed: 0
        });
      }
    }
  }

  /**
   * Detect recurring transaction patterns
   */
  async detectRecurringPatterns(userId: string): Promise<RecurringTransaction[]> {
    const patterns = transactionRepository.detectRecurringTransactions(userId);
    const recurring: RecurringTransaction[] = [];

    for (const pattern of patterns) {
      // Determine frequency based on occurrence count and date range
      const firstDate = new Date(pattern.first_date);
      const lastDate = new Date(pattern.last_date);
      const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      const avgDaysBetween = daysDiff / (pattern.occurrence_count - 1);

      let frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly';
      if (avgDaysBetween <= 2) frequency = 'daily';
      else if (avgDaysBetween <= 9) frequency = 'weekly';
      else if (avgDaysBetween <= 40) frequency = 'monthly';
      else if (avgDaysBetween <= 120) frequency = 'quarterly';
      else frequency = 'yearly';

      const confidence = Math.min(0.95, pattern.occurrence_count / 10);

      // Check if already exists
      const existing = alertRepository.getRecurringTransactions(userId);
      const alreadyExists = existing.some(r => 
        r.description === pattern.description && 
        r.category === pattern.category
      );

      if (!alreadyExists) {
        const recurringTx: RecurringTransaction = {
          user_id: userId,
          description: pattern.description,
          amount: pattern.avg_amount,
          category: pattern.category,
          type: pattern.type,
          frequency,
          confidence,
          last_occurrence: pattern.last_date,
          next_expected: this.calculateNextExpected(pattern.last_date, frequency)
        };

        alertRepository.createRecurringTransaction(recurringTx);
        recurring.push(recurringTx);
      }
    }

    return recurring;
  }

  /**
   * Calculate next expected date for recurring transaction
   */
  private calculateNextExpected(lastDate: string, frequency: string): string {
    const date = new Date(lastDate);
    
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    
    return date.toISOString().split('T')[0];
  }

  /**
   * Simulate business scenario
   */
  async simulateScenario(userId: string, scenario: ScenarioInput): Promise<ScenarioResult> {
    const summary = transactionRepository.getFinancialSummary(userId);
    const currentProfit = summary.profit;
    const currentRevenue = summary.revenue;
    const currentExpenses = summary.expenses;

    // Calculate monthly averages (assuming data is for multiple months)
    const trends = analyticsRepository.getMonthlyTrends(userId, 3);
    const monthlyProfit = trends.length > 0 
      ? trends.reduce((sum, t) => sum + t.profit, 0) / trends.length 
      : currentProfit;

    const duration = scenario.duration_months || 12;
    const projectedMonthlyProfit = monthlyProfit + scenario.monthly_impact;
    const projectedProfit = currentProfit + (scenario.monthly_impact * duration);

    const profitChange = projectedProfit - currentProfit;
    const profitChangePercentage = currentProfit !== 0 ? (profitChange / currentProfit) * 100 : 0;

    // Calculate cash runway
    const monthlyBurn = currentExpenses / (trends.length || 1);
    const cashRunwayCurrent = monthlyProfit > 0 ? Infinity : Math.abs(currentProfit / monthlyBurn);
    const cashRunwayProjected = projectedMonthlyProfit > 0 ? Infinity : Math.abs(projectedProfit / (monthlyBurn + Math.abs(scenario.monthly_impact)));

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (projectedMonthlyProfit < 0) riskLevel = 'high';
    else if (projectedMonthlyProfit < monthlyProfit * 0.5) riskLevel = 'medium';

    // Generate recommendation
    let recommendation = '';
    if (scenario.monthly_impact > 0) {
      recommendation = `This scenario would increase your monthly profit by $${Math.abs(scenario.monthly_impact).toLocaleString()}. `;
      if (riskLevel === 'low') {
        recommendation += 'This appears to be a financially sound decision with minimal risk.';
      } else {
        recommendation += 'While positive, ensure you have sufficient cash reserves to manage the transition.';
      }
    } else {
      recommendation = `This scenario would decrease your monthly profit by $${Math.abs(scenario.monthly_impact).toLocaleString()}. `;
      if (riskLevel === 'high') {
        recommendation += 'This would put your business at significant financial risk. I recommend building more cash reserves before proceeding.';
      } else if (riskLevel === 'medium') {
        recommendation += 'Proceed with caution and monitor cash flow closely.';
      } else {
        recommendation += 'Your business can absorb this cost, but look for ways to optimize the investment.';
      }
    }

    return {
      scenario,
      current_profit: currentProfit,
      projected_profit: projectedProfit,
      profit_change: profitChange,
      profit_change_percentage: profitChangePercentage,
      cash_runway_current: cashRunwayCurrent,
      cash_runway_projected: cashRunwayProjected,
      recommendation,
      risk_level: riskLevel
    };
  }

  /**
   * Generate proactive financial insights
   */
  async generateInsights(userId: string): Promise<FinancialInsight[]> {
    const insights: FinancialInsight[] = [];

    // Check cash position
    const summary = transactionRepository.getFinancialSummary(userId);
    if (summary.profit < 10000) {
      insights.push({
        type: 'warning',
        category: 'Cash Flow',
        title: 'Low cash reserves',
        description: `Your current cash position is $${summary.profit.toLocaleString()}. Consider building reserves.`,
        impact: summary.profit,
        actionable: true,
        recommendation: 'Aim to build at least 3 months of operating expenses in reserves.'
      });
    }

    // Check budget variances
    const budgetVariances = budgetRepository.checkBudgetAlerts(userId);
    for (const variance of budgetVariances) {
      if (variance.status === 'over') {
        insights.push({
          type: 'warning',
          category: variance.budget.category,
          title: `${variance.budget.category} budget exceeded`,
          description: `You've spent $${variance.actual.toLocaleString()} against a budget of $${variance.budget.amount.toLocaleString()}.`,
          impact: Math.abs(variance.variance),
          actionable: true,
          recommendation: `Review ${variance.budget.category} expenses and adjust budget or reduce spending.`
        });
      }
    }

    // Add spending insights
    const spendingInsights = await this.analyzeSpending(userId);
    insights.push(...spendingInsights);

    return insights.slice(0, 10); // Return top 10 insights
  }
}

export default new FinancialIntelligenceService();
