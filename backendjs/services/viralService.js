const axios = require('axios');
const supabase = require('../supabaseClient');
const { suggestRegionalSeeds } = require('./aiService');

const INDUSTRY_SEEDS = {
  'Real Estate': ['zillow', 'luxury_homes', 'the_real_houses_of_ig', 'ryan_serhant'],
  'Tech & AI': ['techcrunch', 'verge', 'openai', 'mkbhd', 'wired'],
  'Fashion & Beauty': ['vogue', 'sephora', 'hypebeast', 'nike', 'glossier'],
  'Education': ['ted', 'harvard_business_review', 'coursera', 'khanacademy'],
  'E-commerce': ['shopify', 'amazon', 'ebay', 'walmart'],
  'Hospitality': ['airbnb', 'bookingcom', 'fourseasons', 'marriott']
};

/**
 * Core Viral Engine - Scans a list of usernames
 */
async function performViralScan(seeds, clientId, contextLabel) {
  // 1. Get a Business Connection to act as the "Searcher"
  const { data: connection } = await supabase
    .from('connections')
    .select('*')
    .eq('platform', 'facebook')
    .eq('client_id', clientId)
    .single();

  if (!connection || !connection.metadata?.instagram_accounts?.length) {
    throw new Error('No Instagram Business account connected for this agency. Market Intelligence requires a business connection.');
  }

  const igBusinessId = connection.metadata.instagram_accounts[0].id;

  // Use User Access Token for broader search permissions if available
  const token = connection.access_token || connection.metadata.instagram_accounts[0].page_access_token;

  console.log(`🌐 [Viral Engine] Searching trends for ${contextLabel}...`);

  const allPosts = [];

  // 2. Scan Seed Accounts
  for (const username of seeds) {
    try {
      // Safe Query: Use only fields guaranteed to be supported in Business Discovery
      const fields = `business_discovery.username(${username}){followers_count,media{id,comments_count,like_count,media_url,media_type,caption,permalink,timestamp}}`;
      const url = `https://graph.facebook.com/v19.0/${igBusinessId}?fields=${encodeURIComponent(fields)}&access_token=${token}`;

      const res = await axios.get(url);
      const followers = res.data.business_discovery.followers_count || 1;
      const media = res.data.business_discovery.media?.data || [];

      // Calculate Viral Score (Engagement Rate)
      media.forEach(post => {
        const engagement = (post.like_count || 0) + (post.comments_count || 0);
        const viralScore = (engagement / followers) * 100;

        allPosts.push({
          ...post,
          username,
          viral_score: viralScore.toFixed(3),
          engagement,
          views: 0 // Views are not publicly available via Business Discovery API
        });
      });
    } catch (e) {
      const errorData = e.response?.data?.error;
      console.warn(`⚠️ [Viral Engine] Skip @${username}: ${errorData?.message || e.message}`);
    }
  }

  // 3. Sort by Viral Score (Top Performing Content)
  return allPosts
    .sort((a, b) => b.viral_score - a.viral_score)
    .slice(0, 12);
}

/**
 * Fetch Viral Inspiration for an Industry
 */
async function getViralIndustryTrends(industry, clientId) {
  const seeds = INDUSTRY_SEEDS[industry] || INDUSTRY_SEEDS['Tech & AI'];
  return await performViralScan(seeds, clientId, `industry: ${industry}`);
}

/**
 * Fetch Viral Inspiration for a Region AND Industry
 */
async function getRegionalViralTrends(country, state, district, industry, clientId) {
  // 1. Get regional seeds from AI filtered by Industry
  const seeds = await suggestRegionalSeeds(country, state, district, industry);
  console.log(`📍 [Regional Scan] Found ${seeds.length} seeds for ${industry} in ${district}: [${seeds.join(', ')}]`);

  return await performViralScan(seeds, clientId, `${industry} in ${district}, ${state}`);
}

module.exports = { getViralIndustryTrends, getRegionalViralTrends, INDUSTRY_SEEDS };
