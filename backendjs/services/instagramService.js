const axios = require('axios');
const supabase = require('../supabaseClient');

/**
 * Fetch Instagram Follower Count
 */
async function getInstagramFollowers(igAccountId, accessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${igAccountId}?fields=followers_count&access_token=${accessToken}`;
    const response = await axios.get(url);
    return response.data.followers_count || 0;
  } catch (error) {
    console.error('IG Followers Error:', error.response?.data || error.message);
    return 0;
  }
}

/**
 * Instagram Publishing (Container-based with Self-Healing)
 */
async function handleInstagramPost(post) {
  const { data: connection } = await supabase
    .from('connections')
    .select('*')
    .eq('platform', 'facebook')
    .eq('client_id', post.client_id)
    .single();

  if (!connection || !connection.metadata.instagram_accounts?.length) {
    throw new Error('No Instagram Business Account linked to this Facebook connection.');
  }

  const igAccount = connection.metadata.instagram_accounts[0];
  const igId = igAccount.id;
  const pageToken = igAccount.page_access_token;
  const userToken = connection.access_token; // Master login token

  console.log(`📸 [Instagram] Attempting to publish to: ${igAccount.username}`);

  const tryPublish = async (token) => {
    // 1. Create Media Container
    const containerRes = await axios.post(`https://graph.facebook.com/v19.0/${igId}/media`, null, {
      params: {
        image_url: post.media_url,
        caption: post.content,
        access_token: token
      }
    });

    const containerId = containerRes.data.id;

    // 2. Wait for processing (simple delay for now)
    await new Promise(r => setTimeout(r, 5000));

    // 3. Publish Media
    const publishRes = await axios.post(`https://graph.facebook.com/v19.0/${igId}/media_publish`, null, {
      params: {
        creation_id: containerId,
        access_token: token
      }
    });

    const publishedId = publishRes.data.id;

    // 4. Fetch the real permalink for the "View on Instagram" button
    let permalink = `https://www.instagram.com/p/${publishedId}/`;
    try {
      const infoRes = await axios.get(`https://graph.facebook.com/v19.0/${publishedId}?fields=permalink&access_token=${token}`);
      if (infoRes.data.permalink) {
        permalink = infoRes.data.permalink;
      }
    } catch (e) {
      console.warn('Could not fetch permalink, using fallback.');
    }

    return {
      platform_post_id: publishedId,
      ig_username: igAccount.username,
      permalink: permalink,
      page_id: igId,
      page_access_token: token
    };
  };

  try {
    // Try Page Token first
    return await tryPublish(pageToken);
  } catch (error) {
    const errorData = error.response?.data?.error;

    // Subcode 33 or Code 100 often means the specific token lacks scope for this object
    if ((errorData?.code === 100 || errorData?.error_subcode === 33) && userToken) {
      console.warn(`⚠️ [Instagram] Page Token restricted for publishing. Retrying with User Access Token...`);
      try {
        return await tryPublish(userToken);
      } catch (innerError) {
        console.error('❌ [Instagram] User Token also failed:', innerError.response?.data || innerError.message);
        throw innerError;
      }
    }

    console.error('Instagram Publish Fail:', errorData || error.message);
    throw error;
  }
}

/**
 * Fetch Instagram Comments
 */
