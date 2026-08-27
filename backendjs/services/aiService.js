const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const { analyzeLocalImage, generateLocalJSON, generateLocalText } = require('./ollamaService');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

function cleanKey(val) {
  if (!val) return null;
  return val.replace(/['"\r\n]/g, '').trim().split(' ')[0];
}

const apiKey = cleanKey(process.env.GEMINI_API_KEY);
const genAI = new GoogleGenerativeAI(apiKey);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * AI Agent V1100: Local-First Multi-Model Router.
 */
async function enhanceContent(imageBuffer, mimeType, retryCount = 0) {
  // 1. Try Local Ollama Vision (Llava)
  if (retryCount === 0) {
    try {
      console.log(`🤖 [AI Agent] Attempting Local Analysis (Ollama/Llava)...`);
      const localResponse = await analyzeLocalImage(imageBuffer);
      if (localResponse) {
        console.log(`✅ [AI Agent] SUCCESS using Ollama/Llava`);
        return localResponse;
      }
    } catch (err) {
      console.warn(`⚠️ [AI Agent] Local AI unavailable: ${err.message}. Falling back to Cloud...`);
    }
  }

  // 2. Cloud Fallback (Gemini)
  if (!apiKey) throw new Error("No Gemini API key for fallback.");

  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro"];
  const modelName = modelsToTry[retryCount % modelsToTry.length];

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([
      { text: "Analyze this image and generate 3 engaging social media captions with hashtags suitable for Instagram, LinkedIn, and Twitter." },
      { inlineData: { data: imageBuffer.toString("base64"), mimeType } }
    ]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    if (error.message.includes('429') && retryCount < 3) {
      await sleep(5000);
      return enhanceContent(imageBuffer, mimeType, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Analyze Social Media Comments using Ollama (Local AI).
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
    console.log(`🦙 [AI Agent] Analyzing Comment Sentiment with Ollama...`);
    const analysis = await generateLocalJSON(prompt);
    return analysis;
  } catch (error) {
    console.error("Local Comment Analysis Error:", error.message);

    // Fallback to Gemini if Ollama fails
    if (apiKey) {
      try {
        console.log(`☁️ [AI Agent] Falling back to Gemini for Comment Analysis...`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt + "\nReturn ONLY valid JSON.");
        const response = await result.response;
        return JSON.parse(response.text().replace(/```json/g, '').replace(/```/g, '').trim());
      } catch (cloudErr) {
        console.error("Cloud Fallback Failed:", cloudErr.message);
      }
    }

    return {
      polarity_label: "neutral",
      polarity_confidence: 0.5,
      emotion_label: "neutral",
      intent_label: "unknown",
      urgency_label: "low",
      topic_label: "general",
      summary: "Analysis failed."
    };
  }
}

/**
 * Generate a comprehensive report using Ollama (Local AI).
 */
async function generateSentimentReport(postContent, commentsSummary) {
  const prompt = `
    You are a social media analyst. Generate a detailed report based on:

    Post Context: ${postContent}
    Comments Summary: ${JSON.stringify(commentsSummary)}

    The report MUST include:
    1. Key takeaway (Overall public perception).
    2. Top 3 Positive things people liked.
    3. Top 3 Negative things/Complaints.
    4. Suggestions for improvements based on user feedback.
    5. Emotional landscape summary.

    Format as a structured professional report.
  `;

  try {
    console.log(`🦙 [AI Agent] Generating Sentiment Report with Ollama...`);
    const report = await generateLocalText(prompt);
    if (!report) throw new Error("Ollama returned empty report");
    return report;
  } catch (error) {
    console.error("Local Report Generation Error:", error.message);

    // Fallback to Gemini
    if (apiKey) {
      try {
        console.log(`☁️ [AI Agent] Falling back to Gemini for Report Generation...`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (cloudErr) {
        console.error("Cloud Fallback Failed:", cloudErr.message);
      }
    }
    return "Failed to generate report locally or via cloud.";
  }
}

/**
 * Generate a professional AI reply for a social media comment.
 */
async function generateCommentReply(commentText, postContext, brandVoice = "Professional") {
  const prompt = `
    You are a social media manager for a premium agency.
    Your brand voice is: ${brandVoice}.

    POST CONTEXT: "${postContext}"
    USER COMMENT: "${commentText}"

    TASK:
    Generate a professional, helpful, and engaging reply to this comment.
    - Keep it concise (max 2 sentences).
    - Match the brand voice.
    - If the user asks a question, answer it if context is available.
    - If it's praise, be gracious.
    - If it's a complaint, be empathetic and professional.

    REPLY:
  `;

  try {
    console.log(`🦙 [AI Agent] Generating Auto-Reply with Ollama...`);
    const reply = await generateLocalText(prompt);
    if (!reply) throw new Error("Ollama returned empty reply");
    return reply.trim().replace(/^"|"$/g, ''); // Remove quotes if AI added them
  } catch (error) {
    console.error("Local Reply Generation Error:", error.message);

    // Fallback to Gemini
    if (apiKey) {
      try {
        console.log(`☁️ [AI Agent] Falling back to Gemini for Reply Generation...`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim().replace(/^"|"$/g, '');
      } catch (cloudErr) {
        console.error("Cloud Fallback Failed:", cloudErr.message);
      }
    }
    return "Thank you for your comment! We appreciate your engagement.";
  }
}

/**
 * Suggest top Instagram creators/businesses for a specific region AND industry.
 */
async function suggestRegionalSeeds(country, state, district, industry = "General") {
  const prompt = `
    You are a social media research specialist.
    Identify the top 10 most influential Instagram creators, celebrities, or business accounts that specialize in the "${industry}" industry and are based in or extremely popular in:
    Location: ${district}, ${state}, ${country}

    TASK:
    Return a JSON object with a single key "usernames" containing an array of exactly 10 Instagram usernames.
    - Usernames must be clean (no '@', no dots at the end).
    - Focus on accounts that post viral Reels related to ${industry}.
    - Include local industry leaders, specialized influencers, and top businesses in this field.

    EXAMPLE for Real Estate in Mumbai:
    { "usernames": ["luxury_homes_mumbai", "mumbai_properties", "indiaproperty"] }

    RETURN ONLY JSON.
  `;

  try {
    console.log(`🦙 [AI Researcher] Researching ${industry} trends for ${district}...`);
    const data = await generateLocalJSON(prompt);

    if (data && Array.isArray(data.usernames)) {
      return data.usernames.map(u => u.trim().replace(/^@/, ''));
    }

    throw new Error("Invalid JSON structure from AI");

  } catch (error) {
    console.error("Local Seed Suggestion Error:", error.message);

    // Fallback logic for common Indian regions to ensure feature works during dev
    if (country.toLowerCase() === 'india' && district.toLowerCase().includes('hyderabad')) {
       if (industry === 'Real Estate') return ['hyderabad_realestate', 'cybercity_builders', 'aparna_constructions', 'my_home_constructions'];
       if (industry === 'Fashion & Beauty') return ['hyderabad_fashion', 'neeraja_kona', 'shilpareddy', 'hyderabad_makeup_artist'];
       return ['hyderabad_diaries', 'viva_harsha', 'niharika_konidela', 'greatandhra'];
    }
    return ['instagram', 'creators', 'zuck', 'cristiano', 'leomessi'];
  }
}

console.log('\n--- 🚀 BNB SOCIAL AI AGENT V1100 ACTIVE ---');
console.log('✅ Local Engine: Ollama (Primary)');
console.log('✅ Cloud Backup: Gemini (Fallback)');
console.log('------------------------------------------\n');

module.exports = { enhanceContent, analyzeCommentSentiment, generateSentimentReport, generateCommentReply, suggestRegionalSeeds };
