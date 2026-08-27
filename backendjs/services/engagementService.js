const supabase = require('../supabaseClient');
const { processPostComments } = require('./analyticsService');
const { generateCommentReply } = require('./aiService');
const { replyToInstagramComment } = require('./instagramService');
const { replyToFacebookComment } = require('./facebookService');

/**
 * Autonomous Background Monitor for Real-Time Community Engagement
 * Scans for new comments every 30 seconds and replies automatically.
 */
async function startAutoEngagementMonitor() {
  console.log('🤖 [Auto-Engagement] Background Monitor Active (Heartbeat: 30s)');

  setInterval(async () => {
    try {
      // 1. Fetch ALL active clients who have auto_engagement enabled
      const { data: strategies, error: stratErr } = await supabase
        .from('client_strategies')
        .select('client_id, brand_voice')
        .eq('auto_engagement', true);

      if (stratErr) throw stratErr;
      if (!strategies || strategies.length === 0) {
        console.log('ℹ️ [Auto-Engagement] No clients have Real-Time Auto-Reply enabled.');
        return;
      }

      const clientIds = strategies.map(s => s.client_id);

      // 2. Fetch ALL published posts for these active clients (No time limit)
      const { data: activePosts, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .in('client_id', clientIds);

      if (postErr) throw postErr;

      if (!activePosts || activePosts.length === 0) {
        console.log('ℹ️ [Auto-Engagement] No published posts found for active clients.');
        return;
      }

      console.log(`🤖 [Auto-Engagement] Scanning ALL published posts (${activePosts.length} posts total) across active clients...`);

      for (const post of activePosts) {
        try {
          // 3. Fast-Track Discovery (Skips heavy AI analysis for speed)
          await processPostComments(post.id, post.platforms, true);

          // 4. Find unreplied comments for this post in the database
          const { data: unrepliedComments, error: commErr } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', post.id)
            .is('replied_at', null);

          if (commErr) throw commErr;
          if (!unrepliedComments || unrepliedComments.length === 0) continue;

          console.log(`💬 [Auto-Engagement] Found ${unrepliedComments.length} unreplied comments on post ${post.id.substring(0,8)}`);

          // Fetch Connection & Strategy Context
          const { data: connections } = await supabase.from('connections').select('*').eq('client_id', post.client_id);
          const currentStrategy = strategies.find(s => s.client_id === post.client_id);

          const brandVoice = currentStrategy?.brand_voice || "Professional";

        for (const comment of unrepliedComments) {
           console.log(`💬 [Auto-Engagement] New comment detected on ${comment.platform} for post ${post.id.substring(0,8)}`);

           // Safety: Do not reply to our own replies (if identified) or empty comments
           if (!comment.text || comment.text.trim() === '') continue;

           try {
             // Generate AI Reply
             const aiReply = await generateCommentReply(comment.text, post.content, brandVoice);

             let token;
             let success = false;

             if (comment.platform === 'instagram') {
               const fbConn = connections?.find(c => c.platform === 'facebook');

               // Priority 1: Use token from connections (likely the freshest)
               const igAccountFromConn = fbConn?.metadata?.instagram_accounts?.find(a => a.id === post.metadata?.instagram?.page_id)
                                      || fbConn?.metadata?.instagram_accounts?.[0];

               // Priority 2: Use token from post metadata (saved at publish time)
               // Priority 3: Fallback to master user token
               token = igAccountFromConn?.page_access_token || post.metadata?.instagram?.page_access_token || fbConn?.access_token;

               if (token) {
                 try {
                   console.log(`   🚀 Sending Instagram reply to ${comment.platform_comment_id}...`);
                   const result = await replyToInstagramComment(comment.platform_comment_id, aiReply, token);
                   console.log(`   ✅ API ID: ${result.id}`);
                   success = true;
                 } catch (replErr) {
                   console.error(`   ❌ Primary token failed: ${replErr.message}`);
                   if (fbConn?.access_token && token !== fbConn.access_token) {
                     console.warn('   ⚠️ Retrying with Master User Token...');
                     const result = await replyToInstagramComment(comment.platform_comment_id, aiReply, fbConn.access_token);
                     console.log(`   ✅ API ID: ${result.id}`);
                     success = true;
                   } else throw replErr;
                 }
               } else {
                 console.error('   ❌ No valid token found for Instagram reply.');
               }
             } else if (comment.platform === 'facebook') {
               const fbConn = connections?.find(c => c.platform === 'facebook');
               const page = fbConn?.metadata?.pages?.find(p => p.id === post.metadata?.facebook?.page_id)
                         || fbConn?.metadata?.pages?.[0];
               token = page?.access_token || post.metadata?.facebook?.page_access_token;

               if (token) {
                 console.log(`   🚀 Sending Facebook reply to ${comment.platform_comment_id}...`);
                 const result = await replyToFacebookComment(comment.platform_comment_id, aiReply, token);
                 console.log(`   ✅ API ID: ${result.id}`);
                 success = true;
               }
             }

             if (success) {
               await supabase.from('comments').update({
                 ai_reply_text: aiReply,
                 replied_at: new Date().toISOString()
               }).eq('id', comment.id);
               console.log(`✅ [Auto-Engagement] Database updated for comment ${comment.id.substring(0,8)}`);
             }
           } catch (e) {
             console.error(`❌ [Auto-Engagement] Critical Failure:`, e.message);
           }
        }
      } catch (postLevelErr) {
        console.error(`⚠️ [Auto-Engagement] Skip post ${post.id.substring(0,8)}:`, postLevelErr.message);
      }
    }
  } catch (err) {
      console.error('❌ [Auto-Engagement] Monitor Error:', err.message);
    }
  }, 30000); // 30 second interval
}

module.exports = { startAutoEngagementMonitor };
