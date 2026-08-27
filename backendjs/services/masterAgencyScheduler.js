const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const AI_BRAIN_URL = "http://localhost:8001"; // Your FastAPI URL

/**
 * THE MAY 2026 STRATEGIC MODEL
 * Replicates the exact sequence from your spreadsheet image.
 */
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
 * MASTER SCHEDULER:
 * Automatically plans the next month's strategic calendar.
 */
async function buildStrategicAgencyCalendar(clientId, month, year) {
  console.log(`🧠 [Master Scheduler] Auto-Planning for Client: ${clientId}...`);

  try {
    // 1. Get Client Strategy Config (Mon, Wed, Fri rules)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found.");

    // 2. Identify all Slots (Mon, Wed, Fri + Holidays)
    const daysInMonth = new Date(year, month, 0).getDate();
    const plannedSlots = [];

    // Fetch special occasions
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Regular Weekly Slot" : null;
      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Content for each Slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const blueprint = STRATEGY_MODEL[i % STRATEGY_MODEL.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // 4. Brainstorm via AI (Ensuring Uniqueness)
      const { data: history } = await supabase.from('posts').select('strategic_topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.strategic_topic).filter(Boolean) || [];

      console.log(`🤖 AI Brainstorming: ${blueprint.stage} for ${slot.date}`);

      // We call Gemini here, but in Phase 2 we will call the FastAPI microservice
      const aiResponse = await generateStrategicBrief(strategy, blueprint, slot.reason, pastTopics);

      // 5. Create Ghost Post (Designer Placeholder)
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        strategic_topic: aiResponse.topic,
        copy_direction: aiResponse.copy_direction,
        visual_idea: aiResponse.visual_idea,
        content: aiResponse.caption,
        metadata: {
          strategic_goal: blueprint.goal,
          is_agency_auto: true
        }
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Master Scheduler Failed:', err.message);
    throw err;
  }
}

async function generateStrategicBrief(strategy, blueprint, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Content Strategist for ${strategy.content_focus} brand.
    Voice: ${strategy.brand_voice}. Funnel: ${blueprint.stage}. Goal: ${blueprint.goal}.
    Slot: ${context}. Type: ${blueprint.type}.

    CRITICAL: Ensure the topic is 100% unique. Do NOT repeat these topics: [${history.join(', ')}]

    Return ONLY JSON:
    {
      "topic": "Catchy headline",
      "copy_direction": "Instruction for the designer",
      "visual_idea": "Detailed brief for a designer to create a referral image/moodboard",
      "caption": "Draft post caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { buildStrategicAgencyCalendar };
