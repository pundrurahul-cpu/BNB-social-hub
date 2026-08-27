const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// The Funnel Stages as seen in your spreadsheet
const STRATEGIC_FUNNEL = [
  'Awareness', 'Interest', 'Value', 'Trust', 'Consideration', 'Conversion', 'Soft Conversion'
];

/**
 * SMART BRAIN: Analyzes previous month and builds the next month
 */
async function autoPlanMonth(clientId, targetMonth, targetYear) {
  console.log(`🧠 [Smart Brain] Planning strategy for Client ${clientId}...`);

  try {
    // 1. Get Client Strategic Profile
    const { data: profile } = await supabase.from('client_profiles').select('*').eq('client_id', clientId).single();
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();

    if (!strategy) throw new Error("Client Strategy not found.");

    // 2. Identify Posting Days (e.g., Mon, Wed, Fri)
    const postingDays = strategy.posting_days || [1, 3, 5];
    const preferredTime = strategy.preferred_time || "10:00:00";

    // 3. Fetch Special Occasions (Holidays)
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);
    const { data: occasions } = await supabase.from('special_occasions')
      .select('*')
      .gte('occasion_date', startDate.toISOString())
      .lte('occasion_date', endDate.toISOString());

    // 4. Generate the Calendar Grid
    const schedule = [];
    for (let d = 1; d <= endDate.getDate(); d++) {
      const currentDate = new Date(targetYear, targetMonth - 1, d);
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      let isPostingDay = postingDays.includes(dayOfWeek);
      const occasion = occasions?.find(o => o.occasion_date === dateStr);

      if (isPostingDay || occasion) {
        schedule.push({
          date: dateStr,
          reason: occasion ? occasion.title : "Weekly Schedule",
          isOccasion: !!occasion
        });
      }
    }

    // 5. Brainstorm Content (Rotating Funnel Stages)
    console.log(`🤖 [AI] Brainstorming ${schedule.length} unique topics...`);

    for (let i = 0; i < schedule.length; i++) {
      const slot = schedule[i];
      const stage = STRATEGIC_FUNNEL[i % STRATEGIC_FUNNEL.length];

      // Check for repetition in history
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

      const content = await generateStrategicPost(strategy, profile, stage, slot.reason, pastTopics);

      // 6. Create the "Ghost Post" for Designers
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: `${slot.date}T${preferredTime}`,
        platforms: strategy.platforms,
        funnel_stage: stage,
        topic: content.topic,
        copy_direction: content.copy_direction,
        visual_idea: content.visual_idea,
        content: content.draft_caption,
        metadata: {
          visual_prompt: content.visual_idea,
          ai_version: 'StrategyEngine-v1'
        }
      }]);
    }

    return { success: true, count: schedule.length };
  } catch (error) {
    console.error('Brain Error:', error.message);
    throw error;
  }
}

async function generateStrategicPost(strategy, profile, stage, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Senior Social Media Strategist
    Client Focus: ${strategy.content_focus}
    Brand Voice: ${strategy.brand_voice}
    Target Audience: ${profile?.target_audience || 'General Social Media Users'}

    Current Task: Create a post plan for the "${stage}" funnel stage.
    Context: ${context}

    CRITICAL: Do NOT repeat these topics: [${history}]

    Output ONLY valid JSON:
    {
      "topic": "Catchy post title",
      "copy_direction": "Instruction for the designer on what text should be on the image",
      "visual_idea": "A referral image description for a designer. Be specific about colors and layout.",
      "draft_caption": "Engaging caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  try {
    const text = result.response.text();
    const cleanJson = text.match(/\{[\s\S]*\}/)[0];
    return JSON.parse(cleanJson);
  } catch (e) {
    return { topic: `Update: ${context}`, copy_direction: "General branded info", visual_idea: "High quality photo of coffee", draft_caption: "Exciting things coming!" };
  }
}

module.exports = { autoPlanMonth };
