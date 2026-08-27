const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Funnel Logic Sequence (Based on your spreadsheet model)
 */
const STRATEGIC_FUNNEL = [
  'Awareness', 'Interest', 'Awareness', 'Value', 'Value', 'Trust',
  'Awareness', 'Trust', 'Trust', 'Consideration', 'Conversion', 'Soft Conversion'
];

/**
 * AUTOMATIC SCHEDULER:
 * Plans a full month of strategic placeholders based on the spreadsheet model.
 */
async function buildMonthlyPlan(clientId, month, year) {
  console.log(`🧠 [Auto-Scheduler] Planning month for Client: ${clientId}...`);

  try {
    // 1. Get Client Strategy DNA (Mon, Wed, Fri rules)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client Strategy not found. Set posting days in settings.");

    // 2. Identify Dates (Mon, Wed, Fri + Special Days)
    const plannedDates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch holidays/occasions
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Fixed Weekly Post";

      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedDates.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Briefs for each date
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const funnelStage = STRATEGIC_FUNNEL[i % STRATEGIC_FUNNEL.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Call AI to generate unique Topic and Visual Brief
      const brief = await generateAIBrief(strategy, funnelStage, slot.reason);

      // 4. Create "Ghost Post" for Designer fulfillment
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms || ['facebook', 'instagram'],
        funnel_stage: funnelStage,
        topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption,
        metadata: {
          visual_prompt: brief.visual_idea,
          automation_version: '4.0_Smart'
        }
      }]);
    }

    return { success: true, count: plannedDates.length };
  } catch (err) {
    console.error('❌ Auto-Scheduler Failed:', err.message);
    throw err;
  }
}

async function generateAIBrief(strategy, stage, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Fetch previous topics to ensure 0% repetition
  const { data: history } = await supabase.from('posts').select('topic').eq('client_id', strategy.client_id).limit(20);
  const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

  const prompt = `
    Role: Content Strategist for ${strategy.content_focus} brand.
    Voice: ${strategy.brand_voice}
    Stage: ${stage}
    Context: ${context}

    CRITICAL: Do NOT repeat these topics: [${pastTopics}]

    Return ONLY JSON:
    {
      "topic": "Creative Headline",
      "copy_direction": "Brief for the designer/writer",
      "visual_idea": "DETAILED visual description for a referral image",
      "caption": "Complete post caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { buildMonthlyPlan };
