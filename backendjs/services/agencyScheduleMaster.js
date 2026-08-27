const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const AI_BRAIN_URL = "http://localhost:8000"; // FastAPI Brain

/**
 * THE AGENCY FUNNEL BLUEPRINT (Replicated from your spreadsheet)
 * Cycles through stages: Awareness, Interest, Value, Trust, Consideration, Conversion, Soft Conversion.
 */
const STRATEGY_SEQUENCE = [
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

async function runStrategicAutoPlanner(clientId, month, year) {
  console.log(`🧠 [Agency Brain] Planning strategic calendar for Client: ${clientId}...`);

  try {
    // 1. Get Client Posting Rules (Mon, Wed, Fri)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found. Set days in Settings first.");

    // 2. Map Target Dates (Mandatory MWF + Holidays)
    const plannedSlots = [];
    const totalDays = new Date(year, month, 0).getDate();

    // Fetch special occasions/holidays
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Strategic Schedule" : null;
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Process Content for each Slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const blueprint = STRATEGY_SEQUENCE[i % STRATEGY_SEQUENCE.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Check if already planned
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // 4. Brainstorm via Gemini
      const aiResponse = await generateStrategicBrief(strategy, blueprint, slot.reason);

      // 5. Call FastAPI for Uniqueness & Referral Image
      let referralUrl = null;
      try {
        const brainRes = await axios.post(`${AI_BRAIN_URL}/verify-and-visualize`, {
          client_id: clientId,
          funnel_stage: blueprint.stage,
          topic: aiResponse.topic,
          visual_idea: aiResponse.visual_idea,
          previous_topics: [] // To be fetched from DB history
        });
        referralUrl = brainRes.data.referral_url;
      } catch (e) { console.warn("FastAPI offline, referral moodboard skipped."); }

      // 6. Create Ghost Post (Fulfillment Placeholder)
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms || ['facebook', 'instagram'],
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: aiResponse.topic,
        copy_direction: aiResponse.copy_direction,
        visual_idea: aiResponse.visual_idea,
        content: aiResponse.caption,
        referral_image_url: referralUrl,
        metadata: {
          strategic_goal: blueprint.goal,
          automation_id: 'Agency_Brain_v1'
        }
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Strategic Engine Failed:', err.message);
    throw err;
  }
}

async function generateStrategicBrief(strategy, blueprint, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
    Role: Senior Marketing Strategist.
    Brand: ${strategy.content_focus} (${strategy.brand_voice}).
    Stage: ${blueprint.stage} | Post Type: ${blueprint.type} | Goal: ${blueprint.goal}
    Context: ${context}

    Return ONLY valid JSON:
    {
      "topic": "Catchy Headline",
      "copy_direction": "Brief explaining the core message for the designer/writer",
      "visual_idea": "Detailed composition for a referral moodboard",
      "caption": "Engaging caption with 5 hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { runStrategicAutoPlanner };
