const https = require("https");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from .env
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY not found");
  process.exit(1);
}

console.log(
  "Listing available models for API Key (len: " + apiKey.length + ")..."
);

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https
  .get(url, (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        if (json.models) {
          console.log("✅ Found " + json.models.length + " models:");
          json.models.forEach((m) => {
            console.log(" - " + m.name + " (" + m.displayName + ")");
            console.log(
              "   Supports: " + m.supportedGenerationMethods.join(", ")
            );
          });
        } else {
          console.log("❌ No models found or error response:");
          console.log(JSON.stringify(json, null, 2));
        }
      } catch (e) {
        console.error("❌ Failed to parse response:", e.message);
        console.log("Raw data:", data);
      }
    });
  })
  .on("error", (err) => {
    console.error("❌ Request failed:", err.message);
  });
