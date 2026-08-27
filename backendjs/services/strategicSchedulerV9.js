const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * THE AGENCY MODEL: Replicates the 12-post sequence from your spreadsheet.
 */
const FUNNEL_BLUEPRINT = [
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

async function automateStrategicCalendar(clientId, month, year) {
  console.log(`🧠 [Strategic Scheduler] Building plan for Client: ${clientId}...`);

  try {
    // 1. Get Client Rules
    const { data: rules } = await supabase.from('client_rules').select('*').eq('client_id', clientId).single();
    if (!rules) throw new Error("Client Rules not found. Please set Mon, Wed, Fri in Settings.");

    // 2. Identify Dates (Fixed Days + Holidays)
    const plannedSlots = [];
    const totalDays = new Date(year, month, 0).getDate();

    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: holidays } = await supabase.from('holidays').select('*').gte('date', startDate).lte('date', endDate);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      let reason = rules.fixed_days.includes(dayOfWeek) ? "Strategic Schedule" : null;
      const holiday = holidays?.find(h => h.date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic Content for each Slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const blueprint = FUNNEL_BLUEPRINT[i % FUNNEL_BLUEPRINT.length];
      const scheduledAt = `${slot.date}T${rules.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Uniqueness Check: Fetch history
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

      const aiBrief = await generateStrategicBrief(rules, blueprint, slot.reason, pastTopics);

      // 4. Create Ghost Post Placeholder
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: ['facebook', 'instagram', 'linkedin', 'pinterest'],
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: aiBrief.topic,
        copy_direction: aiBrief.copy_direction,
        visual_idea: aiBrief.visual_idea,
        content: aiBrief.caption,
        metadata: {
            goal: blueprint.goal,
            is_auto_strategy: true
        }
      }]);
    }

    return { success: true, count: plannedSlots.length };
  } catch (err) {
    console.error('❌ Strategic Scheduler Failed:', err.message);
    throw err;
  }
}

async function generateStrategicBrief(rules, blueprint, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Content Strategist for ${rules.industry_focus}. Brand Voice: ${rules.brand_voice}.
    Context: ${context} | Stage: ${blueprint.stage} | Type: ${blueprint.type} | Goal: ${blueprint.goal}

    CRITICAL: Ensure the topic is 100% unique. Do NOT repeat: [${history}]

    Return ONLY JSON:
    {
      "topic": "Catchy Headline",
      "copy_direction": "What text should be on the image?",
      "visual_idea": "Detailed visual description for a designer referral",
      "caption": "Post text with 5 hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { automateStrategicCalendar };
