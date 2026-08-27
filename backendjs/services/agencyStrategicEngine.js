const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * THE AGENCY STRATEGY MODEL
 * Replicates the exact sequence from your spreadsheet image.
 */
const STRATEGIC_BLUEPRINT = [
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

async function automateClientMonth(clientId, month, year) {
  console.log(`🧠 [Agency Engine] Planning Strategy for Client: ${clientId}...`);

  try {
    // 1. Get Client DNA (Days, Voice, focus)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found.");

    // 2. Identify Dates (Mon, Wed, Fri + Holidays)
    const daysInMonth = new Date(year, month, 0).getDate();
    const targetSlots = [];

    // Fetch holidays
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Weekly Strategic Post";
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) targetSlots.push({ date: dateStr, reason });
    }

    // 3. Generate AI Content for each slot
    for (let i = 0; i < targetSlots.length; i++) {
      const slot = targetSlots[i];
      const task = STRATEGIC_BLUEPRINT[i % STRATEGIC_BLUEPRINT.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Collision Check
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Uniqueness Check: Fetch last 20 topics
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

      const brief = await generateAIBrief(strategy, task, slot.reason, pastTopics);

      // 4. Create Ghost Post Placeholder
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms,
        funnel_stage: task.stage,
        post_type: task.type,
        topic: brief.topic,
        copy_direction: brief.copy_direction,
        visual_idea: brief.visual_idea,
        content: brief.caption,
        metadata: {
          visual_prompt: brief.visual_idea,
          automation_version: 'StrategicV6'
        }
      }]);
    }

    return { success: true, count: targetSlots.length };
  } catch (err) {
    console.error('❌ Agency Engine Error:', err.message);
    throw err;
  }
}

async function generateAIBrief(strategy, task, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
    Role: Senior Marketing Strategist. Brand: ${strategy.content_focus} (${strategy.brand_voice}).
    Stage: ${task.stage} | Post Type: ${task.type} | Slot: ${context}

    CRITICAL: topic must be 100% unique. Previous topics: [${history}]

    Return ONLY JSON:
    {
      "topic": "...",
      "copy_direction": "Brief for the writer/designer",
      "visual_idea": "Detailed visual brief for a designer (elements, colors, layout)",
      "caption": "Draft post caption"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { automateClientMonth };
