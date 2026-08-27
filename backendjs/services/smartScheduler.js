const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// The exact sequence from your spreadsheet
const STRATEGY_MODEL = [
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
 * SMART SCHEDULER: Builds a strategic month based on the spreadsheet funnel.
 */
async function generateSmartSchedule(clientId, month, year) {
  console.log(`🚀 [Smart Scheduler] Building strategic plan for Client ${clientId}...`);

  try {
    // 1. Get Client Strategy Rules (Mon, Wed, Fri)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client strategy not found. Set posting days in Settings first.");

    // 2. Identify Dates (Mon, Wed, Fri + Holidays)
    const daysInMonth = new Date(year, month, 0).getDate();
    const plannedDates = [];

    // Fetch special occasions/holidays
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Fixed Weekly Slot";

      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedDates.push({ date: dateStr, reason });
    }

    // 3. Generate Content for each slot
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const blueprint = STRATEGY_MODEL[i % STRATEGY_MODEL.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Check if slot already filled
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Brainstorm via AI
      console.log(`🤖 [AI Brain] Brainstorming ${blueprint.stage} for ${slot.date}...`);
      const aiResponse = await generateStrategicIdea(strategy, blueprint, slot.reason);

      // 4. Save "Ghost Post" for Designer fulfillment
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
        metadata: {
          goal: blueprint.goal,
          visual_prompt: aiResponse.visual_idea,
          is_auto_strategy: true
        }
      }]);
    }

    return { success: true, count: plannedDates.length };
  } catch (err) {
    console.error('❌ [Smart Scheduler] Failed:', err.message);
    throw err;
  }
}

async function generateStrategicIdea(strategy, blueprint, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Context: ${context} post for ${strategy.content_focus}.
    Funnel Stage: ${blueprint.stage}
    Strategic Goal: ${blueprint.goal}
    Post Type: ${blueprint.type}
    Brand Voice: ${strategy.brand_voice}

    Task: Create a unique social media post brief. Output ONLY valid JSON:
    {
      "topic": "Creative title of the post",
      "copy_direction": "Instruction for the designer on what text/message to emphasize",
      "visual_idea": "DETAILED visual description for a designer to create a referral image",
      "caption": "The full post text with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateSmartSchedule };
