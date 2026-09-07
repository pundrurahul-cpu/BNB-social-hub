const supabase = require('../supabaseClient');
const { generateJSON } = require('./aiService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

/**
 * GLOBAL STRATEGIC BLUEPRINT
 */
const FUNNEL_BLUEPRINT = [
  { stage: 'Awareness', goal: 'Pattern Interrupt & Brand Recall', framework: 'Curiosity Loop' },
  { stage: 'Interest', goal: 'Concept Clarity & Logic-Based Value', framework: 'PAS (Problem/Agitate/Solve)' },
  { stage: 'Trust', goal: 'Social Proof & Expert Validation', framework: 'Evidence/Proof' },
  { stage: 'Consideration', goal: 'UVP Contrast & Differentiation', framework: 'Benefit-Stacking' },
  { stage: 'Conversion', goal: 'Direct High-Intent CTA & Urgency', framework: 'AIDA (Direct Action)' }
];

/**
 * STRATEGIC BRAIN V1000.11 - MARKET EXPERT EDITION
 */
async function buildMonthlyStrategy(clientId, month, year) {
  console.log(`\n🧠 [V1000 Market Expert] Starting stable roadmap for Client: ${clientId}`);

  try {
    const { data: strategy, error: stratError } = await supabase
      .from('client_strategies')
      .select('*')
      .eq('client_id', String(clientId))
      .maybeSingle();

    if (stratError) throw stratError;
    if (!strategy) throw new Error("Strategy config not found.");

    const daysInMonth = new Date(year, month, 0).getDate();
    const plannedDates = [];
    const mm = String(month).padStart(2, '0');

    const { data: occasions } = await supabase.from('special_occasions').select('*')
      .gte('occasion_date', `${year}-${mm}-01`)
      .lte('occasion_date', `${year}-${mm}-${daysInMonth}`);

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

    console.log(`📅 Mapping ${plannedDates.length} Posts...`);

    const placeholders = [];
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const blueprint = FUNNEL_BLUEPRINT[i % FUNNEL_BLUEPRINT.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time || '10:00:00'}Z`;

      const { data: existing } = await supabase.from('posts').select('id, is_placeholder').eq('client_id', String(clientId)).eq('scheduled_at', scheduledAt).maybeSingle();
      if (existing) continue;

      placeholders.push({
        client_id: String(clientId),
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: strategy.platforms || ['facebook', 'instagram'],
        funnel_stage: blueprint.stage,
        post_type: 'Static',
        topic: 'AI STRATEGIST ARCHITECTING...',
        copy_direction: 'Analyzing market data...',
        visual_idea: 'Generating visual concept...',
        content: 'Finalizing copy...',
        strategic_goal: blueprint.goal,
        post_no: i + 1,
        metadata: { framework: blueprint.framework, status: 'processing' }
      });
    }

    let insertedData = [];
    if (placeholders.length > 0) {
      const { data, error: bulkError } = await supabase.from('posts').insert(placeholders).select('id, scheduled_at');
      if (bulkError) console.error("❌ Placeholder Error:", bulkError.message);
      else insertedData = data || [];
    }

    // Response
    const result = { success: true, count: placeholders.length, message: "Roadmap ready. AI filling details..." };

    // Trigger Background
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
 * BACKGROUND WORKER: Reliable Model Rotation with Auto-Quota Recovery
 */
async function fillStrategicContentInBackground(clientId, strategy, placeholders) {
  console.log(`🧠 [AI Background Worker] Starting resilient rotation fill for ${placeholders.length} posts...`);

  // 3 Distinct Flash Models to maximize Free Tier throughput
  const rotationModels = ["gemini-3.6-flash", "gemini-1.5-flash", "gemini-flash-latest"];

  for (let i = 0; i < placeholders.length; i++) {
    const placeholder = placeholders[i];
    let success = false;
    let attempts = 0;

    while (!success && attempts < 4) {
      // Pick a model from the rotation based on post index and current attempt
      const modelIndex = (i + attempts) % rotationModels.length;
      const targetModel = rotationModels[modelIndex];

      try {
        const { data: post } = await supabase.from('posts').select('id, metadata, scheduled_at').eq('id', placeholder.id).single();
        if (!post || post.metadata?.status === 'completed') {
           success = true;
           continue;
        }

        const blueprint = FUNNEL_BLUEPRINT[i % FUNNEL_BLUEPRINT.length];
        const dateStr = post.scheduled_at.split('T')[0];

        const { data: historyData } = await supabase.from('posts').select('topic').eq('client_id', String(clientId)).limit(50);
        const pastTopics = (historyData || []).map(h => h.topic).filter(t => t && !t.includes('ARCHITECTING'));

        console.log(`🤖 [Background] Post #${i + 1} (${dateStr}) attempting with ${targetModel}...`);
        const content = await generateMarketExpertContent(strategy, blueprint, "Growth Pillar Post", pastTopics, targetModel);

        await supabase.from('posts').update({
          post_type: content.post_type || 'Static',
          topic: content.topic,
          copy_direction: content.copy_direction,
          visual_idea: content.visual_idea,
          content: content.caption,
          metadata: {
            ...post.metadata,
            alternative_angles: content.alternative_angles,
            engine: content.engine,
            status: 'completed'
          }
        }).eq('id', post.id);

        console.log(`✅ [Background] Post #${i + 1} completed.`);
        success = true;

        // Wait 12 seconds between successful posts to stay safe
        await new Promise(resolve => setTimeout(resolve, 12000));

      } catch (err) {
        attempts++;
        if (err.message === "QUOTA_EXCEEDED" || err.message.includes("429")) {
          console.warn(`⏳ [Quota Recovery] Rate limit reached. Pausing for 65s before retrying Post #${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 65000));
        } else {
          console.error(`❌ [Worker Error] Post #${i + 1} (Attempt ${attempts}):`, err.message);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  }
  console.log(`🏁 [AI Background Worker] Full roadmap filled successfully.`);
}

async function generateMarketExpertContent(strategy, blueprint, context, pastTopics, forcedModel = null) {
  const historyString = pastTopics.length > 0 ? pastTopics.join(', ') : 'None.';
  const prompt = `Role: Senior Strategist. Tone: ${strategy.brand_voice}. Niche: ${strategy.content_focus}. Stage: ${blueprint.stage}. Goal: ${blueprint.goal}. Framework: ${blueprint.framework}. Context: ${context}. Unique Rule: Do not repeat ${historyString}. Output ONLY valid JSON: {"post_type": "...", "topic": "...", "copy_direction": "...", "visual_idea": "...", "caption": "...", "expert_rationale": "...", "alternative_angles": []}`;

  try {
    // Let the error bubble up so the background worker can handle the 429 quota wait
    return await generateJSON(prompt, 0, forcedModel);
  } catch (err) {
    if (err.message === "QUOTA_EXCEEDED" || err.message.includes("429")) {
      throw err;
    }
    return {
      post_type: "Static",
      topic: "Brand Insights Update",
      copy_direction: "Professional authority.",
      visual_idea: "Modern branding visual.",
      caption: "Something great is coming! Stay tuned.",
      alternative_angles: [],
      engine: "Fallback"
    };
  }
}

module.exports = { buildMonthlyStrategy };
