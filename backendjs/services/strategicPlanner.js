const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const AI_BRAIN_URL = "http://localhost:8000"; // FastAPI URL

// The 12-Post Strategic Funnel from your spreadsheet
const STRATEGIC_SEQUENCE = [
  { stage: 'Awareness', goal: 'Real Learning' },
  { stage: 'Interest', goal: 'Concept Clarity' },
  { stage: 'Awareness', goal: 'Classroom Reality' },
  { stage: 'Value', goal: 'Skill Development' },
  { stage: 'Value', goal: 'Individual Attention' },
  { stage: 'Trust', goal: 'Teaching Style' },
  { stage: 'Awareness', goal: 'Learning Environment' },
  { stage: 'Trust', goal: 'Student Confidence' },
  { stage: 'Trust', goal: 'Student Growth' },
  { stage: 'Consideration', goal: 'Why Choose Us' },
  { stage: 'Conversion', goal: 'Parent Trust' },
  { stage: 'Soft Conversion', goal: 'Admission CTA' }
];

async function planStrategicMonth(clientId, month, year) {
  console.log(`🧠 [Strategic Planner] Building plan for Client: ${clientId}...`);

  try {
    // 1. Get Client Strategy Config
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client strategy not found.");

    // 2. Identify Dates (Mon, Wed, Fri + Special Days)
    const postingDates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch special occasions
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if ([1, 3, 5].includes(dayOfWeek)) reason = "Fixed Schedule";

      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) postingDates.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Content
    for (let i = 0; i < postingDates.length; i++) {
      const slot = postingDates[i];
      const funnelIndex = i % STRATEGIC_SEQUENCE.length;
      const blueprint = STRATEGIC_SEQUENCE[funnelIndex];

      // Fetch history to avoid repetition
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic) || [];

      console.log(`🤖 Brainstorming topic for ${slot.date} (${blueprint.stage})...`);

      const content = await generateStrategicContent(strategy, blueprint, slot.reason, pastTopics);

      // 4. Create Placeholder for Designer
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: `${slot.date}T${strategy.preferred_time}`,
        platforms: strategy.platforms,
        funnel_stage: blueprint.stage,
        topic: content.topic,
        copy_direction: content.copy_direction,
        visual_idea: content.visual_idea,
        content: content.caption,
        metadata: {
          visual_prompt: content.visual_idea,
          automation_type: 'StrategicEngine_v3'
        }
      }]);
    }

    return { success: true, postsPlanned: postingDates.length };
  } catch (err) {
    console.error('❌ Strategic Planner Error:', err.message);
    throw err;
  }
}

async function generateStrategicContent(strategy, blueprint, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    You are a Senior Content Strategist for an agency.
    Industry: ${strategy.content_focus}
    Brand Voice: ${strategy.brand_voice}
    Target Goal: ${blueprint.goal}
    Funnel Stage: ${blueprint.stage}
    Context: ${context}

    CRITICAL: Do NOT repeat these previous topics: ${history.join(', ')}

    Output ONLY JSON:
    {
      "topic": "The title of the post",
      "copy_direction": "Instruction for the designer on what text to put on the image",
      "visual_idea": "A detailed description of the referral image composition",
      "caption": "Draft social media caption with 3 hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { planStrategicMonth };
