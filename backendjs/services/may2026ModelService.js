const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * THE MAY 2026 STRATEGIC FUNNEL SEQUENCE
 * This replicates the exact rotation from your spreadsheet.
 */
const STRATEGIC_SEQUENCE = [
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

/**
 * AUTOMATED SCHEDULER:
 * Plans a full month of strategic placeholders based on the spreadsheet model.
 */
async function generateMayModelSchedule(clientId, month, year) {
  console.log(`🧠 [May Model] Planning month for Client: ${clientId}...`);

  try {
    // 1. Get Client DNA (Rules for Mon, Wed, Fri)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client Strategy not found. Please set days in Settings.");

    // 2. Identify all Mandatory Dates (Mon, Wed, Fri)
    const plannedDates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch special occasions for the month
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Mandatory Weekly Post";

      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedDates.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Briefs for each date
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const blueprint = STRATEGIC_SEQUENCE[i % STRATEGIC_SEQUENCE.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Get history to ensure uniqueness
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

      console.log(`🤖 AI Planning: ${blueprint.stage} (${blueprint.type}) for ${slot.date}`);

      const aiResponse = await generateStrategicBrief(strategy, blueprint, slot.reason, pastTopics);

      // 4. Create Placeholder for Designer
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms || ['facebook', 'instagram', 'linkedin'],
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: aiResponse.topic,
        copy_direction: aiResponse.copy_direction,
        visual_idea: aiResponse.visual_idea,
        content: aiResponse.caption,
        metadata: {
          visual_prompt: aiResponse.visual_idea,
          goal: blueprint.goal,
          automation_model: 'May2026_Strategic'
        }
      }]);
    }

    return { success: true, count: plannedDates.length };
  } catch (error) {
    console.error('Model Planning Error:', error.message);
    throw error;
  }
}

async function generateStrategicBrief(strategy, blueprint, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    You are an Expert Agency Content Strategist.
    Client: ${strategy.content_focus}
    Brand Voice: ${strategy.brand_voice}
    Funnel Stage: ${blueprint.stage}
    Strategic Goal: ${blueprint.goal}
    Post Type: ${blueprint.type}
    Context: ${context}

    CRITICAL: Ensure the topic is unique. Do NOT repeat these topics: [${history}]

    Return ONLY JSON:
    {
      "topic": "Catchy post title",
      "copy_direction": "Brief for the writer on what the core message should be",
      "visual_idea": "A detailed visual brief for a graphic designer. Describe elements, mood, and layout.",
      "caption": "Complete post caption with relevant hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateMayModelSchedule };
