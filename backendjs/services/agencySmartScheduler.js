const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const FASTAPI_URL = "http://localhost:8000"; // Your FastAPI worker URL

// The 12-Post Strategic Rotation from your image
const STRATEGIC_FUNNEL = [
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

async function planStrategicMonth(clientId, month, year) {
  console.log(`🧠 [Agency Brain] Auto-Planning for ${clientId}...`);

  try {
    // 1. Get Client Strategy Rules
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found.");

    // 2. Identify Mon, Wed, Fri + Holidays
    const plannedDates = [];
    const totalDays = new Date(year, month, 0).getDate();

    // Fetch special occasions
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Weekly Fixed Day";
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) plannedDates.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Content for each date
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const blueprint = STRATEGIC_FUNNEL[i % STRATEGIC_FUNNEL.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Use AI to generate Unique Topic & Visual Idea
      const aiResponse = await generateStrategicBrief(strategy, blueprint, slot.reason);

      // --- NEW: Call FastAPI for Referral Image ---
      let referralUrl = null;
      try {
        const imageRes = await axios.post(`${FASTAPI_URL}/generate-referral`, {
          topic: aiResponse.topic,
          visual_idea: aiResponse.visual_idea,
          client_focus: strategy.content_focus
        });
        referralUrl = imageRes.data.image_url;
      } catch (e) { console.warn("Referral image gen failed, skipping..."); }

      // 4. Create Placeholder for Designer
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: aiResponse.topic,
        copy_direction: aiResponse.copy_direction,
        visual_idea: aiResponse.visual_idea,
        referral_image_url: referralUrl,
        content: aiResponse.caption
      }]);
    }

    return { success: true, count: plannedDates.length };
  } catch (error) {
    console.error('Brain Error:', error.message);
    throw error;
  }
}

async function generateStrategicBrief(strategy, blueprint, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Get history for uniqueness check
  const { data: history } = await supabase.from('posts').select('topic').eq('client_id', strategy.client_id).limit(20);
  const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

  const prompt = `
    Funnel Stage: ${blueprint.stage} | Goal: ${blueprint.goal} | Type: ${blueprint.type}
    Client Industry: ${strategy.content_focus} | Context: ${context}

    CRITICAL: Ensure the topic is 100% unique. Do NOT repeat these: [${pastTopics}]

    Return ONLY JSON:
    {
      "topic": "Creative Headline",
      "copy_direction": "Instruction for the designer",
      "visual_idea": "Description of the referral image layout",
      "caption": "Post caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { planStrategicMonth };
