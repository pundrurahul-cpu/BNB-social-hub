const cron = require('node-cron');
const supabase = require('../supabaseClient');
const { handleFacebookPost } = require('./facebookService');
const { handleLinkedInPost } = require('./linkedinService');
const { handleInstagramPost } = require('./instagramService');
const { handlePinterestPost = null } = require('./pinterestService');
const { getFacebookFollowers } = require('./facebookService');
const { getInstagramFollowers } = require('./instagramService');
const { startAutoEngagementMonitor } = require('./engagementService');

const start = () => {
  console.log('🚀 Post Scheduler Active...');

  // Start Real-Time Engagement Monitor (30s heartbeat)
  startAutoEngagementMonitor();

  // Check for scheduled posts every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString();
      console.log(`⏰ [Scheduler] Checking for posts due at ${now}...`);

      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_at', now);

      if (error) throw error;
      if (!posts || posts.length === 0) return;

      console.log(`🚀 [Scheduler] Found ${posts.length} posts to publish!`);

      for (const post of posts) {
        try {
          const targetPlatforms = post.platforms || [];
          const updatedMetadata = { ...post.metadata };

          // Publish to each selected platform
          if (targetPlatforms.includes('facebook')) {
            console.log(`   - Publishing post ${post.id.substring(0,8)} to Facebook`);
            await handleFacebookPost(post).then(res => updatedMetadata.facebook = res).catch(e => console.error('FB Scheduled Fail:', e.message));
          }
          if (targetPlatforms.includes('instagram')) {
            console.log(`   - Publishing post ${post.id.substring(0,8)} to Instagram`);
            await handleInstagramPost(post).then(res => updatedMetadata.instagram = res).catch(e => console.error('IG Scheduled Fail:', e.message));
          }
          if (targetPlatforms.includes('linkedin')) {
            console.log(`   - Publishing post ${post.id.substring(0,8)} to LinkedIn`);
            await handleLinkedInPost(post).then(res => updatedMetadata.linkedin = res).catch(e => console.error('LI Scheduled Fail:', e.message));
          }
          if (targetPlatforms.includes('pinterest') && handlePinterestPost) {
            console.log(`   - Publishing post ${post.id.substring(0,8)} to Pinterest`);
            await handlePinterestPost(post).then(res => updatedMetadata.pinterest = res).catch(e => console.error('Pin Scheduled Fail:', e.message));
          }

          // Update the record with social IDs and set status to published
          await supabase.from('posts').update({
            status: 'published',
            metadata: updatedMetadata
          }).eq('id', post.id);

          console.log(`✅ [Scheduler] Post ${post.id.substring(0,8)} published and updated.`);
        } catch (postErr) {
          console.error(`❌ [Scheduler] Failed to process post ${post.id}:`, postErr.message);
        }
      }
    } catch (err) {
      console.error('❌ [Scheduler] Service Error:', err.message);
    }
  });

  // DAILY ANALYTICS SNAPSHOT (Every day at midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('📊 [Snapshot] Taking daily analytics snapshot...');
    try {
      const { data: clients } = await supabase.from('clients').select('id');

      for (const client of clients) {
        const { data: connections } = await supabase.from('connections').select('*').eq('client_id', client.id);

        let totalFollowers = 0;
        let platformStats = {};

        for (const conn of connections) {
          try {
             if (conn.platform === 'facebook') {
               const page = conn.metadata?.pages?.[0];
               if (page) {
                 const count = await getFacebookFollowers(page.id, page.access_token);
                 totalFollowers += count;
                 platformStats.facebook = count;
               }
               const ig = conn.metadata?.instagram_accounts?.[0];
               if (ig) {
                 const count = await getInstagramFollowers(ig.id, ig.page_access_token);
                 totalFollowers += count;
                 platformStats.instagram = count;
               }
             }
          } catch (e) { console.error(`Snapshot Error (${conn.platform}):`, e.message); }
        }

        // Save Snapshot
        await supabase.from('analytics_snapshots').insert([{
          client_id: client.id,
          total_followers: totalFollowers,
          platform_breakdown: platformStats,
          snapshot_date: new Date().toISOString().split('T')[0]
        }]);
      }
      console.log('✅ [Snapshot] Daily update complete.');
    } catch (err) {
      console.error('❌ Snapshot Service Failed:', err.message);
    }
  });
};

module.exports = { start };
