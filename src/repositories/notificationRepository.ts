import db from '../database/db';

export interface Notification {
  id?: number;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read?: number;
  created_at?: string;
}

class NotificationRepository {
  getNotifications(userId: string, limit: number = 50): Notification[] {
    const stmt = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(userId, limit) as Notification[];
  }

  markAsRead(notificationId: number): void {
    const stmt = db.prepare(`
      UPDATE notifications 
      SET read = 1 
      WHERE id = ?
    `);
    stmt.run(notificationId);
  }

  getUnreadCount(userId: string): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = ? AND read = 0
    `);
    const result = stmt.get(userId) as { count: number };
    return result.count;
  }

  createNotification(notification: Notification): number {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (@user_id, @title, @message, @type)
    `);
    const info = stmt.run(notification);
    return info.lastInsertRowid as number;
  }
}

export default new NotificationRepository();
