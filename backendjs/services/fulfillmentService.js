const supabase = require('../supabaseClient');

/**
 * FULFILLMENT LOGIC:
 * When a designer uploads a final image to an AI-generated placeholder,
 * this function "fixes" the calendar by converting it to a real scheduled post.
 */
async function fulfillPlaceholder(postId, mediaUrl, finalCaption) {
  console.log(`🛠️ [Fulfillment] Converting placeholder ${postId} to scheduled post...`);

  try {
    const { data, error } = await supabase
      .from('posts')
      .update({
        media_url: mediaUrl,
        content: finalCaption,
        is_placeholder: false,
        status: 'scheduled', // It is now ready for the minute-by-minute scheduler
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ [Fulfillment] Post ${postId} is now officially scheduled for ${data.scheduled_at}`);
    return data;
  } catch (err) {
    console.error('❌ [Fulfillment] Failed:', err.message);
    throw err;
  }
}

module.exports = { fulfillPlaceholder };
