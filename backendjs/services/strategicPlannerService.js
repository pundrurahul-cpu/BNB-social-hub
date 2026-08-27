const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * FUNNEL STAGES ROTATION (From your spreadsheet)
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

async function generateMonthlyStrategicPlan(clientId, month, year) {
  console.log(`🧠 [Agency Brain] Planning strategic month for Client ${clientId}...`);

  try {
    // 1. Get Client Config
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found.");

    const daysInMonth = new Date(year, month, 0).getDate();
    const plannedDates = [];

    // 2. Fetch Occasions
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    // 3. Map out the target days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri
      const dateStr = date.toISOString().split('T')[0];

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Weekly Schedule";

      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedDates.push({ date: dateStr, reason });
    }

    // 4. Generate AI briefs for each slot
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const blueprint = STRATEGIC_SEQUENCE[i % STRATEGIC_SEQUENCE.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Repetition Check: Fetch last 20 post topics
      const { data: history } = await supabase.from('posts').select('strategic_topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.strategic_topic).join(', ') || 'None';

      const brief = await brainstormStrategicPost(strategy, blueprint, slot.reason, pastTopics);

      // 5. Create "Ghost Post" Placeholder
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        strategic_topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption,
        metadata: {
          visual_prompt: brief.visual_idea,
          automation_v: '5.0'
        }
      }]);
    }

    return { success: true, count: plannedDates.length };
  } catch (error) {
    console.error('❌ Strategy Planner Error:', error.message);
    throw error;
  }
}

async function brainstormStrategicPost(strategy, blueprint, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Expert Content Strategist
    Client Brand: ${strategy.content_focus} (${strategy.brand_voice})
    Context: ${context}
    Stage: ${blueprint.stage} | Type: ${blueprint.type} | Goal: ${blueprint.goal}

    CRITICAL: Avoid these topics (Already posted): [${history}]

    Output ONLY JSON:
    {
      "topic": "Creative Headline",
      "copy_direction": "What points should the writer hit?",
      "visual_idea": "DETAILED visual brief for a designer (elements, mood, layout)",
      "caption": "A draft engaging caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateMonthlyStrategicPlan };
