const supabase = require('../supabaseClient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * AI Content Planner: Generates unique post ideas and slots them into the calendar.
 */
async function generateMonthlySchedule(clientId, month, year) {
  console.log(`🧠 [Planner] Generating schedule for Client: ${clientId} for ${month}/${year}`);

  try {
    // 1. Fetch Client Strategy
    const { data: strategy, error: strategyError } = await supabase
      .from('client_strategies')
      .select('*')
      .eq('client_id', String(clientId))
      .eq('is_active', true)
      .maybeSingle();

    if (strategyError || !strategy) {
      throw new Error(`No active strategy found for client ${clientId}`);
    }

    // 2. Fetch Special Occasions for the month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: occasions } = await supabase
      .from('special_occasions')
      .select('*')
      .gte('occasion_date', startDate)
      .lte('occasion_date', endDate);

    // 3. Calculate all posting dates (Mon, Wed, Fri + Occasions)
    const postingDates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
      const dateString = date.toISOString().split('T')[0];

      let reason = null;
      if (strategy.posting_days.includes(dayOfWeek)) {
        reason = 'Regular Schedule';
      }

      const occasion = occasions?.find(o => o.occasion_date === dateString);
      if (occasion) {
        reason = reason ? `${reason} & ${occasion.title}` : occasion.title;
      }

      if (reason) {
        postingDates.push({ date: dateString, reason });
      }
    }

    console.log(`📅 [Planner] Identified ${postingDates.length} slots for the month.`);

    // 4. Generate Ideas for each slot
    for (const slot of postingDates) {
      const scheduledAt = `${slot.date}T${strategy.preferred_time}`;

      // Check if a post already exists for this exact time to avoid duplicates
      const { data: existing } = await supabase
        .from('posts')
        .select('id')
        .eq('client_id', String(clientId))
        .eq('scheduled_at', scheduledAt)
        .maybeSingle();

      if (existing) {
        console.log(`⏩ [Planner] Slot ${slot.date} already filled. Skipping.`);
        continue;
      }

      console.log(`💡 [Planner] Generating unique idea for ${slot.date} (${slot.reason})...`);

      const ideaData = await generateUniqueIdea(strategy, slot.reason);

      // 5. Create the Ghost Post (Placeholder)
      const { error: postError } = await supabase
        .from('posts')
        .insert([{
          client_id: String(clientId),
          content_idea: ideaData.idea,
          content: ideaData.caption,
          status: 'draft',
          is_placeholder: true,
          scheduled_at: scheduledAt,
          platforms: strategy.platforms || ['facebook', 'instagram'],
          metadata: {
            reason: slot.reason,
            visual_prompt: ideaData.visual_prompt,
            generated_at: new Date().toISOString()
          }
        }]);

      if (postError) {
        console.error('❌ Error creating placeholder post:', postError.message);
      } else {
        console.log(`✅ [Planner] Ghost post created for ${slot.date}`);
      }
    }

    return { success: true, count: postingDates.length };

  } catch (err) {
    console.error('❌ [Planner] Error:', err.message);
    throw err;
  }
}

/**
 * Uses Gemini to generate a unique content idea and visual prompt
 */
async function generateUniqueIdea(strategy, context) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Fetch last few ideas to avoid repetition
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('content_idea')
      .eq('client_id', String(strategy.client_id))
      .order('scheduled_at', { ascending: false })
      .limit(15);

    const pastContent = recentPosts?.map(p => p.content_idea).filter(Boolean).join(', ') || 'None';

    const prompt = `
      You are a high-end Social Media Content Strategist.
      Client Focus: ${strategy.content_focus}
      Brand Voice: ${strategy.brand_voice}
      Context: This post is for ${context}

      CRITICAL RULE: Do NOT repeat or significantly overlap with these past topics:
      [${pastContent}]

      Task:
      1. Create a FRESH, engaging post idea.
      2. Write a captivating caption with relevant hashtags.
      3. Create a DETAILED visual prompt for a designer that describes exactly what the referral image should show.

      Output ONLY valid JSON in this format:
      {
        "idea": "Short title of the idea",
        "caption": "The full post text",
        "visual_prompt": "Detailed description of the required image"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Attempt to parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Could not parse AI response');
  } catch (error) {
    console.error('AI Idea Gen Error:', error.message);
    return {
      idea: `Update for ${context}`,
      caption: `We're excited to share our latest update! #SocialMedia`,
      visual_prompt: `A beautiful lifestyle shot representing the brand focus.`
    };
  }
}

module.exports = { generateMonthlySchedule };
