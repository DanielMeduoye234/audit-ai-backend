import db from '../database/db';

export interface AuditLog {
  id?: number;
  user_id: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
  timestamp?: string;
}

export interface AuditFilters {
  user_id?: string;
  action?: string;
  entity_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export class AuditService {
  /**
   * Log an action to the audit trail
   */
  logAction(
    userId: string,
    action: string,
    entityType: string,
    entityId?: string,
    details?: any,
    userEmail?: string,
    ipAddress?: string
  ): void {
    try {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        userId,
        userEmail || null,
        action,
        entityType,
        entityId || null,
        details ? JSON.stringify(details) : null,
        ipAddress || null
      );
    } catch (error) {
      console.error('Error logging audit action:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Get audit logs with optional filters
   */
  getAuditLogs(filters: AuditFilters = {}): AuditLog[] {
    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];

      if (filters.user_id) {
        query += ' AND user_id = ?';
        params.push(filters.user_id);
      }

      if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }

      if (filters.entity_type) {
        query += ' AND entity_type = ?';
        params.push(filters.entity_type);
      }

      if (filters.start_date) {
        query += ' AND timestamp >= ?';
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        query += ' AND timestamp <= ?';
        params.push(filters.end_date);
      }

      query += ' ORDER BY timestamp DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const stmt = db.prepare(query);
      return stmt.all(...params) as AuditLog[];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Get a specific audit log by ID
   */
  getAuditLogById(id: number): AuditLog | null {
    try {
      const stmt = db.prepare('SELECT * FROM audit_logs WHERE id = ?');
      return stmt.get(id) as AuditLog || null;
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return null;
    }
  }

  /**
   * Get count of audit logs matching filters
   */
  getAuditLogsCount(filters: AuditFilters = {}): number {
    try {
      let query = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
      const params: any[] = [];

      if (filters.user_id) {
        query += ' AND user_id = ?';
        params.push(filters.user_id);
      }

      if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }

      if (filters.entity_type) {
        query += ' AND entity_type = ?';
        params.push(filters.entity_type);
      }

      if (filters.start_date) {
        query += ' AND timestamp >= ?';
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        query += ' AND timestamp <= ?';
        params.push(filters.end_date);
      }

      const stmt = db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      return result.count;
    } catch (error) {
      console.error('Error counting audit logs:', error);
      return 0;
    }
  }

  // Helper methods for common actions
  logLogin(userId: string, userEmail: string, ipAddress?: string): void {
    this.logAction(userId, 'login', 'auth', undefined, { success: true }, userEmail, ipAddress);
  }

  logLogout(userId: string, userEmail: string, ipAddress?: string): void {
    this.logAction(userId, 'logout', 'auth', undefined, { success: true }, userEmail, ipAddress);
  }

  logTransactionCreate(userId: string, transactionId: string, details: any, userEmail?: string): void {
    this.logAction(userId, 'create', 'transaction', transactionId, details, userEmail);
  }

  logTransactionUpdate(userId: string, transactionId: string, details: any, userEmail?: string): void {
    this.logAction(userId, 'update', 'transaction', transactionId, details, userEmail);
  }

  logTransactionDelete(userId: string, transactionId: string, details: any, userEmail?: string): void {
    this.logAction(userId, 'delete', 'transaction', transactionId, details, userEmail);
  }

  logDocumentUpload(userId: string, filename: string, details: any, userEmail?: string): void {
    this.logAction(userId, 'upload', 'document', filename, details, userEmail);
  }

  logAIInteraction(userId: string, details: any, userEmail?: string): void {
    this.logAction(userId, 'ai_chat', 'ai', undefined, details, userEmail);
  }

  logSettingsChange(userId: string, setting: string, details: any, userEmail?: string): void {
    this.logAction(userId, 'update', 'settings', setting, details, userEmail);
  }

  logProfileUpdate(userId: string, details: any, userEmail?: string): void {
    this.logAction(userId, 'update', 'profile', undefined, details, userEmail);
  }
}

export default new AuditService();
