import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationMessage {
  id?: number;
  userId: string;
  messageId: string;
  role: 'user' | 'model';
  content: string;
  metadata?: any;
  timestamp?: string;
}

export class ConversationRepository {
  /**
   * Save a single message to the database
   */
  saveMessage(userId: string, role: 'user' | 'model', content: string, metadata: any = null): void {
    const messageId = uuidv4();
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    
    try {
      const stmt = db.prepare(`
        INSERT INTO conversations (user_id, message_id, role, content, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(userId, messageId, role, content, metadataStr);
    } catch (error) {
       // Fallback if metadata column doesn't exist yet
       const stmt = db.prepare(`
        INSERT INTO conversations (user_id, message_id, role, content)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(userId, messageId, role, content);
    }
  }

  /**
   * Get conversation history for a user
   */
  getConversationHistory(userId: string, limit: number = 20): ConversationMessage[] {
    try {
      const stmt = db.prepare(`
        SELECT id, user_id as userId, message_id as messageId, role, content, metadata, timestamp
        FROM conversations
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      
      const messages = stmt.all(userId, limit) as any[];
      return messages.map(m => ({
        ...m,
        metadata: m.metadata ? JSON.parse(m.metadata) : null
      })).reverse();
    } catch (error) {
      // Fallback if metadata column doesn't exist
      const stmt = db.prepare(`
        SELECT id, user_id as userId, message_id as messageId, role, content, timestamp
        FROM conversations
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      const messages = stmt.all(userId, limit) as ConversationMessage[];
      return messages.reverse();
    }
  }

  /**
   * Get all conversations (grouped by session/time)
   */
  getAllConversations(userId: string): any[] {
    const stmt = db.prepare(`
      SELECT 
        DATE(timestamp) as date,
        MIN(timestamp) as firstMessage,
        MAX(timestamp) as lastMessage,
        COUNT(*) as messageCount,
        GROUP_CONCAT(content, ' | ') as preview
      FROM conversations
      WHERE user_id = ?
      GROUP BY DATE(timestamp)
      ORDER BY lastMessage DESC
    `);
    
    return stmt.all(userId) as any[];
  }

  /**
   * Clear all conversations for a user
   */
  clearConversation(userId: string): void {
    const stmt = db.prepare(`
      DELETE FROM conversations
      WHERE user_id = ?
    `);
    
    stmt.run(userId);
  }

  /**
   * Delete conversations older than a certain date
   */
  deleteOldConversations(userId: string, daysOld: number): void {
    const stmt = db.prepare(`
      DELETE FROM conversations
      WHERE user_id = ?
      AND timestamp < datetime('now', '-' || ? || ' days')
    `);
    
    stmt.run(userId, daysOld);
  }

  /**
   * Get conversation count for a user
   */
  getMessageCount(userId: string): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM conversations
      WHERE user_id = ?
    `);
    
    const result = stmt.get(userId) as { count: number };
    return result.count;
  }
}

export default new ConversationRepository();
