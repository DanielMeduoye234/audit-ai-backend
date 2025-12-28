const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyCnB_veadY7Bm8bGYTgIZDwtv-oHh8KD-o");

async function listModels() {
  try {
    // This is a lower-level request to list models
    // We need to access the model manager if available, or use a fetch if SDK doesn't expose it easily
    // The SDK usually has a getGenerativeModel method, but listing might be different.
    // Let's try to use the API directly via fetch if we can't find a list method.

    // Actually, let's try a known older model just in case: 'gemini-1.0-pro'
    console.log("Testing gemini-1.0-pro...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
    const result = await model.generateContent("Hello");
    console.log("Success with gemini-1.0-pro!");
    console.log(result.response.text());
  } catch (error) {
    console.error("Error with gemini-1.0-pro:", error.message);
  }
}

listModels();
