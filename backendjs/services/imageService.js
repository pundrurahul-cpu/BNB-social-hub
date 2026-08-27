const OpenAI = require('openai');
const supabase = require('../supabaseClient');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

function cleanKey(val) {
  if (!val) return null;
  return val.replace(/['"\r\n]/g, '').trim().split(' ')[0];
}

const openai = new OpenAI({
  apiKey: cleanKey(process.env.OPENAI_API_KEY),
});

/**
 * Generate a precise strategic image based on content details.
 * Incorporates: Visual Idea, Funnel Stage, Topic, and Final Copy for Quotes.
 */
async function generateVisualReference(post, brandData) {
  const { visual_idea, funnel_stage, topic, content, id, copy_direction } = post;
  const { clientName, contentFocus, brandVoice } = brandData || {};

  try {
    console.log(`🎨 [Master Design AI] Fusing Visual Idea + Copy Direction for: "${topic}"...`);

    // 1. Build a "Master Designer" prompt using DUAL REFERENCES
    // This merges the LAYOUT (Visual Idea) with the MOOD/STORY (Copy Direction)
    let masterPrompt = `
      Professional social media marketing poster for "${clientName || 'Premium Brand'}".
      INDUSTRY: ${contentFocus || 'Business'}.
      MARKETING STAGE: ${funnel_stage || 'Awareness'}.
      BRAND VOICE: ${brandVoice || 'Professional'}.

      VISUAL DIRECTION (THE LAYOUT):
      ${visual_idea}.

      COPY DIRECTION (THE STORY & MOOD):
      ${copy_direction}.

      DESIGN EXECUTION:
      - Combine the layout from the visual direction with the emotional tone of the copy direction.
      - Use a minimalist, ultra-modern 3D composition.
      - Studio lighting, cinematic color grading, premium high-end aesthetic.
      - Ensure the composition feels like a cohesive brand advertisement.
    `.trim();

    // 2. Add "Text-on-Image" logic
    // FORCE CLEAR ENGLISH: We use ultra-strict directives to prevent "foreign" characters.
    if (content && content.length < 130) {
      masterPrompt += `
        \nTYPOGRAPHY PROTOCOL (CRITICAL):
        - WRITTEN TEXT: "${content.replace(/"/g, '')}"
        - LANGUAGE: MUST BE WRITTEN IN CLEAR ENGLISH ONLY.
        - NO FOREIGN CHARACTERS, NO GIBBERISH.
        - FONT: Bold, modern, high-contrast sans-serif.
        - POSITION: Center of the image.
        - Perfect text clarity and professional alignment.
      `;
    } else {
      masterPrompt += `
        \nTYPOGRAPHY PROTOCOL (CRITICAL):
        - WRITTEN HEADLINE: "${topic.toUpperCase()}"
        - LANGUAGE: MUST BE WRITTEN IN CLEAR ENGLISH ONLY.
        - NO FOREIGN CHARACTERS.
        - FONT: Massive, professional bold font.
        - Perfect text clarity, sharp edges, NO spelling mistakes.
      `;
    }

    // 3. Try DALL-E 3 (High end, good at text)
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: masterPrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd"
      });
      console.log('✅ [Image AI] DALL-E 3 Success');
      return await downloadAndUploadReference(response.data[0].url, id);
    } catch (dalle3Err) {
      const status = dalle3Err.status || (dalle3Err.message?.includes('402') ? 402 : 0);
      console.warn(`⚠️ [Image AI] DALL-E 3 unavailable (Status: ${status}). Falling back to FLUX...`);

      // 4. FINAL FALLBACK: Pollinations.ai (FLUX)
      // FLUX is the current industry leader for text rendering in AI images.
      const encodedPrompt = encodeURIComponent(masterPrompt + ", clear professional typography, sharp focus, 4k, graphic design masterpiece");

      // CRITICAL: We explicitly add &model=flux to the URL to ensure the best text model is used
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&model=flux&seed=${Math.floor(Math.random() * 50000)}`;

      console.log('✅ [Image AI] Success using Pollinations (FLUX Engine)');
      return await downloadAndUploadReference(fallbackUrl, id);
    }
  } catch (error) {
    console.error('❌ [Image AI] Generation Fail:', error.message);
    throw error;
  }
}

/**
 * Downloads an external image and uploads it to Supabase
 */
async function downloadAndUploadReference(imageUrl, postId) {
  // Download Image
  const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(imageRes.data, 'binary');

  // Upload to Supabase Storage
  const fileName = `visual-ref-${postId || Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
  const { data, error } = await supabase.storage
    .from('media')
    .upload(fileName, buffer, {
      contentType: 'image/png',
      upsert: true
    });

  if (error) throw error;

  // Get Public URL
  const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(fileName);
  console.log('✅ [Image AI] Reference uploaded to storage');

  return publicUrlData.publicUrl;
}

module.exports = { generateVisualReference };
