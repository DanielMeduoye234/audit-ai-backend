import db from '../config/database';

// Create a test user and some transactions
const testUserId = 'test-user-123';

// Add test transactions
const testTransactions = [
  {
    user_id: testUserId,
    description: 'Office Supplies',
    amount: 150.00,
    type: 'expense',
    category: 'Office',
    date: '2025-12-01'
  },
  {
    user_id: testUserId,
    description: 'Client Payment',
    amount: 2500.00,
    type: 'income',
    category: 'Sales',
    date: '2025-12-01'
  },
  {
    user_id: testUserId,
    description: 'Software Subscription',
    amount: 99.00,
    type: 'expense',
    category: 'Software',
    date: '2025-12-02'
  }
];

console.log('Creating test transactions...');

testTransactions.forEach(tx => {
  const stmt = db.prepare(`
    INSERT INTO transactions (user_id, description, amount, type, category, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(tx.user_id, tx.description, tx.amount, tx.type, tx.category, tx.date);
});

console.log('✅ Test transactions created!');
console.log('Test user ID:', testUserId);
