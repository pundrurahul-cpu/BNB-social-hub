const axios = require('axios');
require('dotenv').config();

async function testOllama() {
  const url = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3';

  console.log(`🦙 Testing connection to Ollama at: ${url}...`);

  try {
    const response = await axios.post(`${url}/api/generate`, {
      model: model,
      prompt: "Respond with only one word: 'Connected'",
      stream: false
    });

    console.log("✅ SUCCESS!");
    console.log("Ollama says:", response.data.response);
  } catch (error) {
    console.error("❌ CONNECTION FAILED");
    console.error("Error:", error.message);
    console.log("\n💡 TIPS:");
    console.log("1. Make sure Ollama is running in your taskbar or terminal.");
    console.log(`2. Ensure you have the model downloaded: run 'ollama run ${model}' in terminal.`);
  }
}

testOllama();
