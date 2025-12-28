
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/conversations.db');
const db = new Database(dbPath);

console.log('Dropping feedback table...');
db.exec('DROP TABLE IF EXISTS feedback');
console.log('Done.');
