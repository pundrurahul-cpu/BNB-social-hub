const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const OpenAI = require("openai");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

function cleanKey(val) {
  if (!val) return null;
  return val.replace(/['"\r\n]/g, '').trim().split(/\s+/)[0];
}

const geminiKey = cleanKey(process.env.GEMINI_API_KEY);
const openAIKey = cleanKey(process.env.OPENAI_API_KEY);

const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

let openai = null;
if (openAIKey) {
  try {
    openai = new OpenAI({ apiKey: openAIKey });
  } catch (e) {
    console.warn("⚠️ OpenAI init failed:", e.message);
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function robustJSONParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        let jsonStr = match[0].replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

/**
 * GEMINI PRIMARY ROUTER (V4.0)
 * Prioritizing User-Requested Models: 2.0 Flash, 1.5 Pro, Flash Lite
 */
async function generateJSON(prompt, retryCount = 0, forcedModel = null) {
  console.log(`🧠 [AI Router] Generating Strategic JSON (Attempt ${retryCount + 1})...`);

  // 1. Try Gemini (NOW PRIMARY)
  if (genAI) {
    const modelsToTry = forcedModel ? [forcedModel] : [
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro",
      "gemini-1.5-flash-8b",
      "gemini-pro"
    ];

    let lastErr = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`☁️ [Gemini] Attempting ${modelName}...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        });
        const result = await model.generateContent(prompt + "\n\nReturn ONLY valid JSON.");
        const response = await result.response;
        const text = response.text();
        const data = robustJSONParse(text);
        if (data) return { ...data, engine: `Gemini (${modelName})` };
      } catch (err) {
        lastErr = err;
        console.warn(`⚠️ [Gemini] ${modelName} failed: ${err.message}`);

        if (err.message.includes('429')) {
           const quotaErr = new Error("QUOTA_EXCEEDED");
           quotaErr.originalMessage = err.message;
           throw quotaErr;
        }
      }
    }
  }

  // 2. Try OpenAI (NOW FALLBACK)
  if (openai && retryCount === 0) {
    try {
      console.log(`🤖 [OpenAI] Attempting Fallback via GPT-4o...`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt + "\n\nCRITICAL: Return ONLY valid JSON." }],
        response_format: { type: "json_object" }
      });
      const data = robustJSONParse(response.choices[0].message.content);
      if (data) return { ...data, engine: 'OpenAI (Fallback)' };
    } catch (err) {
      console.warn(`⚠️ [OpenAI] Fallback Failed: ${err.message}`);
    }
  }

  throw new Error("All AI Cloud models failed to generate valid JSON.");
}

async function generateText(prompt, retryCount = 0) {
  if (genAI) {
    const modelsToTry = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-pro"];
    for (const modelName of modelsToTry) {
      try {
        console.log(`☁️ [Gemini] Attempting Text Gen with ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return (await result.response.text()).trim();
      } catch (err) {
        console.warn(`⚠️ [Gemini] ${modelName} Text Gen Failed: ${err.message}`);
      }
    }
  }

  if (openai && retryCount === 0) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }]
      });
      return response.choices[0].message.content.trim();
    } catch (err) {
      console.warn(`⚠️ [OpenAI] Text Gen Failed: ${err.message}`);
    }
  }

  return "Content generation unavailable.";
}

async function enhanceContent(imageBuffer, mimeType, retryCount = 0) {
  if (!genAI) throw new Error("No Gemini API key for Vision processing.");
  const modelsToTry = ["gemini-2.0-flash-exp", "gemini-1.5-flash"];
  const modelName = modelsToTry[retryCount % modelsToTry.length];

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([
      { text: "Analyze this image and generate 3 engaging social media captions." },
      { inlineData: { data: imageBuffer.toString("base64"), mimeType } }
    ]);
    return (await result.response.text()).trim();
  } catch (error) {
    if (error.message.includes('429') && retryCount < 2) {
      await sleep(5000);
      return enhanceContent(imageBuffer, mimeType, retryCount + 1);
    }
    throw error;
  }
}

async function analyzeCommentSentiment(commentText) {
  const prompt = `Analyze comment sentiment. Return JSON: { "polarity_label": "...", "polarity_confidence": 0.0-1.0, "emotion_label": "...", "intent_label": "...", "urgency_label": "...", "topic_label": "...", "summary": "..." } Comment: "${commentText}"`;
  try {
    return await generateJSON(prompt);
  } catch (error) {
    return { polarity_label: "neutral", polarity_confidence: 0.5, summary: "Analysis failed." };
  }
}

async function generateSentimentReport(postContent, commentsSummary) {
  const prompt = `Post Context: ${postContent} | Comments: ${JSON.stringify(commentsSummary)}. Generate professional report.`;
  return await generateText(prompt);
}

async function generateCommentReply(commentText, postContext, brandVoice = "Professional") {
  const prompt = `Voice: ${brandVoice}. Context: "${postContext}" | Comment: "${commentText}". Generate concise reply.`;
  const reply = await generateText(prompt);
  return reply.replace(/^"|"$/g, '').trim();
}

async function suggestRegionalSeeds(country, state, district, industry = "General") {
  const prompt = `Influential usernames for: ${industry} in ${district}, ${state}, ${country}. JSON: { "usernames": [] }`;
  try {
    const data = await generateJSON(prompt);
    return (data && data.usernames) ? data.usernames.map(u => u.trim().replace(/^@/, '')) : ['creators'];
  } catch (err) {
    return ['creators'];
  }
}

console.log('\n--- 🚀 BNB CLOUD AI AGENT V3.0 (GEMINI PRIMARY) ---');
console.log('✅ Primary: Gemini Flash/Pro Rotation');
console.log('✅ Fallback: OpenAI GPT-4o');
console.log('---------------------------------------------------\n');

module.exports = {
  generateJSON,
  generateText,
  enhanceContent,
  analyzeCommentSentiment,
  generateSentimentReport,
  generateCommentReply,
  suggestRegionalSeeds,
  robustJSONParse
};
