const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * THE MAY 2026 STRATEGIC SEQUENCE
 * Replicates the exact funnel rotation from your spreadsheet.
 */
const STRATEGIC_SEQUENCE = [
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

async function generateMonthlySmartPlan(clientId, month, year) {
  console.log(`🧠 [Smart Planner] Building strategy for Client: ${clientId}...`);

  try {
    // 1. Get Client Rules
    const { data: rules } = await supabase.from('agency_strategies').select('*').eq('client_id', clientId).single();
    if (!rules) throw new Error("Strategy rules not found for this client.");

    // 2. Identify target dates (Mandatory Days + Special Days)
    const plannedSlots = [];
    const totalDays = new Date(year, month, 0).getDate();

    // Fetch special days for the month
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: specialDays } = await supabase.from('special_days').select('*').gte('event_date', startStr).lte('event_date', endStr);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = rules.posting_days.includes(dayOfWeek) ? "Regular Weekly Schedule" : null;
      const special = specialDays?.find(s => s.event_date === dateStr);
      if (special) reason = reason ? `${reason} & ${special.title}` : special.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Generate Content for each Slot (Ensuring 0% Repetition)
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const blueprint = STRATEGIC_SEQUENCE[i % STRATEGIC_SEQUENCE.length];
      const scheduledAt = `${slot.date}T${rules.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Uniqueness Check: Fetch history
      const { data: history } = await supabase.from('posts').select('strategic_topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.strategic_topic).filter(Boolean).join(', ') || 'None';

      const brief = await brainstormStrategicContent(rules, blueprint, slot.reason, pastTopics);

      // 4. Create Ghost Post (Fulfillment Placeholder)
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: ['facebook', 'instagram', 'linkedin', 'pinterest'],
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        strategic_topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Smart Planner Failed:', err.message);
    throw err;
  }
}

async function brainstormStrategicContent(rules, blueprint, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
    Role: Senior Marketing Strategist.
    Brand Focus: ${rules.industry_focus}
    Voice: ${rules.brand_voice}
    Current Funnel Stage: ${blueprint.stage} (Goal: ${blueprint.goal})
    Post Type: ${blueprint.type}
    Context: ${context}

    CRITICAL: Ensure the topic is 100% unique. Do NOT repeat these topics: [${history}]

    Output ONLY valid JSON:
    {
      "topic": "Catchy post title",
      "copy_direction": "Instruction for the designer on what message/text to put on the graphic",
      "visual_idea": "A detailed brief for a designer to create a referral image/reference",
      "caption": "Complete post caption with 5 relevant hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateMonthlySmartPlan };
