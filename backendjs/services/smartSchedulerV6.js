const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// The 12-Post Strategic Funnel Sequence from your spreadsheet
const FUNNEL_BLUEPRINT = [
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

/**
 * AUTOMATIC SCHEDULER:
 * 1. Analyzes the month.
 * 2. Finds Mon, Wed, Fri + Special Days.
 * 3. Checks history to ensure 0% repetition.
 * 4. Generates Creative Brief + Referral Image for the Designer.
 */
async function generateAutoSchedule(clientId, month, year) {
  console.log(`🧠 [Smart Scheduler] Building Strategy for Client ${clientId}...`);

  try {
    // 1. Fetch Client Strategy & History
    const { data: strategy } = await supabase.from('client_strategies_v2').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client Strategy not found.");

    const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(30);
    const previousTopics = history?.map(h => h.topic).join(', ') || 'None';

    // 2. Identify Dates
    const daysInMonth = new Date(year, month, 0).getDate();
    const plannedSlots = [];

    // Fetch special occasions
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      let reason = strategy.mandatory_days.includes(dayOfWeek) ? "Mandatory Slot" : null;
      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Brainstorm Content per Slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const blueprint = FUNNEL_BLUEPRINT[i % FUNNEL_BLUEPRINT.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Skip if already scheduled
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      console.log(`🤖 AI Planning: ${blueprint.stage} for ${slot.date}`);

      // Use Gemini to generate the Strategic Brief
      const brief = await generateStrategicBrief(strategy, blueprint, slot.reason, previousTopics);

      // 4. Create Ghost Post
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: ['facebook', 'instagram', 'linkedin', 'pinterest'],
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption,
        metadata: {
          visual_prompt: brief.visual_idea,
          is_auto_strategy: true
        }
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Scheduler V6 Failed:', err.message);
    throw err;
  }
}

async function generateStrategicBrief(strategy, blueprint, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Senior Marketing Strategist.
    Client: ${strategy.industry} (${strategy.brand_voice}).
    Funnel Stage: ${blueprint.stage} | Post Type: ${blueprint.type}
    Context: ${context}

    CRITICAL: Do NOT repeat these previous topics: [${history}]

    Return ONLY JSON:
    {
      "topic": "Creative Headline",
      "copy_direction": "Instruction for designer on what points to highlight",
      "visual_idea": "Detailed composition for a referral image for a designer",
      "caption": "Post caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateAutoSchedule };
