const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * STRATEGY BLUEPRINT: Based on your spreadsheet model
 * Pattern: Static, Static, Reel rotation
 */
const BLUEPRINT = [
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

async function generateMonthlyAutoSchedule(clientId, month, year) {
  console.log(`🤖 [Strategic Engine v4] Planning month for Client: ${clientId}`);

  try {
    // 1. Get Client Config (Mon, Wed, Fri rules)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client Strategy not found. Please set days in Settings.");

    // 2. Map target dates (Mon, Wed, Fri + Occasions)
    const plannedDates = [];
    const totalDays = new Date(year, month, 0).getDate();

    // Fetch special occasions/holidays
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Regular Schedule";

      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedDates.push({ date: dateStr, reason });
    }

    // 3. Brainstorm Content for each slot (Rotating Funnel Stages)
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const task = BLUEPRINT[i % BLUEPRINT.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Fetch history to ensure 0% repetition
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

      console.log(`💡 [AI] Brainstorming ${task.stage} (${task.type}) for ${slot.date}...`);
      const content = await brainstormStrategicContent(strategy, task, slot.reason, pastTopics);

      // 4. Create "Ghost Post" for Designer fulfillment
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: task.stage,
        post_type: task.type,
        strategic_goal: task.goal,
        topic: content.topic,
        copy_direction: content.copy_direction,
        visual_idea: content.visual_idea,
        content: content.caption,
        metadata: {
          visual_prompt: content.visual_idea, // Referral image description
          automation_tag: 'Strategic_V4'
        }
      }]);
    }

    return { success: true, postsPlanned: plannedDates.length };
  } catch (err) {
    console.error('❌ Strategic Engine Error:', err.message);
    throw err;
  }
}

async function brainstormStrategicContent(strategy, task, context, pastTopics) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Content Strategist for ${strategy.content_focus} brand.
    Voice: ${strategy.brand_voice}
    Funnel Stage: ${task.stage} (Goal: ${task.goal})
    Type: ${task.type}
    Context: ${context}

    CRITICAL: Do NOT repeat these topics: [${pastTopics}]

    Return ONLY JSON:
    {
      "topic": "Post Title",
      "copy_direction": "Brief for the writer",
      "visual_idea": "Detailed visual description for referral image",
      "caption": "Complete post text with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateMonthlyAutoSchedule };
