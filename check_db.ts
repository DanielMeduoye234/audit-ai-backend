import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, 'data/conversations.db');
console.log('Opening database at:', dbPath);

const db = new Database(dbPath);

const transactions = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5').all();
console.log('Recent Transactions:', JSON.stringify(transactions, null, 2));

const users = db.prepare('SELECT * FROM users').all();
console.log('Users:', JSON.stringify(users, null, 2));
