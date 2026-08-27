const axios = require('axios');
const supabase = require('../supabaseClient');

/**
 * Gets follower count for a Facebook Page
 */
async function getFacebookFollowers(pageId, pageAccessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${pageId}?fields=followers_count&access_token=${pageAccessToken}`;
    const response = await axios.get(url);
    return response.data.followers_count || 0;
  } catch (error) {
    console.error('Facebook Followers Fetch Error:', error.response?.data || error.message);
    return 0;
  }
}

/**
 * Gets insights for a specific Facebook post
 */
async function getFacebookPostInsights(postId, pageAccessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${postId}/insights?metric=post_impressions_unique,post_reactions_by_type_total&access_token=${pageAccessToken}`;
    const response = await axios.get(url);
    const data = response.data.data;

    const reach = data.find(m => m.name === 'post_impressions_unique')?.values[0]?.value || 0;
    const reactions = data.find(m => m.name === 'post_reactions_by_type_total')?.values[0]?.value || {};
    const totalLikes = Object.values(reactions).reduce((a, b) => a + b, 0);

    return { reach, likes: totalLikes };
  } catch (error) {
    console.error(`Facebook Insights Error for ${postId}:`, error.response?.data || error.message);
    return { reach: 0, likes: 0 };
  }
}

/**
 * Gets comments for a specific Facebook post
 * Handles permission issues by falling back to basic data
 */
async function getFacebookComments(postId, pageAccessToken) {
  if (!pageAccessToken) {
    console.error(`❌ Facebook Fetch Error: No Page Access Token found for post ${postId}`);
    return [];
  }

  // Attempt 1: Full fetch including author details
  try {
    const url = `https://graph.facebook.com/v19.0/${postId}/comments?fields=id,message,created_time,from,like_count&access_token=${pageAccessToken}`;
    const response = await axios.get(url);
    return response.data.data || [];
  } catch (error) {
    const fbError = error.response?.data?.error;

    // Check for Permission Errors (Code 200 or 403)
    if (fbError && (fbError.code === 200 || fbError.code === 403)) {
      console.warn(`⚠️ Permission restriction for FB post ${postId}. This usually requires 'pages_read_user_content'. Retrying with basic fields only...`);

      try {
        // Attempt 2: Fallback to basic fields (No 'from' field)
        const fallbackUrl = `https://graph.facebook.com/v19.0/${postId}/comments?fields=id,message,created_time,like_count&access_token=${pageAccessToken}`;
        const fallbackRes = await axios.get(fallbackUrl);
        return (fallbackRes.data.data || []).map(comment => ({
          ...comment,
          from: { name: 'Anonymous User' } // Placeholder for restricted author data
        }));
      } catch (fallbackError) {
        const finalError = fallbackError.response?.data?.error || fallbackError;
        console.error(`❌ Facebook Critical Permission Error: Your Page Access Token likely lacks 'pages_read_engagement'.`);
        console.error(`   Details:`, finalError.message || finalError);
      }
    } else {
      console.error(`❌ Facebook API Error for ${postId}:`, fbError || error.message);
    }
    return [];
  }
}

/**
 * Posts content and media to a Facebook Page
 */
async function postToFacebookPage(pageId, pageAccessToken, content, mediaUrl) {
  try {
    let url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    let params = {
      message: content,
      access_token: pageAccessToken
    };

    if (mediaUrl) {
      url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      params = {
        caption: content,
        url: mediaUrl,
        access_token: pageAccessToken
      };
    }

    const response = await axios.post(url, null, { params });
    return response.data;
  } catch (error) {
    console.error('Facebook API Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Deletes a post from Facebook Page
 */
async function deleteFacebookPost(fbPostId, pageAccessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${fbPostId}`;
    const response = await axios.delete(url, {
      params: { access_token: pageAccessToken }
    });
    return response.data;
  } catch (error) {
    console.error('Facebook Delete Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main function to handle Facebook posting
 */
async function handleFacebookPost(post) {
  const { data: connections, error } = await supabase
    .from('connections')
    .select('*')
    .eq('platform', 'facebook')
    .order('updated_at', { ascending: false });

  if (error || !connections || connections.length === 0) {
    throw new Error('No Facebook connection found');
  }

  const connection = connections[0];
  const pages = connection.metadata.pages;

  if (!pages || pages.length === 0) {
    throw new Error('No Facebook pages found for this account');
  }

  const targetPage = pages[0];

  console.log(`Posting to Facebook Page: ${targetPage.name}`);

  const result = await postToFacebookPage(
    targetPage.id,
    targetPage.access_token,
    post.content,
    post.media_url
  );

  return {
    platform_post_id: result.post_id || result.id,
    page_id: targetPage.id,
    page_access_token: targetPage.access_token
  };
}

/**
 * Reply to a Facebook Comment
 */
async function replyToFacebookComment(commentId, message, pageAccessToken) {
  try {
    const url = `https://graph.facebook.com/v19.0/${commentId}/comments`;
    const response = await axios.post(url, null, {
      params: {
        message,
        access_token: pageAccessToken
      }
    });
    return response.data;
  } catch (error) {
    const fbError = error.response?.data?.error;
    console.error(`❌ Facebook Reply Error for ${commentId}:`, fbError?.message || error.message);

    if (fbError?.code === 100 || fbError?.code === 200) {
      console.log(`💡 Tip: Your connection is missing 'pages_messaging' or 'pages_manage_metadata' permissions.
      Ensure these are approved in the Facebook Developer Portal.`);
    }

    throw new Error(fbError?.message || 'Failed to post Facebook reply');
  }
}

module.exports = {
  handleFacebookPost,
  deleteFacebookPost,
  getFacebookFollowers,
  getFacebookPostInsights,
  getFacebookComments,
  replyToFacebookComment
};
