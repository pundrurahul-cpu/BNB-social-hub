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
 * GEMINI PRIMARY ROUTER (V6.0 - Confirmed Models)
 * Prioritizing exact models verified by the list-models script.
 */
async function generateJSON(prompt, retryCount = 0, forcedModel = null) {
  console.log(`🧠 [AI Router] Generating Strategic JSON (Attempt ${retryCount + 1})...`);

  if (genAI) {
    // These models were explicitly confirmed as AVAILABLE in your last terminal output
    const modelsToTry = forcedModel ? [forcedModel] : [
      "gemini-3.8-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.5-flash",
      "gemini-pro"
    ];

    let lastErr = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`☁️ [Gemini] Calling ${modelName}...`);
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

  // Final Fallback to OpenAI
  if (openai && retryCount === 0) {
    try {
      console.log(`🤖 [OpenAI] Using GPT-4o as Fallback...`);
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

  throw new Error("All AI models failed. Quota might be exhausted.");
}

async function generateText(prompt, retryCount = 0) {
  if (genAI) {
    const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-pro-preview", "gemini-pro"];
    for (const modelName of modelsToTry) {
      try {
        console.log(`☁️ [Gemini] Text Gen with ${modelName}...`);
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
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  try {
    const result = await model.generateContent([
      { text: "Generate 3 captions for this image." },
      { inlineData: { data: imageBuffer.toString("base64"), mimeType } }
    ]);
    return (await result.response.text()).trim();
  } catch (error) {
    throw error;
  }
}

async function analyzeCommentSentiment(commentText) {
  const prompt = `Analyze: "${commentText}"`;
  try {
    return await generateJSON(prompt);
  } catch (error) {
    return { polarity_label: "neutral" };
  }
}

async function generateSentimentReport(postContent, commentsSummary) {
  const prompt = `Report for: ${postContent}. Stats: ${JSON.stringify(commentsSummary)}`;
  return await generateText(prompt);
}

async function generateCommentReply(commentText, postContext, brandVoice = "Professional") {
  const prompt = `Voice: ${brandVoice}. Context: "${postContext}" | Comment: "${commentText}". Reply:`;
  return await generateText(prompt);
}

async function suggestRegionalSeeds(country, state, district, industry = "General") {
  const prompt = `Usernames for ${industry} in ${district}.`;
  try {
    const data = await generateJSON(prompt);
    return data.usernames || ['creators'];
  } catch (err) {
    return ['creators'];
  }
}

console.log('\n--- 🚀 BNB CLOUD AI AGENT V6.0 (VERIFIED MODELS) ---');
console.log('✅ Primary: Gemini 3.8 Flash / 3.1 Pro Rotation');
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
