const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const rawKey = process.env.GEMINI_API_KEY || "";
const apiKey = rawKey.replace(/['"\r\n]/g, '').trim().split(' ')[0];

async function diagnose() {
  console.log("🔍 DIAGNOSING GEMINI API...");
  console.log("🔑 Using Key:", apiKey.substring(0, 10) + "...");

  if (!apiKey) {
    console.error("❌ No API Key found in server/.env");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const tests = [
    { model: "gemini-1.5-flash", version: "v1" },
    { model: "gemini-1.5-flash", version: "v1beta" },
    { model: "gemini-1.5-pro", version: "v1" },
    { model: "gemini-pro", version: "v1" },
    { model: "gemini-2.0-flash", version: "v1beta" }
  ];

  for (const test of tests) {
    try {
      console.log(`\nTesting ${test.model} on API ${test.version}...`);
      const model = genAI.getGenerativeModel({ model: test.model }, { apiVersion: test.version });
      const result = await model.generateContent("Hello");
      const text = result.response.text();
      console.log(`✅ SUCCESS: ${test.model} (${test.version}) is working!`);
      console.log(`💬 Response: ${text.substring(0, 20)}...`);
    } catch (err) {
      console.log(`❌ FAILED: ${test.model} (${test.version}) -> ${err.message}`);
    }
  }
}

diagnose();
