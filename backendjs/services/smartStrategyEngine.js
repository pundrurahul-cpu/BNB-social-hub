const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Funnel stages rotation model from your spreadsheet
 */
const FUNNEL_STAGES = [
  'Awareness', 'Interest', 'Value', 'Trust', 'Consideration', 'Conversion', 'Soft Conversion'
];

/**
 * SMART ENGINE: Automatically plans a client's month
 */
async function autoPlanClientMonth(clientId, month, year) {
  console.log(`🧠 [Smart Engine] Building 1-month plan for Client: ${clientId}`);

  try {
    // 1. Get Client Rules (Mon/Wed/Fri)
    const { data: rules } = await supabase.from('client_rules').select('*').eq('client_id', clientId).single();
    if (!rules) throw new Error("Client rules not found. Please set Mon/Wed/Fri in Settings.");

    // 2. Identify Target Dates
    const totalDays = new Date(year, month, 0).getDate();
    const slots = [];

    // Fetch holidays
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('occasions').select('*').gte('event_date', startDate).lte('event_date', endDate);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      let reason = rules.posting_days.includes(dayOfWeek) ? "Regular Schedule" : null;
      const holiday = occasions?.find(o => o.event_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) slots.push({ date: dateStr, reason });
    }

    // 3. Generate Strategy for each slot
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const stage = FUNNEL_STAGES[i % FUNNEL_STAGES.length];
      const type = (i % 3 === 0) ? 'Reel' : 'Static'; // Replicating your spreadsheet pattern
      const scheduledAt = `${slot.date}T${rules.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Brainstorm via AI (Gemini)
      // Note: In Phase 2, we will call FastAPI here for the "Repetition Check"
      const brief = await brainstormStrategicPost(rules, stage, type, slot.reason);

      // 4. Create "Ghost Post" for Designer fulfillment
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: ['facebook', 'instagram', 'linkedin', 'pinterest'],
        funnel_stage: stage,
        post_type: type,
        topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption
      }]);
    }

    return { success: true, count: slots.length };
  } catch (err) {
    console.error('❌ Smart Engine Error:', err.message);
    throw err;
  }
}

async function brainstormStrategicPost(rules, stage, type, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Content Strategist. Industry: ${rules.industry_focus}. Voice: ${rules.brand_voice}.
    Target: Funnel Stage "${stage}" for a ${type} post.
    Context: ${context}.

    Task: Create a unique social media plan.
    Return ONLY JSON:
    {
      "topic": "Catchy Title",
      "copy_direction": "Brief for the writer",
      "visual_idea": "Detailed visual description for a designer to create a referral image",
      "caption": "Post caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { autoPlanClientMonth };