async function getInstagramComments(igMediaId, accessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${igMediaId}/comments?fields=id,text,timestamp,username,like_count&access_token=${accessToken}`;
    const response = await axios.get(url);
    return response.data.data || [];
  } catch (error) {
    console.error('IG Comments Error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Delete Instagram Post
 */
async function deleteInstagramPost(igMediaId, accessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${igMediaId}`;
    const response = await axios.delete(url, {
      params: { access_token: accessToken }
    });
    return response.data;
  } catch (error) {
    console.error('Instagram Delete Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Extract Username and Shortcode from Instagram URL
 * Enhanced with Smart Scanner to find username if missing
 */
async function parseInstagramUrl(url) {
  try {
    // 1. Clean the URL (Remove ?utm_source and other tracking parameters)
    const cleanUrl = url.split('?')[0].split('#')[0].replace(/\/$/, '');

    // 2. Standard: instagram.com/username/reel/ABC or instagram.com/username/p/ABC
    const regex = /(?:instagram\.com\/)([a-zA-Z0-9._]+)\/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/;
    const match = cleanUrl.match(regex);
    if (match) {
      return { username: match[1], shortcode: match[2] };
    }

    // 3. Short form: instagram.com/reel/ABC or instagram.com/p/ABC (No username)
    const shortRegex = /(?:instagram\.com\/(?:p|reel|reels|tv)\/)([a-zA-Z0-9_-]+)/;
    const shortMatch = cleanUrl.match(shortRegex);
    if (shortMatch) {
      const shortcode = shortMatch[1];
      console.log(`🔍 [Smart Scanner] Username missing in URL. Scanning Instagram for shortcode: ${shortcode}...`);

      // Smart Scanner: Quick "Headless" request to find the owner
      try {
        const response = await axios.get(`https://www.instagram.com/p/${shortcode}/`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 5000
        });

        // Search for username in common metadata tags
        const metadataRegexes = [
          /"owner":\{"id":"[^"]+","username":"([^"]+)"\}/, // JSON-LD
          /<meta property="og:description" content="[^@]*@([^ ]+)/, // OG Description
          /<title>[^@]*@([^ ]+)/, // Page Title
          /"author":\{"@type":"Person","name":"([^"]+)"\}/ // Schema.org
        ];

        for (const re of metadataRegexes) {
          const m = response.data.match(re);
          if (m && m[1]) {
            console.log(`✅ [Smart Scanner] Owner detected: @${m[1]}`);
            return { username: m[1], shortcode };
          }
        }
      } catch (scrapeErr) {
        console.warn(`⚠️ [Smart Scanner] Could not scrape username: ${scrapeErr.message}`);
      }

      return { shortcode, username: null };
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch Public Media Data and Comments via Business Discovery
 */
async function getGlobalMediaData(targetUsername, targetShortcode, igBusinessId, accessToken) {
  try {
    // The query string for Business Discovery
    let fields = `business_discovery.username(${targetUsername}){media{shortcode,comments_count,like_count,video_view_count,caption,comments{text,username,timestamp}}}`;
    let url = `https://graph.facebook.com/v19.0/${igBusinessId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`;

    console.log(`🔍 [Business Discovery] Fetching data for @${targetUsername}...`);
    let response;
    try {
      response = await axios.get(url);
    } catch (firstErr) {
      console.warn(`⚠️ [Business Discovery] Primary query failed, trying fallback without views...`);
      fields = `business_discovery.username(${targetUsername}){media{shortcode,comments_count,like_count,caption,comments{text,username,timestamp}}}`;
      url = `https://graph.facebook.com/v19.0/${igBusinessId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`;
      response = await axios.get(url);
    }

    const mediaList = response.data?.business_discovery?.media?.data || [];

    const targetMedia = mediaList.find(m => m.shortcode === targetShortcode);

    if (!targetMedia) {
      throw new Error(`Reel not found in @${targetUsername}'s recent posts. (Discovery only sees public business reels)`);
    }

    return {
      caption: targetMedia.caption,
      like_count: targetMedia.like_count,
      comments_count: targetMedia.comments_count,
      video_view_count: targetMedia.video_view_count || 0,
      comments: (targetMedia.comments?.data || []).map(c => ({
        text: c.text,
        author: c.username,
        timestamp: c.timestamp,
        platform: 'instagram'
      }))
    };
  } catch (error) {
    const errorData = error.response?.data?.error;
    console.error(`❌ [Business Discovery Error]:`, errorData || error.message);

    if (errorData?.code === 10 || errorData?.error_subcode === 2207013) {
      if (errorData?.message?.includes('permission')) {
        throw new Error(`Permission Denied: Your connected Instagram account does not have permission for Business Discovery. Ensure your account is a Business/Creator account and is properly linked to a Facebook Page.`);
      }
      throw new Error(`Privacy Restriction: @${targetUsername} is likely a Personal/Private account. Discovery only works for Public Business/Creator accounts.`);
    }

    if (errorData?.message?.includes('business_discovery')) {
      throw new Error(`Business Discovery failed. Ensure @${targetUsername} is a public Business/Creator account.`);
    }
    throw error;
  }
}

/**
 * Fetch Live Instagram Post Insights (Reach, Views, Likes, Comments)
 * Enhanced with permission fallback logic
 */
async function getInstagramPostInsights(igMediaId, accessToken, userToken = null) {
  const tryFetch = async (token) => {
    // 1. Fetch Basic Metrics (Likes, Comments)
    const basicUrl = `https://graph.facebook.com/v19.0/${igMediaId}?fields=like_count,comments_count,media_type&access_token=${token}`;
    const basicRes = await axios.get(basicUrl);
    const { like_count, comments_count, media_type } = basicRes.data;

    // 2. Fetch Insights (Reach, Impressions, Views)
    // Metrics vary based on media type. 'impressions' is restricted in v22+, so we use 'reach' as primary.
    let metrics = 'reach';
    if (media_type === 'VIDEO') metrics += ',video_views';

    const insightsUrl = `https://graph.facebook.com/v19.0/${igMediaId}/insights?metric=${metrics}&access_token=${token}`;
    const insightsRes = await axios.get(insightsUrl);

    const insights = {};
    insightsRes.data.data.forEach(item => {
      insights[item.name] = item.values[0].value;
    });

    return {
      likes: like_count || 0,
      comments: comments_count || 0,
      reach: insights.reach || 0,
      impressions: insights.impressions || 0,
      views: insights.video_views || 0,
      timestamp: new Date().toISOString()
    };
  };

  try {
    return await tryFetch(accessToken);
  } catch (error) {
    const errorData = error.response?.data?.error;
    // Subcode 33 or Code 100 often means the specific token lacks scope for this object
    if ((errorData?.code === 100 || errorData?.error_subcode === 33)) {
      console.error(`❌ [Instagram Critical Error] Object ID ${igMediaId} is INVISIBLE to your current token.`);
      console.log(`
      🚨 ACTION REQUIRED: YOUR TOKEN IS OUTDATED!
      1. Go to your Hub website -> Settings.
      2. Click DISCONNECT on Facebook/Instagram.
      3. Click RECONNECT.
      4. When the Facebook popup appears, click 'Edit Settings' and check ALL boxes.

      Note: Simply adding permissions in the Facebook Portal does NOT update your website.
      You MUST Re-Login in the Hub to get a fresh token with those new permissions.
      `);

      if (userToken) {
        console.warn(`⚠️ [Instagram] Retrying with User Access Token...`);
        try {
          return await tryFetch(userToken);
        } catch (innerError) {
          throw new Error('User Token also lacks access. Please reconnect account.');
        }
      }
    }
    throw new Error(errorData?.message || 'Failed to fetch Instagram insights');
  }
}

/**
 * Reply to an Instagram Comment
 */
async function replyToInstagramComment(commentId, message, accessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${commentId}/replies`;
    const response = await axios.post(url, null, {
      params: {
        message,
        access_token: accessToken
      }
    });
    return response.data;
  } catch (error) {
    const igError = error.response?.data?.error;
    console.error(`❌ Instagram Reply Error for ${commentId}:`, igError?.message || error.message);

    if (igError?.code === 100) {
      console.log(`💡 Tip: Your connection is missing 'instagram_manage_comments' permission.
      Go to Facebook App Settings -> Permissions and ensure 'instagram_manage_comments' is approved and granted during login.`);
    }

    throw new Error(igError?.message || 'Failed to post Instagram reply');
  }
}

module.exports = {
  handleInstagramPost,
  getInstagramFollowers,
  getInstagramComments,
  deleteInstagramPost,
  parseInstagramUrl,
  getGlobalMediaData,
  getInstagramPostInsights,
  replyToInstagramComment
};
