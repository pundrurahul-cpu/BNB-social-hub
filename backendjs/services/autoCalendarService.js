const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Funnel Stages and Goals sequence from your spreadsheet
 */
const STRATEGY_BLUEPRINT = [
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
 * AUTOMATIC CALENDAR SCHEDULER:
 * Analyzes client rules and builds a 1-month blueprint.
 */
async function generateAutomaticSchedule(clientId, month, year) {
  console.log(`🚀 [Auto Scheduler] Analyzing pattern for Client ${clientId}...`);

  try {
    // 1. Get Client Strategy (Rules for Mon, Wed, Fri)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found. Set them in Settings > Strategy.");

    // 2. Identify all posting dates
    const daysInMonth = new Date(year, month, 0).getDate();
    const targetDates = [];

    // Get special occasions (holidays)
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...

      let reason = null;
      // Fixed Days: Mon (1), Wed (3), Fri (5)
      if ([1, 3, 5].includes(dayOfWeek)) reason = "Weekly Fixed Schedule";

      // Check for Special Occasion (can add a post or override)
      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) targetDates.push({ date: dateStr, reason });
    }

    // 3. Generate Content Briefs for each date
    console.log(`🤖 [AI Brain] Brainstorming ${targetDates.length} unique posts...`);

    for (let i = 0; i < targetDates.length; i++) {
      const slot = targetDates[i];
      const blueprint = STRATEGY_BLUEPRINT[i % STRATEGY_BLUEPRINT.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Check if already planned
      const { data: existing } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (existing) continue;

      // Call AI to generate unique Topic and Visual Idea
      const aiResponse = await generateStrategicIdea(strategy, blueprint, slot.reason);

      // 4. Insert Placeholder into Calendar
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms || ['facebook', 'instagram'],
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: aiResponse.topic,
        copy_direction: aiResponse.copy_direction,
        visual_idea: aiResponse.visual_idea,
        content: aiResponse.caption,
        metadata: {
          visual_prompt: aiResponse.visual_idea,
          goal: blueprint.goal,
          is_auto_generated: true
        }
      }]);
    }

    return { success: true, count: targetDates.length };
  } catch (err) {
    console.error('❌ [Auto Scheduler] Failed:', err.message);
    throw err;
  }
}

async function generateStrategicIdea(strategy, blueprint, context) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Content Strategist for an agency.
    Brand: ${strategy.content_focus} (Voice: ${strategy.brand_voice})
    Context: ${context}
    Funnel Stage: ${blueprint.stage}
    Goal: ${blueprint.goal}
    Post Type: ${blueprint.type}

    Task: Create a unique post brief.
    1. Topic: Fresh and engaging.
    2. Copy Direction: Core message to hit.
    3. Visual Idea: Detailed referral image description for a designer.
    4. Caption: Complete post text.

    Return ONLY JSON:
    {
      "topic": "...",
      "copy_direction": "...",
      "visual_idea": "...",
      "caption": "..."
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateAutomaticSchedule };
