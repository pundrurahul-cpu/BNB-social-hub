const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const AI_WORKER_URL = "http://localhost:8000"; // FastAPI Endpoint

/**
 * THE 12-POST STRATEGIC SEQUENCE (From your spreadsheet)
 */
const funnelSequence = [
  { stage: 'Awareness', goal: 'Real Learning', type: 'Static' },
  { stage: 'Interest', goal: 'Concept Clarity', type: 'Static' },
  { stage: 'Awareness', goal: 'Classroom Reality', type: 'Reel' },
  { stage: 'Value', goal: 'Skill Development', type: 'Static' },
  { stage: 'Value', goal: 'Individual Attention', type: 'Static' },
  { stage: 'Trust', goal: 'Teaching Style', type: 'Reel' },
  { stage: 'Awareness', goal: 'Learning Environment', type: 'Static' },
  { stage: 'Trust', goal: 'Student Confidence', type: 'Static' },
  { stage: 'Trust', goal: 'Student Growth', type: 'Reel' },
  { stage: 'Consideration', goal: 'Why Choose Us', type: 'Static' },
  { stage: 'Conversion', goal: 'Parent Trust', type: 'Static' },
  { stage: 'Soft Conversion', goal: 'Admission CTA', type: 'Reel' }
];

async function runMonthlyAutomation(clientId, month, year) {
  console.log(`🧠 [Automation Brain] Starting monthly plan for ${clientId}...`);

  try {
    // 1. Get Client Strategy Config
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found. Set Mon/Wed/Fri in Settings first.");

    // 2. Map target dates (Mon, Wed, Fri + Special Occasions)
    const plannedDates = [];
    const totalDays = new Date(year, month, 0).getDate();

    // Fetch special occasions for the month
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Regular Schedule";
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) plannedDates.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Content for each slot
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const blueprint = funnelSequence[i % funnelSequence.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Check if slot already filled
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Call AI to generate unique Topic & Copy Direction
      const aiBrief = await generateStrategicBrief(strategy, blueprint, slot.reason);

      // 4. Call FastAPI for Referral Image (moodboard for designer)
      let referralUrl = null;
      try {
        const aiResponse = await axios.post(`${AI_WORKER_URL}/generate-referral-brief`, {
          client_id: clientId,
          focus: strategy.content_focus,
          funnel_stage: blueprint.stage,
          topic: aiBrief.topic,
          visual_idea: aiBrief.visual_idea
        });
        referralUrl = aiResponse.data.referral_url;
      } catch (e) { console.warn("AI Worker (FastAPI) offline. Skipping referral image."); }

      // 5. Create "Ghost Post" for Designer fulfillment
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: aiBrief.topic,
        copy_direction: aiBrief.copy_direction,
        visual_idea: aiBrief.visual_idea,
        referral_image_url: referralUrl,
        content: aiBrief.caption
      }]);
    }

    return { success: true, count: plannedDates.length };
  } catch (err) {
    console.error('Brain Automation Error:', err.message);
    throw err;
  }
}

async function generateStrategicBrief(strategy, blueprint, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Get history to ensure 0% repetition
  const { data: history } = await supabase.from('posts').select('topic').eq('client_id', strategy.client_id).limit(20);
  const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

  const prompt = `
    Funnel Stage: ${blueprint.stage} | Goal: ${blueprint.goal} | Post Type: ${blueprint.type}
    Client focus: ${strategy.content_focus}
    Context: ${context}

    CRITICAL: Ensure the topic is 100% unique. Do NOT repeat these topics: [${pastTopics}]

    Return ONLY JSON:
    {
      "topic": "Creative Headline",
      "copy_direction": "Brief for the writer/designer",
      "visual_idea": "Description of the referral image (layout, mood)",
      "caption": "Draft post text with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { runMonthlyAutomation };
