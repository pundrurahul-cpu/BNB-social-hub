const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().split(' ')[0] : null;

async function testAI() {
  if (!apiKey) {
    console.error("❌ No API Key found in .env");
    return;
  }

  console.log("Testing AI with Key:", apiKey.substring(0, 10) + "...");
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // Try the most stable model name
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("Sending test prompt...");
    const result = await model.generateContent("Say hello!");
    const response = await result.response;
    console.log("✅ Success! Response:", response.text());
  } catch (error) {
    console.error("❌ Test Failed!");
    console.error("Error Message:", error.message);
    if (error.stack) console.error("Stack Trace:", error.stack);
  }
}

testAI();
