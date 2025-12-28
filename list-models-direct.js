const API_KEY = "AIzaSyCnB_veadY7Bm8bGYTgIZDwtv-oHh8KD-o";
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
  try {
    const response = await fetch(URL);
    const data = await response.json();

    if (data.models) {
      console.log("Available models:");
      data.models.forEach((model) => {
        if (
          model.supportedGenerationMethods &&
          model.supportedGenerationMethods.includes("generateContent")
        ) {
          console.log(`- ${model.name} (${model.displayName})`);
        }
      });
    } else {
      console.log("No models found or error:", data);
    }
  } catch (error) {
    console.error("Error fetching models:", error);
  }
}

listModels();
