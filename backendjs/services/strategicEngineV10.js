const supabase = require('../supabaseClient');
const { generateJSON } = require('./aiService');

/**
 * Funnel stages rotation model from your spreadsheet
 */
const STRATEGY_MODEL = [
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
 * AUTOMATED PLANNER:
 * 1. Analyzes client posting days (Mon, Wed, Fri).
 * 2. Injects Special Occasions (Holidays).
 * 3. Calls Cloud AI to ensure 0% repetition and high-quality creative.
 * 4. Generates a Referral Image brief for the Designer.
 */
async function buildSmartAgencyPlan(clientId, month, year) {
  console.log(`🧠 [Strategic Engine V10] Building plan for Client: ${clientId}...`);

  try {
    // 1. Get Client Profile & Rules
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client Strategy not found.");

    // 2. Identify Target Dates
    const totalDays = new Date(year, month, 0).getDate();
    const targetSlots = [];

    // Fetch holidays
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Weekly Strategic Post";
      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) targetSlots.push({ date: dateStr, reason });
    }

    // 3. Process Content for each Slot
    for (let i = 0; i < targetSlots.length; i++) {
      const slot = targetSlots[i];
      const task = STRATEGY_MODEL[i % STRATEGY_MODEL.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      let existingPost = null;
      const { data: exists } = await supabase.from('posts').select('id, is_placeholder').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) {
        if (!exists.is_placeholder) continue;
        existingPost = exists;
      }

      // 4. Repetition Check & AI Brainstorming
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).filter(Boolean) || [];

      console.log(`🤖 AI Processing: ${task.stage} for ${slot.date}`);

      try {
        const content = await generateUniqueBrief(strategy, task, slot.reason, pastTopics);

        const postPayload = {
          client_id: clientId,
          status: 'draft',
          is_placeholder: true,
          scheduled_at: scheduledAt,
          platforms: strategy.platforms,
          funnel_stage: task.stage,
          post_type: task.type,
          topic: content.topic,
          copy_direction: content.copy_direction,
          visual_idea: content.visual_idea,
          content: content.caption,
          metadata: {
            visual_prompt: content.visual_idea, // Description for designer
            automation_id: 'Strategic_V10',
            engine: content.engine
          }
        };

        // 5. Create/Update Ghost Post (Fulfillment Placeholder)
        if (existingPost) {
          await supabase.from('posts').update(postPayload).eq('id', existingPost.id);
        } else {
          await supabase.from('posts').insert([postPayload]);
        }
      } catch (genErr) {
        console.error(`⚠️ Content generation failed for ${slot.date}:`, genErr.message);
      }
    }

    return { success: true, count: targetSlots.length };
  } catch (err) {
    console.error('❌ Strategic Engine Error:', err.message);
    throw err;
  }
}

async function generateUniqueBrief(strategy, task, context, history) {
  const prompt = `
    Role: Marketing Strategist. Brand: ${strategy.content_focus} (${strategy.brand_voice}).
    Stage: ${task.stage} | Post Type: ${task.type} | context: ${context}

    CRITICAL: Ensure the topic is unique. Do NOT repeat these topics: [${history.join(', ')}]

    Output ONLY valid JSON:
    {
      "topic": "Catchy headline",
      "copy_direction": "Instruction for the designer/writer",
      "visual_idea": "A detailed brief for a designer to create a referral image/graphic",
      "caption": "Post caption with hashtags"
    }
  `;

  return await generateJSON(prompt);
}

module.exports = { buildSmartAgencyPlan };

module.exports = { buildSmartAgencyPlan };
