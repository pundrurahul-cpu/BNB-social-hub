const axios = require('axios');
const supabase = require('./supabaseClient');

const CLIENT_ID = 'e07c79d2-85be-4f5e-98d8-ac416be73971'; // BNB
const IG_ACCOUNT_ID = '17841433369374677';
const ACCESS_TOKEN = 'EAAcn2swzCGgBR9XCvKm5aIljTASPCrkieGvkRocYAl6FGVRl1lwCiRQVlM0hfS6KXmok6vtLdt20AqlZBxjMNOjZCZAtqOAlZBg37bXIjD0whL2hslXlUAysU9YyYGn0Ii4Wu3vDLHpxKF4fNQDwr0ijuzLTumUq0C86IueygxZCJDsplDyUyU06hgzeF5vkjlT9k3fmc';

async function syncPosts() {
  console.log(`🔄 [Sync] Fetching recent posts from Instagram for Account: ${IG_ACCOUNT_ID}...`);

  try {
    const url = `https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media?fields=id,caption,media_url,permalink,timestamp,media_type&access_token=${ACCESS_TOKEN}&limit=20`;
    const response = await axios.get(url);
    const media = response.data.data || [];

    console.log(`📸 Found ${media.length} recent posts on Instagram.`);

    let syncedCount = 0;

    for (const item of media) {
      // Check if already in DB
      const { data: existing } = await supabase
        .from('posts')
        .select('id')
        .eq('client_id', CLIENT_ID)
        .contains('metadata', { instagram: { platform_post_id: item.id } })
        .maybeSingle();

      if (existing) {
        console.log(`⏩ Skipping post ${item.id} (already synced)`);
        continue;
      }

      console.log(`📥 Syncing post ${item.id}...`);

      const postPayload = {
        client_id: CLIENT_ID,
        content: item.caption || 'Instagram Post',
        media_url: item.media_url,
        platforms: ['instagram'],
        scheduled_at: item.timestamp,
        status: 'published',
        is_placeholder: false,
        topic: 'Synced from Instagram',
        funnel_stage: 'Synced',
        metadata: {
          instagram: {
            platform_post_id: item.id,
            permalink: item.permalink,
            media_type: item.media_type
          },
          synced: true
        }
      };

      const { error } = await supabase.from('posts').insert([postPayload]);
      if (error) {
        console.error(`❌ Failed to insert post ${item.id}:`, error.message);
      } else {
        syncedCount++;
      }
    }

    console.log(`✅ Sync Complete! Total synced: ${syncedCount}`);

  } catch (err) {
    console.error('❌ Sync Error:', err.response?.data || err.message);
  }
}

syncPosts();
