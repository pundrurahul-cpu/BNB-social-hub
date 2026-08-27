const axios = require('axios');
const supabase = require('../supabaseClient');

/**
 * Gets follower count for Pinterest Account
 */
async function getPinterestFollowers(accessToken) {
  try {
    const url = 'https://api.pinterest.com/v5/user_account';
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.data.follower_count || 0;
  } catch (error) {
    console.error('Pinterest Followers Fetch Error:', error.response?.data || error.message);
    return 0;
  }
}

/**
 * Gets insights for a Pinterest Pin
 */
async function getPinterestPinInsights(pinId, accessToken) {
  try {
    const url = `https://api.pinterest.com/v5/pins/${pinId}/analytics?statistics=SAVE,CLOSEUP,OUTBOUND_CLICK`;
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const stats = response.data.all || {};
    const reach = stats.CLOSEUP || 0;
    const likes = stats.SAVE || 0;
    return { reach, likes };
  } catch (error) {
    console.error(`Pinterest Insights Error for ${pinId}:`, error.response?.data || error.message);
    return { reach: 0, likes: 0 };
  }
}

/**
 * Deletes a Pin from Pinterest
 */
async function deletePinterestPin(pinId, accessToken) {
  try {
    const url = `https://api.pinterest.com/v5/pins/${pinId}`;
    await axios.delete(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return { success: true };
  } catch (error) {
    console.error('Pinterest Delete Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Creates a Pin on Pinterest
 */
async function createPinterestPin(boardId, accessToken, content, mediaUrl, title) {
  try {
    const url = 'https://api.pinterest.com/v5/pins';
    const data = {
      board_id: boardId,
      media_source: {
        source_type: 'image_url',
        url: mediaUrl
      },
      description: content,
      title: title || 'New Pin from BNB Social Hub'
    };

    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Pinterest API Error:', error.response?.data || error.message);
    throw error;
  }
}

async function handlePinterestPost(post) {
  const { data: connections, error } = await supabase
    .from('connections')
    .select('*')
    .eq('platform', 'pinterest')
    .order('updated_at', { ascending: false });

  if (error || !connections || connections.length === 0) {
    throw new Error('No Pinterest connection found');
  }

  const connection = connections[0];
  const accessToken = connection.access_token;
  const boardId = post.metadata?.pinterest_board_id || connection.metadata?.boards?.[0]?.id;

  if (!boardId) {
    throw new Error('No Pinterest board specified or found');
  }

  const result = await createPinterestPin(
    boardId,
    accessToken,
    post.content,
    post.media_url,
    post.title
  );

  return {
    platform_post_id: result.id,
    board_id: boardId
  };
}

module.exports = {
  handlePinterestPost,
  getPinterestFollowers,
  getPinterestPinInsights,
  deletePinterestPin
};
