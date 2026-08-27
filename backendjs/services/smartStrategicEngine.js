const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios'); // To talk to FastAPI

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const AI_BRAIN_URL = "http://localhost:8001"; // Your FastAPI URL

// Funnel stages rotation model from your spreadsheet
const FUNNEL_STAGES = [
  'Awareness', 'Interest', 'Value', 'Trust', 'Consideration', 'Conversion', 'Soft Conversion'
];

/**
 * AUTOMATED PLANNER:
 * 1. Identifies MWF + Holidays.
 * 2. Ensures 0% Content Repetition.
 * 3. Generates Visual Briefs for Designers.
 */
async function buildMonthlyStrategicPlan(clientId, month, year) {
  console.log(`🧠 [Smart Brain] Planning strategy for Client: ${clientId} (${month}/${year})`);

  try {
    // 1. Get Client Config (Mon/Wed/Fri rules)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found in Settings.");

    // 2. Map out the mandatory dates
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Fetch special occasions
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    const slots = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Weekly Schedule" : null;
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) slots.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Briefs for each slot
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const stage = FUNNEL_STAGES[i % FUNNEL_STAGES.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Repetition Check: Fetch last 20 topics from history
      const { data: history } = await supabase.from('posts').select('strategic_topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.strategic_topic).filter(Boolean).join(', ') || 'None';

      console.log(`🤖 AI Brainstorming: ${stage} post for ${slot.date}`);
      const aiResponse = await generateStrategicBrief(strategy, stage, slot.reason, pastTopics);

      // --- OPTIONAL: Call FastAPI here for the Referral Image ---
      let referralUrl = null;
      try {
        const imageRes = await axios.post(`${AI_BRAIN_URL}/generate-referral`, {
          prompt: aiResponse.visual_idea,
          client_id: clientId
        });
        referralUrl = imageRes.data.url;
      } catch (e) { console.warn("FastAPI offline, referral image skipped."); }

      // 4. Create "Ghost Post" for Designer Fulfillment
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
        referral_image_url: referralUrl,
        content: aiResponse.caption,
        metadata: {
          visual_prompt: aiResponse.visual_idea,
          automation_type: 'StrategicEngine_v1'
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
    Role: Senior Marketing Strategist. Brand: ${strategy.content_focus}. Funnel Stage: ${stage}. Context: ${context}.
    CRITICAL: Ensure the topic is 100% unique. Do NOT repeat these topics: [${pastTopics}].
    Return ONLY JSON:
    {
      "topic": "Creative headline",
      "copy_direction": "Instruction for the designer on what message to emphasize",
      "visual_idea": "DETAILED composition for a referral image moodboard",
      "caption": "Post caption with hashtags"
    }
  `;
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { buildMonthlyStrategicPlan };
