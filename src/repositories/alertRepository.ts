import db from '../database/db';

export interface Alert {
  id?: number;
  user_id: string;
  alert_type: 'budget_overrun' | 'low_cash' | 'anomaly' | 'goal_progress' | 'trend' | 'custom';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data?: string;
  read: number;
  dismissed: number;
  created_at?: string;
}

export interface Anomaly {
  id?: number;
  user_id: string;
  transaction_id?: number;
  anomaly_type: 'unusual_amount' | 'unusual_category' | 'unusual_frequency' | 'duplicate' | 'other';
  severity: number;
  description: string;
  reviewed: number;
  false_positive: number;
  detected_at?: string;
}

export interface RecurringTransaction {
  id?: number;
  user_id: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  confidence: number;
  last_occurrence?: string;
  next_expected?: string;
  detected_at?: string;
}

class AlertRepository {
  // Alert Management
  createAlert(alert: Alert): number {
    const stmt = db.prepare(`
      INSERT INTO alerts (user_id, alert_type, severity, title, message, data, read, dismissed)
      VALUES (@user_id, @alert_type, @severity, @title, @message, @data, @read, @dismissed)
    `);
    const info = stmt.run({
      ...alert,
      read: alert.read || 0,
      dismissed: alert.dismissed || 0
    });
    return info.lastInsertRowid as number;
  }

  getAlerts(userId: string, includeRead: boolean = false, includeDismissed: boolean = false): Alert[] {
    let query = `SELECT * FROM alerts WHERE user_id = ?`;
    
    if (!includeRead) {
      query += ` AND read = 0`;
    }
    
    if (!includeDismissed) {
      query += ` AND dismissed = 0`;
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const stmt = db.prepare(query);
    return stmt.all(userId) as Alert[];
  }

  markAlertAsRead(alertId: number): void {
    const stmt = db.prepare(`UPDATE alerts SET read = 1 WHERE id = ?`);
    stmt.run(alertId);
  }

  dismissAlert(alertId: number): void {
    const stmt = db.prepare(`UPDATE alerts SET dismissed = 1 WHERE id = ?`);
    stmt.run(alertId);
  }

  deleteAlert(alertId: number): void {
    const stmt = db.prepare(`DELETE FROM alerts WHERE id = ?`);
    stmt.run(alertId);
  }

  clearOldAlerts(userId: string, daysOld: number = 30): void {
    const stmt = db.prepare(`
      DELETE FROM alerts
      WHERE user_id = ?
      AND created_at < datetime('now', '-' || ? || ' days')
      AND (read = 1 OR dismissed = 1)
    `);
    stmt.run(userId, daysOld);
  }

  // Anomaly Management
  createAnomaly(anomaly: Anomaly): number {
    const stmt = db.prepare(`
      INSERT INTO anomalies (user_id, transaction_id, anomaly_type, severity, description, reviewed, false_positive)
      VALUES (@user_id, @transaction_id, @anomaly_type, @severity, @description, @reviewed, @false_positive)
    `);
    const info = stmt.run({
      ...anomaly,
      reviewed: anomaly.reviewed || 0,
      false_positive: anomaly.false_positive || 0
    });
    return info.lastInsertRowid as number;
  }

  getAnomalies(userId: string, includeReviewed: boolean = false): Anomaly[] {
    let query = `SELECT * FROM anomalies WHERE user_id = ?`;
    
    if (!includeReviewed) {
      query += ` AND reviewed = 0`;
    }
    
    query += ` ORDER BY severity DESC, detected_at DESC`;
    
    const stmt = db.prepare(query);
    return stmt.all(userId) as Anomaly[];
  }

  markAnomalyAsReviewed(anomalyId: number, isFalsePositive: boolean = false): void {
    const stmt = db.prepare(`
      UPDATE anomalies 
      SET reviewed = 1, false_positive = ?
      WHERE id = ?
    `);
    stmt.run(isFalsePositive ? 1 : 0, anomalyId);
  }

  // Recurring Transaction Management
  createRecurringTransaction(recurring: RecurringTransaction): number {
    const stmt = db.prepare(`
      INSERT INTO recurring_transactions 
      (user_id, description, amount, category, type, frequency, confidence, last_occurrence, next_expected)
      VALUES (@user_id, @description, @amount, @category, @type, @frequency, @confidence, @last_occurrence, @next_expected)
    `);
    const info = stmt.run(recurring);
    return info.lastInsertRowid as number;
  }

  getRecurringTransactions(userId: string): RecurringTransaction[] {
    const stmt = db.prepare(`
      SELECT * FROM recurring_transactions
      WHERE user_id = ?
      ORDER BY confidence DESC, detected_at DESC
    `);
    return stmt.all(userId) as RecurringTransaction[];
  }

  updateRecurringTransaction(recurring: RecurringTransaction): void {
    const stmt = db.prepare(`
      UPDATE recurring_transactions
      SET description = @description, amount = @amount, category = @category, 
          type = @type, frequency = @frequency, confidence = @confidence,
          last_occurrence = @last_occurrence, next_expected = @next_expected
      WHERE id = @id
    `);
    stmt.run(recurring);
  }

  deleteRecurringTransaction(id: number): void {
    const stmt = db.prepare(`DELETE FROM recurring_transactions WHERE id = ?`);
    stmt.run(id);
  }

  // Check for expected recurring transactions that haven't occurred
  getMissedRecurringTransactions(userId: string): RecurringTransaction[] {
    const currentDate = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT * FROM recurring_transactions
      WHERE user_id = ?
      AND next_expected IS NOT NULL
      AND next_expected < ?
      ORDER BY next_expected ASC
    `);
    return stmt.all(userId, currentDate) as RecurringTransaction[];
  }
}

export default new AlertRepository();
