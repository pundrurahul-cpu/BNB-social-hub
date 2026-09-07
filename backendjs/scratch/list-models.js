require('dotenv').config({ path: '../.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.replace(/['"\r\n]/g, '').trim().split(/\s+/)[0] : null;
    if (!key) { console.log("❌ No Gemini Key found."); return; }

    console.log("🔍 Fetching available models for your API key...");
    try {
        // We use a simple fetch to the Google API to see what is actually there
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            console.log("\n✅ AVAILABLE MODELS:");
            data.models.forEach(m => {
                console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
            });
        } else {
            console.log("❌ No models found in response:", data);
        }
    } catch (err) {
        console.error("❌ Error listing models:", err.message);
    }
}

listModels();
