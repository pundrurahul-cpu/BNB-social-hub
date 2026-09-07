const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.replace(/['"\r\n]/g, '').trim().split(/\s+/)[0] : null;

    if (!key) {
        console.log("❌ No Gemini Key found in .env file.");
        console.log("Debug: Searched for .env at " + path.join(__dirname, '..', '.env'));
        return;
    }

    console.log("🔍 Fetching available models for your API key...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            console.log("\n✅ AVAILABLE MODELS:");
            data.models.forEach(m => {
                const simpleName = m.name.replace('models/', '');
                console.log(`- ${simpleName} (${m.displayName})`);
            });
        } else if (data.error) {
            console.log("❌ Google API Error:", data.error.message);
        } else {
            console.log("❌ Unexpected Response:", data);
        }
    } catch (err) {
        console.error("❌ Network Error:", err.message);
    }
}

listModels();
