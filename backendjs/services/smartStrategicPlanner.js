const supabase = require('../supabaseClient');
const { generateJSON } = require('./aiService');

/**
 * THE AGENCY STRATEGY MODEL
 * Replicates the exact sequence from your spreadsheet image.
 */
const FUNNEL_SEQUENCE = [
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
  console.log(`🧠 [Strategic Planner] Building Plan for Client ${clientId}...`);

  try {
    // 1. Get Client Strategy DNA (Mon, Wed, Fri rules)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client posting rules not found.");

    // 2. Identify Mon, Wed, Fri + Holidays
    const plannedSlots = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch occasions
    const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endStr = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startStr).lte('occasion_date', endStr);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = strategy.posting_days.includes(dayOfWeek) ? "Weekly Strategic Slot" : null;
      const holiday = occasions?.find(o => o.occasion_date === dateStr);
      if (holiday) reason = reason ? `${reason} & ${holiday.title}` : holiday.title;

      if (reason) plannedSlots.push({ date: dateStr, reason });
    }

    // 3. Generate Strategic AI Content for each slot
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const blueprint = FUNNEL_SEQUENCE[i % FUNNEL_SEQUENCE.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      let existingPost = null;
      const { data: existing } = await supabase.from('posts').select('id, is_placeholder').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (existing) {
        if (!existing.is_placeholder) continue;
        existingPost = existing;
      }

      // Check for repetition (Last 20 topics)
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

      console.log(`🤖 AI Generating: ${blueprint.stage} (${blueprint.type}) for ${slot.date}`);

      try {
        const aiContent = await generateBrief(strategy, blueprint, slot.reason, pastTopics);

        const postPayload = {
          client_id: clientId,
          status: 'draft',
          is_placeholder: true,
          scheduled_at: scheduledAt,
          platforms: strategy.platforms,
          funnel_stage: blueprint.stage,
          post_type: blueprint.type,
          topic: aiContent.topic,
          copy_direction: aiContent.copy_direction,
          visual_idea: aiContent.visual_idea,
          content: aiContent.caption,
          metadata: {
            visual_prompt: aiContent.visual_idea,
            goal: blueprint.goal,
            automation_ver: 'SmartScheduler_v5',
            engine: aiContent.engine
          }
        };

        // 4. Create/Update Ghost Post Placeholder for Designers
        if (existingPost) {
          await supabase.from('posts').update(postPayload).eq('id', existingPost.id);
        } else {
          await supabase.from('posts').insert([postPayload]);
        }
      } catch (genErr) {
        console.error(`⚠️ Failed to generate content for ${slot.date}:`, genErr.message);
      }
    }

    return { success: true, count: plannedSlots.length };
  } catch (error) {
    console.error('❌ Planner Failed:', error.message);
    throw error;
  }
}

async function generateBrief(strategy, blueprint, context, history) {
  const prompt = `
    Role: Content Strategist for ${strategy.content_focus} brand.
    Stage: ${blueprint.stage} | Type: ${blueprint.type} | Goal: ${blueprint.goal}
    Context: ${context}

    CRITICAL: topic must be 100% unique. Do NOT repeat: [${history}]

    Return ONLY JSON:
    {
      "topic": "Catchy headline",
      "copy_direction": "Brief for the writer",
      "visual_idea": "Detailed description of the referral image for a designer",
      "caption": "Complete social media caption with hashtags"
    }
  `;

  return await generateJSON(prompt);
}

module.exports = { planStrategicMonth };

module.exports = { planStrategicMonth };
