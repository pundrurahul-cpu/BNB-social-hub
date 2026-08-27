const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Strategic rotation sequence from your spreadsheet
const FUNNEL_STAGES = [
  'Awareness', 'Interest', 'Value', 'Trust', 'Consideration', 'Conversion', 'Soft Conversion'
];

/**
 * AUTOMATED PLANNER: Builds a 1-month strategic calendar
 */
async function buildMonthlyStrategicPlan(clientId, month, year) {
  console.log(`🧠 [Agency Brain] Planning for Client: ${clientId} (${month}/${year})`);

  try {
    // 1. Get Client Posting Rules (Mon, Wed, Fri)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules (days) not found in Settings.");

    // 2. Fetch Special Occasions (Holidays)
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    // 3. Map out the mandatory dates
    const slots = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Standard Agency Schedule" : null;
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) slots.push({ date: dateStr, reason });
    }

    // 4. Generate Strategic Briefs for each slot
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const stage = FUNNEL_STAGES[i % FUNNEL_STAGES.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Repetition Check: Fetch last 20 topics
      const { data: history } = await supabase.from('posts').select('strategic_topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.strategic_topic).filter(Boolean).join(', ') || 'None';

      console.log(`🤖 AI Brainstorming: ${stage} post for ${slot.date}`);
      const aiResponse = await generateStrategicBrief(strategy, stage, slot.reason, pastTopics);

      // 5. Create "Ghost Post" for Designer Fulfillment
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: stage,
        strategic_topic: aiResponse.topic,
        copy_direction: aiResponse.copy_direction,
        visual_idea: aiResponse.visual_idea,
        content: aiResponse.caption, // AI-generated draft caption
        metadata: {
          visual_prompt: aiResponse.visual_idea, // For Designer/Referral Image
          generation_date: new Date().toISOString()
        }
      }]);
    }

    return { success: true, count: slots.length };
  } catch (error) {
    console.error('❌ Strategy Engine Error:', error.message);
    throw error;
  }
}

async function generateStrategicBrief(strategy, stage, context, pastTopics) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
    Role: Senior Social Media Strategist for ${strategy.content_focus} brand.
    Voice: ${strategy.brand_voice}
    Funnel Stage: ${stage}
    Context: ${context}

    CRITICAL: Topic must be 100% unique. Do NOT repeat these: [${pastTopics}]

    Return ONLY JSON:
    {
      "topic": "Catchy headline",
      "copy_direction": "Brief for the writer on what points to hit",
      "visual_idea": "DETAILED composition for a referral image (mood, elements, layout)",
      "caption": "Complete social media caption with 5 hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { buildMonthlyStrategicPlan };
