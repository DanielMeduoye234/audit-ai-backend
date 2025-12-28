// Report Repository - Manages report metadata and storage

import db from '../database/db';

export interface Report {
  id: string;
  userId: string;
  type: 'financial' | 'transaction' | 'analytics' | 'compliance';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  fileName?: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  filters?: any;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

interface ReportRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  progress: number;
  file_name: string | null;
  date_range: string;
  filters: string | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

class ReportRepository {
  
  private rowToReport(row: ReportRow): Report {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as any,
      status: row.status as any,
      progress: row.progress,
      fileName: row.file_name || undefined,
      dateRange: JSON.parse(row.date_range),
      filters: row.filters ? JSON.parse(row.filters) : undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
      error: row.error || undefined,
    };
  }

  create(report: Omit<Report, 'id' | 'createdAt' | 'status' | 'progress'>): Report {
    const id = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO reports (id, user_id, type, status, progress, date_range, filters, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      report.userId,
      report.type,
      'pending',
      0,
      JSON.stringify(report.dateRange),
      report.filters ? JSON.stringify(report.filters) : null,
      createdAt
    );
    
    return {
      ...report,
      id,
      status: 'pending',
      progress: 0,
      createdAt,
    };
  }

  findById(id: string): Report | undefined {
    const stmt = db.prepare('SELECT * FROM reports WHERE id = ?');
    const row = stmt.get(id) as ReportRow | undefined;
    return row ? this.rowToReport(row) : undefined;
  }

  findByUserId(userId: string): Report[] {
    const stmt = db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(userId) as ReportRow[];
    return rows.map(row => this.rowToReport(row));
  }

  update(id: string, updates: Partial<Report>): Report | undefined {
    const current = this.findById(id);
    if (!current) return undefined;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.progress !== undefined) {
      fields.push('progress = ?');
      values.push(updates.progress);
    }
    if (updates.fileName !== undefined) {
      fields.push('file_name = ?');
      values.push(updates.fileName);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }

    if (fields.length === 0) return current;

    values.push(id);
    const stmt = db.prepare(`UPDATE reports SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  updateProgress(id: string, progress: number): Report | undefined {
    return this.update(id, { progress, status: 'processing' });
  }

  markCompleted(id: string, fileName: string): Report | undefined {
    return this.update(id, {
      status: 'completed',
      progress: 100,
      fileName,
      completedAt: new Date().toISOString(),
    });
  }

  markFailed(id: string, error: string): Report | undefined {
    return this.update(id, {
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
    });
  }

  delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM reports WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Get all reports (for admin purposes)
  findAll(): Report[] {
    const stmt = db.prepare('SELECT * FROM reports ORDER BY created_at DESC');
    const rows = stmt.all() as ReportRow[];
    return rows.map(row => this.rowToReport(row));
  }
}

export default new ReportRepository();
