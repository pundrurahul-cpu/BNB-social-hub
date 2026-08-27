const axios = require('axios');
const supabase = require('../supabaseClient');

/**
 * Fetch LinkedIn Profile or Organization details
 */
async function getLinkedInIdentity(accessToken) {
  try {
    const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.data;
  } catch (error) {
    console.error('LinkedIn Identity Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Post to LinkedIn (Supports Images and Text)
 */
async function createLinkedInPost(accessToken, personUrn, content, mediaUrl) {
  try {
    const url = 'https://api.linkedin.com/v2/ugcPosts';

    const body = {
      author: `urn:li:person:${personUrn}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: mediaUrl ? 'IMAGE' : 'NONE'
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    };

    if (mediaUrl) {
      // For a production app, you'd first register the upload and upload the binary.
      // This is a simplified version assuming the URL is accessible by LinkedIn's crawlers.
      body.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        description: { text: 'Post Image' },
        media: mediaUrl,
        title: { text: 'Media' }
      }];
    }

    const response = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    return response.data;
  } catch (error) {
    console.error('LinkedIn Post Error:', error.response?.data || error.message);
    throw error;
  }
}

async function handleLinkedInPost(post) {
  const { data: connections, error } = await supabase
    .from('connections')
    .select('*')
    .eq('platform', 'linkedin')
    .order('updated_at', { ascending: false });

  if (error || !connections || connections.length === 0) {
    throw new Error('No LinkedIn connection found');
  }

  const connection = connections[0];
  const result = await createLinkedInPost(
    connection.access_token,
    connection.platform_account_id,
    post.content,
    post.media_url
  );

  return {
    platform_post_id: result.id,
    author_urn: connection.platform_account_id
  };
}

/**
 * Fetch LinkedIn Post Comments
 */
async function getLinkedInComments(postUrn, accessToken) {
  try {
    const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`;
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.data.elements || [];
  } catch (error) {
    console.error('LinkedIn Comments Error:', error.response?.data || error.message);
    return [];
  }
}

module.exports = {
  handleLinkedInPost,
  getLinkedInComments,
  getLinkedInIdentity
};
