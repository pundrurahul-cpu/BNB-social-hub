require('dotenv').config({ path: '../.env' });
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const OpenAI = require("openai");

async function testOpenAI() {
    console.log("\n--- 🤖 Testing OpenAI ---");
    const key = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.replace(/['"\r\n]/g, '').trim().split(/\s+/)[0] : null;
    if (!key) { console.log("❌ No OpenAI Key found."); return; }
    const openai = new OpenAI({ apiKey: key });
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Say 'OpenAI OK'" }]
        });
        console.log("✅ OpenAI Success:", response.choices[0].message.content);
    } catch (err) {
        console.error("❌ OpenAI Error:", err.message);
    }
}

async function testGemini(modelName) {
    console.log(`\n--- ☁️ Testing Gemini (${modelName}) ---`);
    const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.replace(/['"\r\n]/g, '').trim().split(/\s+/)[0] : null;
    if (!key) { console.log("❌ No Gemini Key found."); return; }
    const genAI = new GoogleGenerativeAI(key);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say 'Gemini OK'");
        const text = await result.response.text();
        console.log(`✅ Gemini (${modelName}) Success:`, text);
    } catch (err) {
        console.error(`❌ Gemini (${modelName}) Error:`, err.message);
    }
}

async function run() {
    await testOpenAI();
    await testGemini("gemini-3.6-flash");
    await testGemini("gemini-3.1-pro-preview");
    await testGemini("gemini-flash-latest");
}

run();
