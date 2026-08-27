const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Funnel Rotation based on your spreadsheet model
const FUNNEL_STAGES = [
  'Awareness', 'Interest', 'Awareness', 'Value', 'Value', 'Trust', 'Awareness', 'Trust', 'Trust', 'Consideration', 'Conversion', 'Soft Conversion'
];

/**
 * SMART PLANNER: Generates a strategic monthly calendar
 */
async function generateSmartMonthlyPlan(clientId, month, year) {
  console.log(`🧠 [Smart Planner] Building strategy for Client: ${clientId} for ${month}/${year}`);

  try {
    // 1. Get Client Strategy Config
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client strategy (posting days) not found.");

    // 2. Fetch Holidays for the month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: holidays } = await supabase.from('holidays').select('*').gte('holiday_date', startDate).lte('holiday_date', endDate);

    // 3. Identify all slots (Mon, Wed, Fri + Holidays)
    const plannedSlots = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
      const dateStr = date.toISOString().split('T')[0];

      let isMandatory = [1, 3, 5].includes(dayOfWeek); // Mon, Wed, Fri
      const holiday = holidays?.find(h => h.holiday_date === dateStr);

      if (isMandatory || holiday) {
        plannedSlots.push({
          date: dateStr,
          reason: holiday ? holiday.title : "Standard Schedule"
        });
      }
    }

    // 4. Generate Content for each slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const stage = FUNNEL_STAGES[i % FUNNEL_STAGES.length];

      // Prevent double planning if a post already exists
      const { data: existing } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', `${slot.date}T${strategy.preferred_time}`).maybeSingle();
      if (existing) continue;

      // AI Brainstorming
      console.log(`🤖 [AI] Brainstorming ${stage} content for ${slot.date}...`);
      const strategyData = await brainstormContent(strategy, stage, slot.reason);

      // 5. Create "Ghost Post" (Placeholder for designer)
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: `${slot.date}T${strategy.preferred_time}`,
        platforms: strategy.platforms,
        funnel_stage: stage,
        topic: strategyData.topic,
        copy_direction: strategyData.copy_direction,
        visual_idea: strategyData.visual_idea,
        content: strategyData.caption,
        metadata: {
          visual_prompt: strategyData.visual_idea, // For future referral image gen
          is_auto_strategy: true
        }
      }]);
    }

    return { success: true, totalPosts: plannedSlots.length };
  } catch (error) {
    console.error('❌ Smart Planner Error:', error.message);
    throw error;
  }
}

async function brainstormContent(strategy, stage, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // We feed Gemini the client's focus and the funnel stage
  const prompt = `
    You are a Strategic Social Media Manager for a high-end agency.
    Client Industry: ${strategy.content_focus}
    Brand Voice: ${strategy.brand_voice}
    Funnel Stage: ${stage}
    Context: ${context}

    TASK: Create a unique post plan. Output ONLY JSON:
    {
      "topic": "Catchy headline for the post",
      "copy_direction": "Instruction for the designer on what text/message to emphasize",
      "visual_idea": "DETAILED visual description for a designer (colors, mood, elements)",
      "caption": "A draft engaging caption with 5 relevant hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  try {
    const text = result.response.text();
    return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
  } catch (e) {
    return { topic: "New Update", copy_direction: "Branded content", visual_idea: "Graphic with logo", caption: "Coming soon!" };
  }
}

module.exports = { generateSmartMonthlyPlan };
