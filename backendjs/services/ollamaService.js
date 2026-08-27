const axios = require('axios');
require('dotenv').config();

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const TEXT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava';

/**
 * Generic Text generator for Ollama
 */
async function generateLocalText(prompt) {
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: TEXT_MODEL,
      prompt: prompt,
      stream: false
    });
    return response.data?.response;
  } catch (error) {
    console.error("❌ Ollama Text Error:", error.message);
    throw error;
  }
}

/**
 * Generic JSON generator for Ollama
 */
async function generateLocalJSON(prompt) {
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: TEXT_MODEL,
      prompt: prompt,
      stream: false,
      format: "json",
      options: {
        num_ctx: 4096,
        temperature: 0.2
      }
    });

    const rawResponse = response.data?.response;
    if (!rawResponse) throw new Error("Empty response from Ollama");
    return JSON.parse(rawResponse);
  } catch (error) {
    if (error.response) {
      console.error(`❌ Ollama JSON Error (Status ${error.response.status}):`, error.response.data);
    } else {
      console.error("❌ Ollama JSON Error:", error.message);
    }
    throw error;
  }
}

/**
 * Local AI Service - Expert Creative Content Writer Edition
 */
async function generateLocalContent(prompt) {
  try {
    console.log(`🦙 [AI Copywriter] Architecting with ${TEXT_MODEL}...`);

    // Inject Creative Writer System Instructions
    const creativePrompt = `
      You are an EXPERT CREATIVE CONTENT WRITER & SENIOR STRATEGIST.
      Your goal is to write high-converting, viral-ready social media content.

      RULES:
      1. HOOK: Start with a powerful "Pattern Interrupt" headline.
      2. STORYTELLING: Use emotional triggers and professional narrative.
      3. STRUCTURE: Use short sentences, line breaks, and clear bullet points.
      4. BRANDING: Strictly adhere to the Brand Voice and Content Focus instructions.
      5. CALL TO ACTION: Include a high-intent CTA at the end.

      ${prompt}
    `;

    const data = await generateLocalJSON(creativePrompt);

    return {
      topic: data.topic || "Strategic Milestone",
      post_type: data.post_type || "Static",
      copy_direction: data.copy_direction || data.brief || "Strategy processing...",
      visual_idea: data.visual_idea || data.visual_style || "Brand-aligned visual.",
      caption: data.caption || data.copy || "",
      alternative_angles: Array.isArray(data.alternative_angles) ? data.alternative_angles : [],
      expert_rationale: data.expert_rationale || "Strategic recommendation.",
      engine: `Ollama (${TEXT_MODEL} Expert Copywriter)`
    };
  } catch (error) {
    console.warn("⚠️ JSON Parse failed. Using raw fallback.");
    return {
      topic: "Strategic Update",
      caption: "Error generating strategy details.",
      copy_direction: "Standard outreach strategy.",
      engine: `Ollama (${TEXT_MODEL} - Error)`
    };
  }
}

async function analyzeLocalImage(imageBuffer, prompt) {
  try {
    console.log(`🦙 [Ollama Vision] Analyzing with ${VISION_MODEL}...`);
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: VISION_MODEL,
      prompt: prompt || "Analyze this image for marketing potential. Describe the visual elements, mood, and target audience.",
      images: [imageBuffer.toString('base64')],
      stream: false
    });

    if (!response.data?.response) {
      throw new Error("Empty response from Ollama Vision");
    }

    return response.data.response;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Ollama Vision Error (Status ${error.response.status}):`, error.response.data);
    } else {
      console.error("❌ Ollama Vision Error:", error.message);
    }
    throw error;
  }
}

module.exports = { generateLocalContent, analyzeLocalImage, generateLocalJSON, generateLocalText };
