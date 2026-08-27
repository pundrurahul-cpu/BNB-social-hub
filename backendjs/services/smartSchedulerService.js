const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Funnel stages sequence from your spreadsheet
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

async function generateMonthlySchedule(clientId, month, year) {
  console.log(`📅 [Smart Scheduler] Generating plan for Client: ${clientId} (${month}/${year})`);

  try {
    const { data: profile } = await supabase.from('client_strategic_profiles').select('*').eq('client_id', clientId).single();
    if (!profile) throw new Error("Please set up the Client's Strategic Profile first.");

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Identify mandatory days (Mon, Wed, Fri) + Special Occasions
    const slots = [];
    for (let d = 1; d <= endDate.getDate(); d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      if (profile.posting_days.includes(dayOfWeek)) {
        slots.push({ date: dateStr, isOccasion: false });
      }
    }

    // Process slots with AI
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const blueprint = STRATEGIC_SEQUENCE[i % STRATEGIC_SEQUENCE.length];
      const scheduledAt = `${slot.date}T${profile.preferred_time}`;

      // 1. Repetition Check: Get previous topics
      const { data: history } = await supabase.from('posts').select('topic').eq('client_id', clientId).limit(20);
      const pastTopics = history?.map(h => h.topic).join(', ') || 'None';

      // 2. Generate Content via Gemini
      const aiContent = await brainstormStrategicContent(profile, blueprint, pastTopics);

      // 3. Save as "Ghost Post" for Designers
      await supabase.from('posts').insert([{
        client_id: clientId,
        status: 'draft',
        is_placeholder: true,
        scheduled_at: scheduledAt,
        platforms: ['facebook', 'instagram', 'linkedin', 'pinterest'],
        funnel_stage: blueprint.stage,
        post_type: blueprint.type,
        topic: aiContent.topic,
        copy_direction: aiContent.copy_direction,
        visual_idea: aiContent.visual_idea,
        content: aiContent.caption,
        metadata: {
          visual_prompt: aiContent.visual_idea,
          goal: blueprint.goal
        }
      }]);
    }

    return { success: true, count: slots.length };
  } catch (err) {
    console.error('❌ [Smart Scheduler] Error:', err.message);
    throw err;
  }
}

async function brainstormStrategicContent(profile, blueprint, history) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Role: Expert Content Strategist
    Client: ${profile.industry} (${profile.brand_voice})
    Target Audience: ${profile.target_audience}

    TASK: Plan a unique post for the "${blueprint.stage}" stage.
    Goal: ${blueprint.goal}
    Type: ${blueprint.type}

    PREVIOUS TOPICS (DO NOT REPEAT): [${history}]

    Return ONLY JSON:
    {
      "topic": "Creative post headline",
      "copy_direction": "Instruction for the designer on what text/message to emphasize",
      "visual_idea": "A detailed description of the referral image for a designer. Describe elements, colors, and mood.",
      "caption": "Final social media caption with hashtags"
    }
  `;

  const result = await model.generateContent(prompt);
  const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch[0]);
}

module.exports = { generateMonthlySchedule };
