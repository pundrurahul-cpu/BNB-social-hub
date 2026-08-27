const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Funnel Sequence from your spreadsheet (May 2026 Model)
 */
const AGENCY_BLUEPRINT = [
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

async function generateMonthlyAgencyPlan(clientId, month, year) {
  console.log(`🎯 [Agency Brain] Building Plan for Client ${clientId}...`);

  try {
    // 1. Get Client Profile (Rules for Mon, Wed, Fri)
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', clientId).single();
    if (!strategy) throw new Error("Client Posting Strategy not found.");

    // 2. Identify all Mandatory Dates (Mon, Wed, Fri)
    const plannedDates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch special occasions/holidays
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const { data: occasions } = await supabase.from('special_occasions').select('*').gte('occasion_date', startDate).lte('occasion_date', endDate);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 1=Mon, 3=Wed, 5=Fri

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) reason = "Regular Schedule";
      const occasion = occasions?.find(o => o.occasion_date === dateStr);
      if (occasion) reason = reason ? `${reason} & ${occasion.title}` : occasion.title;

      if (reason) plannedDates.push({ date: dateStr, reason });
    }

    // 3. Brainstorm Content (Following Funnel & Ensuring Uniqueness)
    for (let i = 0; i < plannedDates.length; i++) {
      const slot = plannedDates[i];
      const blueprint = AGENCY_BLUEPRINT[i % AGENCY_BLUEPRINT.length];
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Avoid double-scheduling
      const { data: exists } = await supabase.from('posts').select('id').eq('client_id', clientId).eq('scheduled_at', scheduledAt).maybeSingle();
      if (exists) continue;

      // Get history for uniqueness check
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

      console.log(`🤖 AI Brainstorming: ${blueprint.stage} (${blueprint.type}) for ${slot.date}`);
      const aiContent = await generateUniqueBrief(strategy, blueprint, slot.reason, pastTopics);

      // 4. Save "Ghost Post" for Designer fulfillment
      await supabase.from('posts').insert([{
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
          strategic_goal: blueprint.goal,
          reason: slot.reason,
          ai_version: 'AgencyBrain_v1'
        }
      }]);
    }

    return { success: true, count: plannedDates.length };
  } catch (err) {
    console.error('❌ Agency Brain Error:', err.message);
    throw err;
  }
}

async function generateUniqueBrief(strategy, blueprint, context, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Content Strategist for ${strategy.content_focus} brand.
    Brand Voice: ${strategy.brand_voice}
    Current Slot: ${context}
    Funnel Stage: ${blueprint.stage}
    Strategic Goal: ${blueprint.goal}
    Post Type: ${blueprint.type}

    CRITICAL: Ensure this content is 100% unique. Do NOT repeat or overlap with these past topics: [${history}]

    Output ONLY valid JSON:
    {
      "topic": "Catchy headline of the post",
      "copy_direction": "Instruction for the designer on what text to highlight on the image",
      "visual_idea": "A detailed visual brief for a designer to create a referral image/moodboard",
      "caption": "Engaging social media caption with 5 hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
}

module.exports = { generateMonthlyAgencyPlan };
