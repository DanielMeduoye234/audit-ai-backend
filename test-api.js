// Test notification API endpoint
const userId = "caf37693-55b2-4ce6-93d1-75ec4ee39d11";

fetch(`http://localhost:5000/api/notifications/${userId}`)
  .then((res) => res.json())
  .then((data) => {
    console.log("✅ API Response:", data);
    console.log(`📊 Notifications count: ${data.notifications?.length || 0}`);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
  });
