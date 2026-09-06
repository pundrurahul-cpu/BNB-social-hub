const supabase = require('../supabaseClient');
const { generateJSON } = require('./aiService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

/**
 * STRATEGIC BRAIN V1000.11 - MARKET EXPERT EDITION
 * Senior Performance Marketing Logic | Aligned with BNB Spreadsheet Components.
 */
async function buildMonthlyStrategy(clientId, month, year) {
  console.log(`\n🧠 [V1000 Market Expert] Architecting high-converting roadmap for Client: ${clientId}`);

  try {
    const { data: strategy, error: stratError } = await supabase
      .from('client_strategies')
      .select('*')
      .eq('client_id', String(clientId))
      .maybeSingle();

    if (stratError) throw stratError;
    if (!strategy) throw new Error("Strategy config not found. Please save Settings first.");

    const daysInMonth = new Date(year, month, 0).getDate();
    const plannedDates = [];
    const mm = String(month).padStart(2, '0');

    const { data: occasions } = await supabase.from('special_occasions').select('*')
      .gte('occasion_date', `${year}-${mm}-01`)
      .lte('occasion_date', `${year}-${mm}-${daysInMonth}`);

    // EXPERT FUNNEL LOGIC
    const FUNNEL_BLUEPRINT = [
      { stage: 'Awareness', goal: 'Pattern Interrupt & Brand Recall', framework: 'Curiosity Loop' },
      { stage: 'Interest', goal: 'Concept Clarity & Logic-Based Value', framework: 'PAS (Problem/Agitate/Solve)' },
      { stage: 'Trust', goal: 'Social Proof & Expert Validation', framework: 'Evidence/Proof' },
      { stage: 'Consideration', goal: 'UVP Contrast & Differentiation', framework: 'Benefit-Stacking' },
      { stage: 'Conversion', goal: 'Direct High-Intent CTA & Urgency', framework: 'AIDA (Direct Action)' }
    ];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${mm}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
      const postingDays = strategy.posting_days || [];

      if (postingDays.includes(dayOfWeek)) {
        let reason = "Growth Pillar Post";
        const holiday = (occasions || []).find(o => o.occasion_date === dateStr);
        if (holiday) reason += ` & ${holiday.title}`;
        plannedDates.push({ date: dateStr, reason });
      }
    }

    console.log(`📅 Mapping ${plannedDates.length} Expert Posts...`);

    // 1. CREATE ALL PLACEHOLDERS IMMEDIATELY (To prevent 504 Timeout)
    const placeholders = [];
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const blueprint = FUNNEL_BLUEPRINT[i % FUNNEL_BLUEPRINT.length];

      let time = strategy.preferred_time || '10:00';
      if (time.split(':').length === 2) time += ':00';
      const scheduledAt = `${slot.date}T${time}Z`;

      // Check if already exists
      const { data: existing } = await supabase.from('posts').select('id, is_placeholder').eq('client_id', String(clientId)).eq('scheduled_at', scheduledAt).maybeSingle();
      if (existing) continue;

      placeholders.push({
        client_id: String(clientId),
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms || ['facebook', 'instagram'],
        funnel_stage: blueprint.stage,
        post_type: 'Static', // Default
        topic: 'STRATEGIC AI ARCHITECTING...',
        copy_direction: 'AI is currently analyzing market data for this slot...',
        visual_idea: 'Generating visual concept...',
        content: 'Finalizing professional copy...',
        strategic_goal: blueprint.goal,
        post_no: i + 1,
        metadata: { framework: blueprint.framework, status: 'processing' }
      });
    }

    let insertedData = [];
    if (placeholders.length > 0) {
      const { data, error: bulkError } = await supabase.from('posts').insert(placeholders).select('id, scheduled_at');
      if (bulkError) {
        console.error("❌ Placeholder Bulk Insert Failed:", bulkError.message);
      } else {
        insertedData = data || [];
      }
    }

    // 2. RESPOND TO CLIENT IMMEDIATELY
    const result = {
      success: true,
      count: placeholders.length,
      message: "Roadmap created. AI is filling details in background."
    };

    // 3. TRIGGER BACKGROUND FILLER with the exact IDs we just created
    if (insertedData.length > 0) {
      setImmediate(() => {
        fillStrategicContentInBackground(clientId, strategy, insertedData);
      });
    }

    return result;
  } catch (err) {
    console.error("\n❌ [Expert Brain Error]:", err.message);
    throw err;
  }
}

/**
 * BACKGROUND WORKER: Fills the specific placeholder IDs
 */
