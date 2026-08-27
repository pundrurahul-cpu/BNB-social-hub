const supabase = require('../supabaseClient');
const { getInstagramComments } = require('./instagramService');
const { getLinkedInComments } = require('./linkedinService');
const { getFacebookComments } = require('./facebookService');
const { analyzeCommentSentiment, generateSentimentReport } = require('./aiService');

async function processPostComments(postId, platforms = ['instagram', 'facebook', 'linkedin'], fastTrack = false) {
  try {
    // 1. Fetch Post Details
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (postError || !post) throw new Error('Post not found');

    const metadata = post.metadata || {};
    let allComments = [];

    // 2. Fetch Fresh Connections (to get updated tokens)
    const { data: connections } = await supabase.from('connections').select('*');

    // 3. Fetch Comments from Instagram
    const igPostId = metadata.instagram?.platform_post_id || metadata.instagram?.post_id;
    if (platforms.includes('instagram') && igPostId) {
      // Find a fresh token from connections for this client
      const fbConn = connections?.find(c => c.platform === 'facebook' && c.client_id === post.client_id);
      const userToken = fbConn?.access_token;

      // Try to find the specific Instagram account token, or fall back to the first available IG token for that client
      const igAccount = fbConn?.metadata?.instagram_accounts?.find(a => a.id === metadata.instagram.page_id)
                        || fbConn?.metadata?.instagram_accounts?.[0];

      const freshToken = igAccount?.page_access_token || metadata.instagram.page_access_token;

      if (!freshToken) {
        console.error('❌ [Instagram] No access token found for post:', postId);
      }

      // Try fetching comments with primary token, fallback to user token if provided
      let igComments = [];
      try {
        igComments = await getInstagramComments(igPostId, freshToken);
      } catch (err) {
        if (userToken) {
          console.warn(`⚠️ [Instagram] Primary token restricted. Retrying with User Token...`);
          try {
            igComments = await getInstagramComments(igPostId, userToken);
          } catch (innerErr) {
            console.error(`❌ [Instagram] User Token also failed:`, innerErr.message);
          }
        } else {
          console.error(`❌ [Instagram] Fetch failed and no User Token available:`, err.message);
        }
      }

      for (const comment of igComments) {
        allComments.push({
          post_id: postId,
          platform_comment_id: comment.id,
          platform: 'instagram',
          author: comment.from?.username || 'unknown',
          text: comment.text,
          like_count: comment.like_count || 0,
          commented_at: comment.timestamp
        });
      }
    }

    // 4. Fetch Comments from Facebook
    const fbPostId = metadata.facebook?.platform_post_id || metadata.facebook?.post_id;
    if (platforms.includes('facebook') && fbPostId) {
      // Try to find a fresher token from connections if available
      const fbConn = connections?.find(c => c.platform === 'facebook' && c.client_id === post.client_id);
      const freshToken = fbConn?.metadata?.pages?.find(p => p.id === metadata.facebook.page_id)?.access_token
                         || metadata.facebook.page_access_token;

      const fbComments = await getFacebookComments(
        fbPostId,
        freshToken
      );

      for (const comment of fbComments) {
        allComments.push({
          post_id: postId,
          platform_comment_id: comment.id,
          platform: 'facebook',
          author: comment.from?.name || 'Facebook User',
          text: comment.message,
          like_count: comment.like_count || 0,
          commented_at: comment.created_time
        });
      }
    }

    // 5. Fetch Comments from LinkedIn
    if (platforms.includes('linkedin') && metadata.linkedin && metadata.linkedin.platform_post_id) {
      const liComments = await getLinkedInComments(
        metadata.linkedin.platform_post_id,
        metadata.linkedin.access_token
      );

      for (const comment of liComments) {
        allComments.push({
          post_id: postId,
          platform_comment_id: comment.id,
          platform: 'linkedin',
          author: comment.message?.attributes?.[0]?.value || 'LinkedIn User',
          text: comment.message?.text || '',
          like_count: 0,
          commented_at: new Date(comment.created?.time).toISOString()
        });
      }
    }

    // 6. Store NEW comments in the database
    let newCount = 0;
    for (const commentData of allComments) {
      const { data: existing } = await supabase
        .from('comments')
        .select('id')
        .eq('platform_comment_id', commentData.platform_comment_id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('comments').insert([commentData]);
        newCount++;
      }
    }

    if (fastTrack) {
      console.log(`   └─ Post ${postId.substring(0,8)}: Found ${allComments.length} comments (${newCount} new)`);
    }

    // 7. If Fast-Track is enabled, skip deep analysis and reporting
    if (fastTrack) {
        return { message: 'Fast-track discovery complete. Comments stored.', count: allComments.length, new: newCount };
    }

    // 8. Fetch ALL comments for this post from the database
    let { data: postComments, error: fetchCommErr } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .in('platform', platforms);

    if (fetchCommErr) throw fetchCommErr;

    // 9. CRITICAL: Analyze any comment that hasn't been analyzed yet
    const unanalyzed = postComments.filter(c => !c.polarity_label);
    if (unanalyzed.length > 0) {
      console.log(`🧠 [AI Agent] Analyzing ${unanalyzed.length} un-processed comments for post ${postId}...`);
      for (const comment of unanalyzed) {
        const analysis = await analyzeCommentSentiment(comment.text);
        if (analysis) {
          await supabase.from('comments').update(analysis).eq('id', comment.id);
          // Update local object as well
          Object.assign(comment, analysis);
        }
      }
    }

    // 10. Generate Aggregate Report
    if (postComments && postComments.length > 0) {
      const summary = {
        total: postComments.length,
        positive: postComments.filter(c => c.polarity_label === 'positive').length,
        negative: postComments.filter(c => c.polarity_label === 'negative').length,
        neutral: postComments.filter(c => c.polarity_label === 'neutral').length,
        emotions: {}, intents: {}, topics: {}
      };

      postComments.forEach(c => {
        if (c.emotion_label) summary.emotions[c.emotion_label] = (summary.emotions[c.emotion_label] || 0) + 1;
        if (c.intent_label) summary.intents[c.intent_label] = (summary.intents[c.intent_label] || 0) + 1;
        if (c.topic_label) summary.topics[c.topic_label] = (summary.topics[c.topic_label] || 0) + 1;
      });

      const reportText = await generateSentimentReport(post.content, summary);

      const snapshot = {
        post_id: postId,
        total_comments: summary.total,
        positive_percentage: (summary.positive / summary.total) * 100,
        negative_percentage: (summary.negative / summary.total) * 100,
        neutral_percentage: (summary.neutral / summary.total) * 100,
        overall_label: reportText,
        emotion_breakdown: summary.emotions,
        intent_breakdown: summary.intents
      };

      await supabase.from('sentiment_snapshots').insert([snapshot]);

      console.log(`✅ [AI Agent] Analysis complete for post ${postId}. Total comments: ${postComments.length}`);

      return {
        report: reportText,
        stats: summary,
        platforms_analyzed: platforms,
        comments: postComments
      };
    }

    return { message: 'No comments found in database or on platforms to analyze.', comments: [] };
  } catch (error) {
    console.error('❌ Process Comments Error:', error.message);
    throw error;
  }
}

module.exports = { processPostComments };
