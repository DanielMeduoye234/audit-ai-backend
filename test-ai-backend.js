const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not found in environment");
    return;
  }

  console.log("Testing Gemini API Versions and Models...");
  const genAI = new GoogleGenerativeAI(apiKey);

  const versions = ["v1", "v1beta"];
  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-pro",
  ];

  for (const apiVersion of versions) {
    console.log(`\n=== Testing API Version: ${apiVersion} ===`);
    for (const modelName of models) {
      console.log(`[${apiVersion}] Testing: ${modelName}...`);
      try {
        const model = genAI.getGenerativeModel(
          { model: modelName },
          { apiVersion }
        );
        const result = await model.generateContent("Hi");
        const res = await result.response;
        console.log(` ✅ SUCCESS:`, res.text().substring(0, 50).trim());
      } catch (err) {
        let snippet = err.message;
        if (snippet.includes("fetch failed"))
          snippet = "Fetch Failed (Network/DNS)";
        if (snippet.includes("404")) snippet = "404 Not Found";
        if (snippet.includes("429")) snippet = "429 Quota Exceeded";
        console.error(` ❌ FAILED:`, snippet);
      }
    }
  }

  // Also try 2.0 explicitly once more to see if quota reset
  console.log("\n--- Testing 2.0 specifically ---");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent("Hi");
    const res = await result.response;
    console.log(
      ` ✅ gemini-2.0-flash-exp WORKS:`,
      res.text().substring(0, 50).trim()
    );
  } catch (err) {
    console.log(
      ` ❌ gemini-2.0-flash-exp FAILED:`,
      err.message.includes("429") ? "429 Quota Exceeded" : err.message
    );
  }
}

testGemini().catch(console.error);
