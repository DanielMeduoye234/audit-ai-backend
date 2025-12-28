const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI("AIzaSyCnB_veadY7Bm8bGYTgIZDwtv-oHh8KD-o");

async function run() {
  try {
    // List available models
    // Note: The listModels method might not be available in all SDK versions or might work differently.
    // If this fails, we'll try a direct generation test with 'gemini-1.5-flash' which is the latest standard.

    console.log("Testing gemini-1.5-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello");
    console.log("Success with gemini-1.5-flash!");
    console.log(result.response.text());
  } catch (error) {
    console.error("Error with gemini-1.5-flash:", error.message);

    try {
      console.log("\nTesting gemini-pro...");
      const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
      const resultPro = await modelPro.generateContent("Hello");
      console.log("Success with gemini-pro!");
      console.log(resultPro.response.text());
    } catch (errorPro) {
      console.error("Error with gemini-pro:", errorPro.message);
    }
  }
}

run();
