import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '../../data/conversations.db');
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  console.log(`📂 Creating database directory at: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'model')),
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_user_id ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_timestamp ON conversations(timestamp);
  CREATE INDEX IF NOT EXISTS idx_user_timestamp ON conversations(user_id, timestamp);

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_trans_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(date);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('info', 'success', 'warning', 'error')),
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_notif_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read);

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    company TEXT,
    profile_picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    period TEXT NOT NULL CHECK(period IN ('monthly', 'quarterly', 'yearly')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    alert_threshold REAL DEFAULT 0.9,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
  CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);

  CREATE TABLE IF NOT EXISTS financial_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK(goal_type IN ('revenue', 'profit', 'savings', 'expense_reduction', 'custom')),
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    deadline TEXT,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_goals_user_id ON financial_goals(user_id);
  CREATE INDEX IF NOT EXISTS idx_goals_status ON financial_goals(status);

  CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    confidence REAL DEFAULT 0,
    last_occurrence TEXT,
    next_expected TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_recurring_type ON recurring_transactions(type);

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('budget_overrun', 'low_cash', 'anomaly', 'goal_progress', 'trend', 'custom')),
    severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    read INTEGER DEFAULT 0,
    dismissed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
  CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);

  CREATE TABLE IF NOT EXISTS cash_flow_forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    forecast_date TEXT NOT NULL,
    projected_income REAL NOT NULL,
    projected_expenses REAL NOT NULL,
    projected_balance REAL NOT NULL,
    confidence_level REAL DEFAULT 0,
    assumptions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_forecast_user_id ON cash_flow_forecasts(user_id);
  CREATE INDEX IF NOT EXISTS idx_forecast_date ON cash_flow_forecasts(forecast_date);

  CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    transaction_id INTEGER,
    anomaly_type TEXT NOT NULL CHECK(anomaly_type IN ('unusual_amount', 'unusual_category', 'unusual_frequency', 'duplicate', 'other')),
    severity REAL NOT NULL,
    description TEXT NOT NULL,
    reviewed INTEGER DEFAULT 0,
    false_positive INTEGER DEFAULT 0,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  );


  CREATE INDEX IF NOT EXISTS idx_anomalies_user_id ON anomalies(user_id);
  CREATE INDEX IF NOT EXISTS idx_anomalies_reviewed ON anomalies(reviewed);
  CREATE INDEX IF NOT EXISTS idx_anomalies_transaction ON anomalies(transaction_id);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    rating INTEGER NOT NULL,
    type TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('financial', 'transaction', 'analytics', 'compliance')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0,
    file_name TEXT,
    date_range TEXT NOT NULL,
    filters TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
`);

console.log('✅ Database initialized successfully');

export default db;
