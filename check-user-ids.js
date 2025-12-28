const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data", "conversations.db");
const db = new Database(dbPath);

console.log("\n🔍 Checking User IDs in Database:\n");

// Get unique user IDs from notifications
const userIds = db
  .prepare(
    `
  SELECT DISTINCT user_id FROM notifications
`
  )
  .all();

console.log("User IDs in notifications table:");
userIds.forEach((row) => {
  console.log(`  - ${row.user_id}`);
});

// Get unique user IDs from transactions
const transUserIds = db
  .prepare(
    `
  SELECT DISTINCT user_id FROM transactions LIMIT 5
`
  )
  .all();

console.log("\nUser IDs in transactions table:");
transUserIds.forEach((row) => {
  console.log(`  - ${row.user_id}`);
});

db.close();