async function fillStrategicContentInBackground(clientId, strategy, placeholders) {
  console.log(`🧠 [AI Background Worker] Starting to fill ${placeholders.length} posts for Client ${clientId}...`);

  for (let i = 0; i < placeholders.length; i++) {
    const placeholder = placeholders[i];

    try {
      // 1. Get the current state of this specific post
      const { data: post } = await supabase.from('posts')
        .select('id, metadata, funnel_stage, scheduled_at')
        .eq('id', placeholder.id)
        .single();

      if (!post || post.metadata?.status === 'completed') continue;

      // 2. Map back to the blueprint for the prompt
      const blueprint = FUNNEL_BLUEPRINT[i % FUNNEL_BLUEPRINT.length];
      const dateStr = post.scheduled_at.split('T')[0];

      // 3. Fetch history for uniqueness (excluding architecting labels)
      const { data: historyData } = await supabase.from('posts')
        .select('topic')
        .eq('client_id', String(clientId))
        .limit(50);
      const pastTopics = (historyData || []).map(h => h.topic).filter(t => t && !t.includes('ARCHITECTING'));

      console.log(`🤖 [Background] Generating content for Post #${i + 1} (${dateStr})...`);
      const content = await generateMarketExpertContent(strategy, blueprint, "Growth Pillar Post", pastTopics);

      // 4. Update with real content
      const { error: updateError } = await supabase.from('posts').update({
        post_type: content.post_type || 'Static',
        topic: content.topic,
        copy_direction: content.copy_direction,
        visual_idea: content.visual_idea,
        content: content.caption,
        metadata: {
          ...post.metadata,
          alternative_angles: content.alternative_angles,
          engine: content.engine,
          expert_rationale: content.expert_rationale,
          status: 'completed'
        }
      }).eq('id', post.id);

      if (updateError) throw updateError;
      console.log(`✅ [Background] Post #${i + 1} (${dateStr}) updated successfully.`);

      // Delay to respect API limits
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (err) {
      console.error(`❌ [Background Worker] Error on placeholder ${placeholder.id}:`, err.message);
      // Optional: Mark as failed so we don't keep retrying or to show error in UI
    }
  }
  console.log(`🏁 [AI Background Worker] Finished filling roadmap for Client ${clientId}.`);
}

async function generateMarketExpertContent(strategy, blueprint, context, pastTopics) {
  const historyString = pastTopics.length > 0 ? pastTopics.join(', ') : 'None. New roadmap.';

  const prompt = `
    Role: WORLD-CLASS CREATIVE CONTENT WRITER & SENIOR STRATEGIST.
    Tone: ${strategy.brand_voice}.
    Niche: ${strategy.content_focus}.
    Funnel Stage: ${blueprint.stage} (${blueprint.goal}).
    Framework: ${blueprint.framework}.
    Additional Context: ${context}.

    YOUR MISSION:
    Think outside the box. Avoid clichés. Be provocative, emotional, and highly unique.
    You are writing for a high-end audience that hates generic marketing.

    CRITICAL: YOU MUST BE 100% UNIQUE. DO NOT REPEAT THESE TOPICS: ${historyString}

    TASK:
    1. post_type: "Static Image" or "Reel".
    2. topic: A viral-worthy headline that uses psychological triggers (Curiosity, Empathy, or Paradox).
    3. copy_direction: Give the creator 3 specific 'Hooks' to use in the first 3 seconds, and a unique 'Angle' for the storytelling.
    4. visual_idea: Describe a cinematic visual concept (lighting, camera angle, and mood) like a film director would.
    5. caption: Write the full social media copy. It must be engaging, use storytelling, and end with a 'Low-Friction' call to action.
    6. expert_rationale: Explain the behavioral psychology behind why this specific post will stop the scroll.

    Output ONLY valid JSON:
    {
      "post_type": "Static | Reel",
      "topic": "Unique Viral Headline",
      "copy_direction": "3 Specific Hooks and a Storytelling Angle...",
      "visual_idea": "Cinematic art direction and mood...",
      "caption": "Full high-converting storytelling copy...",
      "expert_rationale": "Psychological trigger explanation...",
      "alternative_angles": ["Angle 1", "Angle 2", "Angle 3"]
    }
  `;

  try {
    const data = await generateJSON(prompt);
    return data;
  } catch (err) {
    console.error("❌ Cloud Generation Failed, using Emergency Fallback:", err.message);
    return {
      post_type: "Static",
      topic: "Brand Performance Post",
      copy_direction: "Standard brand authority and reach.",
      visual_idea: "Clean, professional branding visual.",
      caption: "Something great is coming. Stay tuned!",
      expert_rationale: "Safety fallback.",
      alternative_angles: [],
      engine: "Emergency Fallback"
    };
  }
}

module.exports = { buildMonthlyStrategy };
