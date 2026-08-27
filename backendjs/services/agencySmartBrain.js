const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const FASTAPI_URL = "http://localhost:8001";

/**
 * Funnel Logic Sequence from your spreadsheet
 */
const FUNNEL_STAGES = [
  'Awareness', 'Interest', 'Awareness', 'Value', 'Value', 'Trust',
  'Awareness', 'Trust', 'Trust', 'Consideration', 'Conversion', 'Soft Conversion'
];

async function planMonthlyStrategy(clientId, month, year) {
  console.log(`🧠 [Agency Brain] Planning month for Client: ${clientId}...`);

  try {
    // 1. Get Client Config
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found.");

    // 2. Identify Mon, Wed, Fri + Holidays
    const daysInMonth = new Date(year, month, 0).getDate();
    const plannedSlots = [];

    // Fetch special occasions
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Standard Agency Schedule" : null;
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic AI Content for each slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const stage = FUNNEL_STAGES[i % FUNNEL_STAGES.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Brainstorm via Gemini
      const brief = await generateAIBrief(strategy, stage, slot.reason);

      // Call FastAPI for the Referral Image
      let referralUrl = null;
      try {
        const imageRes = await axios.post(`${FASTAPI_URL}/generate-brief`, {
          topic: brief.topic,
          visual_idea: brief.visual_idea,
          client_id: clientId
        });
        referralUrl = imageRes.data.referral_url;
      } catch (e) { console.warn("Referral image gen skipped."); }

      // 4. Save "Ghost Post" for Designer fulfillment
      await supabase.from('posts').insert([{
        client_id: clientId,
        post_no: i + 1,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: stage,
        topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption,
        referral_image_url: referralUrl
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Brain Failed:', err.message);
    throw err;
  }
}

async function generateAIBrief(strategy, stage, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Get history for uniqueness check
  const { data: history } = await supabase.from('posts').select('topic').eq('client_id', strategy.client_id).limit(15);
  const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

  const prompt = `
    Funnel Stage: ${stage} | Client focus: ${strategy.industry_focus} | Context: ${context}
    CRITICAL: Ensure the topic is 100% unique. Do NOT repeat these: [${pastTopics}]
    Return ONLY JSON: { "topic": "...", "copy_direction": "...", "visual_idea": "...", "caption": "..." }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { planMonthlyStrategy };
