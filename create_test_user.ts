import db from './src/database/db';
import bcrypt from 'bcryptjs';

const resetDb = async () => {
  console.log('Resetting database...');
  
  // Drop tables to force schema update
  db.exec('DROP TABLE IF EXISTS users');
  db.exec('DROP TABLE IF EXISTS conversations');
  db.exec('DROP TABLE IF EXISTS transactions');
  db.exec('DROP TABLE IF EXISTS notifications');

  // Re-initialize tables (copying from db.ts logic, but db.ts runs on import so we just need to re-import or re-run the create statements if db.ts didn't do it because tables existed)
  // Actually, db.ts runs the CREATE TABLE IF NOT EXISTS on import.
  // So we need to manually run them here to be sure, or just restart the server which will re-run db.ts.
  // Let's manually run them here to be safe and immediate.

  db.exec(`
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
  `);

  console.log('Tables recreated.');

  // Create test user
  const email = 'test@example.com';
  const password = 'Password123!';
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = 'user-test-123';

  try {
    db.prepare(`
      INSERT INTO users (user_id, name, email, company, password)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, 'Test User', email, 'Test Corp', hashedPassword);
    
    console.log('✅ Test user created successfully');
    console.log('Email:', email);
    console.log('Password:', password);
  } catch (error) {
    console.error('Error creating user:', error);
  }
};

resetDb();
