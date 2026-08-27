const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * THE AGENCY FUNNEL SEQUENCE (Replicated from your spreadsheet)
 * Cycles through stages to move cold prospects to conversions.
 */
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

async function generateAgencyMonthlyPlan(clientId, month, year) {
  console.log(`🧠 [Agency Brain] Planning month for Client: ${clientId}...`);

  try {
    // 1. Get Client Strategy DNA (Posting Days, brand focus)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found.");

    // 2. Identify all Slots (Mon, Wed, Fri + Occasions)
    const plannedSlots = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch special occasions
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Regular Schedule" : null;
      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Content for each slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const blueprint = FUNNEL_BLUEPRINT[i % FUNNEL_BLUEPRINT.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Collision Check
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Brainstorm via Gemini
      const brief = await generateStrategicBrief(strategy, blueprint, slot.reason);

      // 4. Save "Ghost Post" for Designer fulfillment
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms || ['facebook', 'instagram'],
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption,
        metadata: {
          visual_prompt: brief.visual_idea,
          automation_id: 'AgencySmartBrain_v1'
        }
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Agency Brain Failed:', err.message);
    throw err;
  }
}

async function generateStrategicBrief(strategy, blueprint, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Get history for uniqueness check
  const { data: history } = await supabase.from('posts').select('topic').eq('client_id', strategy.client_id).limit(20);
  const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

  const prompt = `
    Funnel Stage: ${blueprint.stage} | Goal: ${blueprint.goal} | Post Type: ${blueprint.type}
    Client focus: ${strategy.content_focus}
    Context: ${context}

    CRITICAL: Ensure the topic is 100% unique. Do NOT repeat these topics: [${pastTopics}]

    Return ONLY JSON:
    {
      "topic": "Creative headline of the post",
      "copy_direction": "Brief for the designer on what text/message to emphasize",
      "visual_idea": "A detailed visual brief for a designer to create a referral image/moodboard",
      "caption": "Engaging post caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateAgencyMonthlyPlan };
