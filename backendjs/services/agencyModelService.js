const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const FASTAPI_URL = "http://localhost:8001";

/**
 * THE MAY 2026 STRATEGIC MODEL
 * Replicates the exact sequence from your spreadsheet image.
 */
const AGENCY_STRATEGY_SEQUENCE = [
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

async function generateStrategicMonthlyPlan(clientId, month, year) {
  console.log(`🧠 [Agency Model] Building Smart Plan for Client: ${clientId}...`);

  try {
    // 1. Get Client Rules (Mon, Wed, Fri)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client Strategy not found.");

    // 2. Identify target dates (Fixed Days + Holidays)
    const plannedSlots = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch special occasions/holidays
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Strategic Schedule" : null;
      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Content for each Slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const blueprint = AGENCY_STRATEGY_SEQUENCE[i % AGENCY_STRATEGY_SEQUENCE.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Brainstorm via Gemini
      const brief = await brainstormStrategicPost(strategy, blueprint, slot.reason);

      // Call FastAPI for Referral Image & Uniqueness Check
      let referralUrl = null;
      try {
        const brainRes = await axios.post(`${FASTAPI_URL}/verify-and-visualize`, {
          topic: brief.topic,
          visual_idea: brief.visual_idea,
          previous_topics: [] // To be filled from history
        });
        referralUrl = brainRes.data.referral_url;
      } catch (e) { console.warn("FastAPI offline, moodboard skipped."); }

      // 4. Save "Ghost Post" for Designer fulfillment
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption,
        referral_image_url: referralUrl
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Strategic Engine Error:', err.message);
    throw err;
  }
}

async function brainstormStrategicPost(strategy, blueprint, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Role: Agency Strategist. Brand: ${strategy.content_focus}. Funnel: ${blueprint.stage}. Type: ${blueprint.type}. Context: ${context}. Return ONLY JSON: {"topic": "...", "copy_direction": "...", "visual_idea": "...", "caption": "..."}`;
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateStrategicMonthlyPlan };
