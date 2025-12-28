const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data", "conversations.db");
console.log(`\n📂 Database path: ${dbPath}\n`);

const db = new Database(dbPath);

console.log("📊 Recent Notifications:");
console.log("========================\n");

try {
  const notifications = db
    .prepare(
      `
    SELECT * FROM notifications 
    ORDER BY created_at DESC 
    LIMIT 10
  `
    )
    .all();

  if (notifications.length === 0) {
    console.log("❌ No notifications found in database");
  } else {
    notifications.forEach((notif, index) => {
      console.log(`${index + 1}. [${notif.type.toUpperCase()}] ${notif.title}`);
      console.log(`   User: ${notif.user_id}`);
      console.log(`   Message: ${notif.message}`);
      console.log(`   Read: ${notif.read ? "Yes" : "No"}`);
      console.log(`   Created: ${notif.created_at}`);
      console.log("");
    });
  }

  console.log(`\n📈 Total notifications: ${notifications.length}\n`);
} catch (error) {
  console.error("❌ Error:", error.message);
}

db.close();
