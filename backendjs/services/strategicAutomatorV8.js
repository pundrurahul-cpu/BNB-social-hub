const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const AI_BRAIN_URL = "http://localhost:8001"; // FastAPI Endpoint

/**
 * THE 12-POST AGENCY MODEL
 * Replicates the exact sequence from your spreadsheet image.
 */
const FUNNEL_MODEL = [
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

async function automateClientSchedule(clientId, month, year) {
  console.log(`🧠 [Strategic Engine] Planning month for Client: ${clientId}...`);

  try {
    // 1. Get Client Strategy DNA
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found. Set days in Settings first.");

    // 2. Map target dates (Mon, Wed, Fri + Holidays)
    const plannedSlots = [];
    const totalDays = new Date(year, month, 0).getDate();

    // Fetch special occasions
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Strategic Schedule" : null;
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Process Content for each Slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const task = FUNNEL_MODEL[i % FUNNEL_MODEL.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Skip if slot already filled
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Uniqueness Check: Fetch last 20 topics to ensure 0% repetition
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).filter(Boolean) || [];

      console.log(`🤖 AI Processing: ${task.stage} (${task.type}) for ${slot.date}`);

      // Brainstorm via Gemini
      const aiContent = await brainstormStrategicPost(strategy, task, slot.reason, pastTopics);

      // 4. Create Ghost Post (Fulfillment Placeholder)
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: task.stage,
        post_type: task.type,
        topic: aiContent.topic,
        copy_direction: aiContent.copy_direction,
        visual_idea: aiContent.visual_idea,
        content: aiContent.caption,
        metadata: {
          visual_prompt: aiContent.visual_idea, // Referral brief for designer
          automation_id: 'Strategic_V8'
        }
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Strategic Engine Error:', err.message);
    throw err;
  }
}

async function brainstormStrategicPost(strategy, task, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Content Strategist for ${strategy.content_focus} brand.
    Voice: ${strategy.brand_voice}
    Stage: ${task.stage} | Post Type: ${task.type} | Slot: ${context}

    CRITICAL: topic must be 100% unique. Do NOT repeat these topics: [${history.join(', ')}]

    Return ONLY JSON:
    {
      "topic": "Catchy headline",
      "copy_direction": "Brief for the designer/writer",
      "visual_idea": "Detailed visual brief for a designer to create a referral image/graphic",
      "caption": "Complete post caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { automateClientSchedule };
