const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const OpenAI = require("openai");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

function cleanKey(val) {
  if (!val) return null;
  // Handle multiple keys or messy strings from .env
  return val.replace(/['"\r\n]/g, '').trim().split(/\s+/)[0];
}

const geminiKey = cleanKey(process.env.GEMINI_API_KEY);
const openAIKey = cleanKey(process.env.OPENAI_API_KEY);

const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

// Safer OpenAI initialization for various versions
let openai = null;
if (openAIKey) {
  try {
    openai = new OpenAI({ apiKey: openAIKey });
  } catch (e) {
    console.warn("⚠️ OpenAI init failed (might be an older version):", e.message);
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Robust JSON extraction from AI responses.
 * Handles markdown code blocks, reasoning text, and common formatting artifacts.
 */
function robustJSONParse(text) {
  if (!text) return null;
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try extracting content between first { and last }
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        // Clean markdown tags if they are inside or around the match
        let jsonStr = match[0].replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
      } catch (e2) {
        console.error("❌ Robust JSON Parse failed. Raw Text Snippet:", text.substring(0, 100));
        return null;
      }
    }
    return null;
  }
}

/**
 * Centralized JSON Generation: OpenAI (Primary) -> Gemini (Fallback)
 */
async function generateJSON(prompt, retryCount = 0, forcedModel = null) {
  console.log(`🧠 [AI Router] Generating Strategic JSON (Attempt ${retryCount + 1})...`);

  // 1. Try OpenAI Primary (only if not forcing a specific Gemini model)
  if (openai && retryCount === 0 && !forcedModel) {
    try {
      console.log(`🤖 [OpenAI] Using GPT-4o...`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt + "\n\nCRITICAL: Return ONLY valid JSON." }],
        response_format: { type: "json_object" }
      });
      const data = robustJSONParse(response.choices[0].message.content);
      if (data) return { ...data, engine: 'OpenAI Cloud' };
    } catch (err) {
      console.warn(`⚠️ [OpenAI] Failed: ${err.message}. Falling back to Gemini...`);
    }
  }

  // 2. Try Gemini Fallback
  if (genAI) {
    // Optimized list for Free Tier (Flash models have higher RPM)
    const modelsToTry = forcedModel ? [forcedModel, "gemini-1.5-flash", "gemini-1.5-flash-8b"] : ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-pro"];
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

        // If it's a 429, we propagate it immediately to trigger recovery logic
        if (err.message.includes('429')) {
           const quotaErr = new Error("QUOTA_EXCEEDED");
           quotaErr.originalMessage = err.message;
           throw quotaErr;
        }
      }
    }
  }

  throw new Error("All AI Cloud models failed to generate valid JSON.");
}

/**
 * Centralized Text Generation: OpenAI -> Gemini
 */
async function generateText(prompt, retryCount = 0) {
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

  if (genAI) {
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-8b"];
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

  return "Content generation unavailable.";
}

/**
 * Vision-Enhanced Content Refinement (Cloud-Only)
 */
async function enhanceContent(imageBuffer, mimeType, retryCount = 0) {
  console.log(`📸 [AI Router] Enhancing Content via Cloud Vision...`);

  if (!genAI) throw new Error("No Gemini API key for Vision processing.");

  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-8b"];
  const modelName = modelsToTry[retryCount % modelsToTry.length];

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([
      { text: "Analyze this image and generate 3 engaging social media captions with hashtags suitable for Instagram, LinkedIn, and Twitter." },
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

/**
 * Analyze Social Media Comments (Centralized Router)
 */
async function analyzeCommentSentiment(commentText) {
  const prompt = `
    Analyze the following social media comment and return a JSON object with EXACTLY these keys:
    {
      "polarity_label": "positive" | "negative" | "neutral",
      "polarity_confidence": 0.0 to 1.0,
      "emotion_label": "happy", "angry", "curious", "frustrated", etc.,
      "intent_label": "feedback", "question", "complaint", "praise",
      "urgency_label": "low", "medium", "high",
      "topic_label": "features", "pricing", "delivery", etc.,
      "summary": "1-sentence summary"
    }

    Comment: "${commentText}"
  `;

  try {
    return await generateJSON(prompt);
  } catch (error) {
    return {
      polarity_label: "neutral",
      polarity_confidence: 0.5,
      emotion_label: "neutral",
      intent_label: "unknown",
      urgency_label: "low",
      topic_label: "general",
      summary: "Analysis failed.",
      engine: "Safety Fallback"
    };
  }
}

async function generateSentimentReport(postContent, commentsSummary) {
  const prompt = `
    You are a social media analyst. Generate a detailed report based on:
    Post Context: ${postContent}
    Comments Summary: ${JSON.stringify(commentsSummary)}
    Format as a structured professional report.
  `;
  return await generateText(prompt);
}

async function generateCommentReply(commentText, postContext, brandVoice = "Professional") {
  const prompt = `
    You are a social media manager for a premium agency. Brand voice: ${brandVoice}.
    Context: "${postContext}" | Comment: "${commentText}"
    Generate a concise (max 2 sentences) professional reply.
  `;
  const reply = await generateText(prompt);
  return reply.replace(/^"|"$/g, '').trim();
}

async function suggestRegionalSeeds(country, state, district, industry = "General") {
  const prompt = `
    Identify the top 10 most influential Instagram usernames for: ${industry} in ${district}, ${state}, ${country}.
    Return JSON: { "usernames": ["user1", "user2", ...] }
  `;
  try {
    const data = await generateJSON(prompt);
    if (data && Array.isArray(data.usernames)) {
      return data.usernames.map(u => u.trim().replace(/^@/, ''));
    }
    return ['instagram', 'creators', 'zuck'];
  } catch (err) {
    return ['instagram', 'creators', 'zuck'];
  }
}

console.log('\n--- 🚀 BNB CLOUD AI AGENT V2.0 ACTIVE ---');
console.log('✅ Primary: OpenAI (GPT-4o)');
console.log('✅ Fallback: Gemini (1.5 Flash)');
console.log('------------------------------------------\n');

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
