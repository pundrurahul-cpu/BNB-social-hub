const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { processPostComments } = require('../services/analyticsService');
const { getFacebookFollowers } = require('../services/facebookService');
const { getInstagramFollowers, parseInstagramUrl, getGlobalMediaData, getInstagramPostInsights, replyToInstagramComment } = require('../services/instagramService');
const { getLinkedInIdentity } = require('../services/linkedinService');
const { getPinterestFollowers } = require('../services/pinterestService');
const { analyzeCommentSentiment, generateSentimentReport, generateCommentReply } = require('../services/aiService');
const { replyToFacebookComment } = require('../services/facebookService');

/**
 * AI AUTO-REPLY TO ALL COMMENTS FOR A POST
 */
router.post('/auto-reply-all/:postId', async (req, res) => {
  const { postId } = req.params;
  try {
    // 1. Fetch Post and Brand Context
    const { data: post, error: postErr } = await supabase.from('posts').select('*').eq('id', postId).single();
    if (postErr || !post) return res.status(404).json({ error: 'Post not found' });

    const { data: strategy } = await supabase.from('client_strategies').select('brand_voice').eq('client_id', post.client_id).maybeSingle();
    const brandVoice = strategy?.brand_voice || "Professional";

    // 2. Fetch All Unreplied Comments for this post
    // SAFE FETCH: We fetch all comments and filter in code to handle missing "replied_at" column if necessary
    const { data: comments, error: commErr } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId);

    if (commErr) throw commErr;

    // Filter out comments already replied to (using existing columns or metadata if available)
    const unrepliedComments = comments.filter(c => !c.replied_at && !c.ai_reply_text);

    if (!unrepliedComments || unrepliedComments.length === 0) return res.json({ message: 'No new comments to reply to.' });

    // 3. Fetch Connections for tokens
    const { data: connections } = await supabase.from('connections').select('*').eq('client_id', post.client_id);

    const results = { successful: 0, failed: 0, details: [] };

    // 4. Process each comment
    for (const comment of unrepliedComments) {
      try {
        // Generate AI Reply
        const aiReply = await generateCommentReply(comment.text, post.content, brandVoice);

        // Find correct token and platform-specific reply method
        if (comment.platform === 'instagram') {
          const fbConn = connections?.find(c => c.platform === 'facebook');

          // Smarter Token Search
          const igAccount = fbConn?.metadata?.instagram_accounts?.find(a => a.id === post.metadata?.instagram?.page_id)
                         || fbConn?.metadata?.instagram_accounts?.[0];

          const token = igAccount?.page_access_token || post.metadata?.instagram?.page_access_token;
          const userToken = fbConn?.access_token;

          if (token) {
            try {
              await replyToInstagramComment(comment.platform_comment_id, aiReply, token);
            } catch (replErr) {
              if (userToken) {
                console.warn('⚠️ [Instagram] Primary token failed for reply, trying User Token...');
                await replyToInstagramComment(comment.platform_comment_id, aiReply, userToken);
              } else {
                throw replErr;
              }
            }
          } else {
            throw new Error('No valid Instagram access token found for this client.');
          }
        } else if (comment.platform === 'facebook') {
          const fbConn = connections?.find(c => c.platform === 'facebook');

          const page = fbConn?.metadata?.pages?.find(p => p.id === post.metadata?.facebook?.page_id)
                    || fbConn?.metadata?.pages?.[0];

          const token = page?.access_token || post.metadata?.facebook?.page_access_token;

          if (token) {
            await replyToFacebookComment(comment.platform_comment_id, aiReply, token);
          } else {
            throw new Error('No valid Facebook access token found for this client.');
          }
        }

        // Update local database safely
        try {
          await supabase.from('comments').update({
            ai_reply_text: aiReply,
            replied_at: new Date().toISOString()
          }).eq('id', comment.id);
        } catch (dbUpdateErr) {
          console.warn(`⚠️ [Auto-Reply] Reply sent, but DB update failed: ${dbUpdateErr.message}`);
        }

        results.successful++;
        results.details.push({ id: comment.id, status: 'success' });

      } catch (err) {
        console.error(`❌ Reply Fail for comment ${comment.id}:`, err.message);
        results.failed++;
        results.details.push({ id: comment.id, status: 'error', message: err.message });
      }
    }

    res.json(results);

  } catch (error) {
    console.error('Auto-Reply API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET LIVE PERFORMANCE FOR A POST
 */
router.get('/post-performance/:postId', async (req, res) => {
  const { postId } = req.params;
  try {
    // 1. Fetch Post from Supabase
    const { data: post, error: postErr } = await supabase.from('posts').select('*').eq('id', postId).single();
    if (postErr || !post) return res.status(404).json({ error: 'Post not found' });

    const metadata = post.metadata || {};
    const results = {};

    // 2. Fetch Connections (to get tokens)
    const { data: connections } = await supabase.from('connections').select('*').eq('client_id', post.client_id);

    // 3. Instagram Performance
    if (metadata.instagram && metadata.instagram.platform_post_id) {
      const fbConn = connections?.find(c => c.platform === 'facebook');
      const userToken = fbConn?.access_token; // Main User Access Token

      // Try to find the specific Instagram account token, or fall back to the first available IG token for that client
      const igAccount = fbConn?.metadata?.instagram_accounts?.find(a => a.id === metadata.instagram.page_id)
                        || fbConn?.metadata?.instagram_accounts?.[0];

      const igToken = igAccount?.page_access_token || metadata.instagram.page_access_token;

      if (!igToken) {
        console.error('❌ [Live Performance] No access token found for post:', postId);
      }

      try {
        const insights = await getInstagramPostInsights(metadata.instagram.platform_post_id, igToken, userToken);
        results.instagram = insights;

        // Sync back to database
        const updatedMetadata = { ...metadata };
        updatedMetadata.instagram = { ...updatedMetadata.instagram, ...insights };
        await supabase.from('posts').update({ metadata: updatedMetadata }).eq('id', postId);
      } catch (err) {
        console.error('IG Performance Sync Error:', err.message);
        results.instagram = { error: err.message };
      }
    }

    // 4. Facebook Performance
    if (metadata.facebook && metadata.facebook.platform_post_id) {
      // Basic implementation for FB (using Page access token)
      const fbConn = connections?.find(c => c.platform === 'facebook');
      const page = fbConn?.metadata?.pages?.find(p => p.id === metadata.facebook.page_id);

      if (page) {
        try {
          const fbUrl = `https://graph.facebook.com/v19.0/${metadata.facebook.platform_post_id}?fields=engagement,reach,impressions&access_token=${page.access_token}`;
          const fbRes = await axios.get(fbUrl);
          results.facebook = {
            likes: fbRes.data.engagement?.count || 0,
            reach: fbRes.data.reach || 0,
            impressions: fbRes.data.impressions || 0
          };

          // Sync
          const updatedMetadata = { ...metadata };
          updatedMetadata.facebook = { ...updatedMetadata.facebook, ...results.facebook };
          await supabase.from('posts').update({ metadata: updatedMetadata }).eq('id', postId);
        } catch (e) {
          results.facebook = { error: e.message };
        }
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Performance API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GLOBAL INSTAGRAM ANALYSIS (Business Discovery)
 */
router.post('/global-analysis', async (req, res) => {
  try {
    const { url, client_id } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // 1. Parse URL for username and shortcode
    const info = await parseInstagramUrl(url);
    if (!info || !info.shortcode) {
      return res.status(400).json({ error: 'Invalid Instagram URL. Please use a direct post or reel link.' });
    }

    // 2. Find a Business Connection for this client to act as the "Searcher"
    const { data: connection } = await supabase
      .from('connections')
      .select('*')
      .eq('platform', 'facebook')
      .eq('client_id', client_id)
      .single();

    if (!connection || !connection.metadata?.instagram_accounts?.length) {
      return res.status(400).json({ error: 'No Instagram Business account connected for this agency. Discovery requires a business connection.' });
    }

    const igBusinessId = connection.metadata.instagram_accounts[0].id;
    const token = connection.metadata.instagram_accounts[0].page_access_token;

    // If username is missing from URL (e.g., /p/shortcode), we might need it for Discovery.
    // Business Discovery MUST have a username.
    if (!info.username) {
      return res.status(400).json({ error: 'Instagram username could not be detected in URL. Please use a full link like instagram.com/username/p/abc/' });
    }

    // 3. Fetch Data from Instagram
    console.log(`🌍 [Global Intel] Fetching external post: ${info.shortcode} from @${info.username}`);
    const mediaData = await getGlobalMediaData(info.username, info.shortcode, igBusinessId, token);

    // 4. AI Sentiment Analysis
    const analyzedComments = [];
    const stats = { total: 0, positive: 0, negative: 0, neutral: 0 };

    for (const comment of mediaData.comments) {
      const analysis = await analyzeCommentSentiment(comment.text);
      if (analysis) {
        analyzedComments.push({ ...comment, ...analysis });
        stats.total++;
        stats[analysis.polarity_label]++;
      }
    }

    // 5. Generate AI Report
    const reportText = await generateSentimentReport(mediaData.caption || 'External Instagram Post', stats);

    res.json({
      success: true,
      data: {
        caption: mediaData.caption,
        metrics: {
          likes: mediaData.like_count,
          comments: mediaData.comments_count
        },
        report: reportText,
        stats: stats,
        comments: analyzedComments,
        username: info.username
      }
    });

  } catch (error) {
    console.error('Global Analysis Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET FOLLOWER STATS
 */
router.get('/followers', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = supabase.from('connections').select('*');

    if (client_id && client_id !== 'undefined' && client_id !== 'null') {
      query = query.eq('client_id', String(client_id));
    }

    const { data: connections, error } = await query;
    if (error) throw error;

    // Reset to 0 to show LIVE DATA ONLY
    const stats = { facebook: 0, instagram: 0, linkedin: 0, pinterest: 0, total: 0 };

    const promises = connections.map(async (conn) => {
      try {
        if (conn.platform === 'facebook') {
          // FB Page Followers
          const pages = conn.metadata?.pages || [];
          for (const page of pages) {
            const fbCount = await getFacebookFollowers(page.id, page.access_token);
            stats.facebook += fbCount;
          }

          // IG Followers (via Business accounts linked to FB Pages)
          const igAccounts = conn.metadata?.instagram_accounts || [];
          for (const ig of igAccounts) {
            const igCount = await getInstagramFollowers(ig.id, ig.page_access_token);
            stats.instagram += igCount;
          }
        } else if (conn.platform === 'pinterest') {
          const pinCount = await getPinterestFollowers(conn.access_token);
          stats.pinterest += pinCount;
        }
      } catch (err) {
        console.error(`Live Fetch Error (${conn.platform}):`, err.message);
      }
    });

    await Promise.all(promises);
    stats.total = stats.facebook + stats.instagram + stats.linkedin + stats.pinterest;

    console.log('📊 [Live Analytics] Aggregated Stats:', stats);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET OVERVIEW STATS (Reach, Likes, Post Count)
 */
router.get('/overview', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = supabase.from('posts').select('*');

    if (client_id && client_id !== 'undefined' && client_id !== 'null') {
      query = query.eq('client_id', String(client_id));
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    const stats = {
      facebook: { reach: 0, likes: 0 },
      instagram: { reach: 0, likes: 0 },
      linkedin: { reach: 0, likes: 0 },
      pinterest: { reach: 0, likes: 0 },
      totalReach: 0,
      totalLikes: 0,
      postCount: posts.length
    };

    // For simplicity, we aggregate from metadata if it exists,
    // or provide mock/simulated growth if live insights aren't available for every post
    posts.forEach(post => {
      const platforms = post.platforms || [];
      platforms.forEach(p => {
        const reach = post.metadata?.[p]?.reach || 0;
        const likes = post.metadata?.[p]?.likes || 0;
        if (stats[p]) {
          stats[p].reach += reach;
          stats[p].likes += likes;
          stats.totalReach += reach;
          stats.totalLikes += likes;
        }
      });
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET GLOBAL ANALYTICS SNAPSHOT
 * Aggregates follower counts across all connected platforms.
 */
router.get('/global-stats', async (req, res) => {
  try {
    const { data: connections, error } = await supabase.from('connections').select('*');
    if (error) throw error;

    const stats = {
      facebook: 0,
      instagram: 0,
      linkedin: 0,
      pinterest: 0,
      total_followers: 0
    };

    const promises = connections.map(async (conn) => {
      try {
        if (conn.platform === 'facebook') {
          // FB Page Followers
          const page = conn.metadata?.pages?.[0];
          if (page) {
            const count = await getFacebookFollowers(page.id, page.access_token);
            stats.facebook += count;
          }
          // IG Followers (if linked to FB)
          const ig = conn.metadata?.instagram_accounts?.[0];
          if (ig) {
            const count = await getInstagramFollowers(ig.id, ig.page_access_token);
            stats.instagram += count;
          }
        } else if (conn.platform === 'linkedin') {
          // Note: LinkedIn API for followers usually requires Page ID;
          // falling back to profile info for now or 0
          stats.linkedin += 0;
        } else if (conn.platform === 'pinterest') {
          const count = await getPinterestFollowers(conn.access_token);
          stats.pinterest += count;
        }
      } catch (err) {
        console.error(`Error fetching stats for ${conn.platform}:`, err.message);
      }
    });

    await Promise.all(promises);
    stats.total_followers = stats.facebook + stats.instagram + stats.linkedin + stats.pinterest;

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET ALL COMMENTS FOR A POST
 */
router.get('/comments/:postId', async (req, res) => {
  const { postId } = req.params;
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('commented_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * TRIGGER ANALYSIS for a Post
 */
router.post('/analyze-post/:postId', async (req, res) => {
  const { postId } = req.params;
  const { platforms } = req.body;
  try {
    const result = await processPostComments(postId, platforms);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET SENTIMENT SNAPSHOTS for a Post
 */
router.get('/report/:postId', async (req, res) => {
  const { postId } = req.params;
  try {
    const { data, error } = await supabase
      .from('sentiment_snapshots')
      .select('*')
      .eq('post_id', postId)
      .order('snapshot_date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * EXPORT CSV REPORT
 */
router.get('/export', async (req, res) => {
  try {
    const { client_id } = req.query;
    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    // 1. Fetch Client Info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', client_id)
      .single();

    const clientName = client ? client.name.replace(/\s+/g, '_') : 'client';

    // 2. Fetch All Posts
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false });

    if (postsError) throw postsError;

    // 3. Fetch Follower Stats (Logic borrowed from /followers)
    const { data: connections, error: connError } = await supabase
      .from('connections')
      .select('*')
      .eq('client_id', client_id);

    if (connError) throw connError;

    const followerStats = { facebook: 0, instagram: 0, linkedin: 0, pinterest: 0 };
    const promises = connections.map(async (conn) => {
      try {
        if (conn.platform === 'facebook') {
          const pages = conn.metadata?.pages || [];
          for (const page of pages) {
            const fbCount = await getFacebookFollowers(page.id, page.access_token);
            followerStats.facebook += fbCount;
          }
          const igAccounts = conn.metadata?.instagram_accounts || [];
          for (const ig of igAccounts) {
            const igCount = await getInstagramFollowers(ig.id, ig.page_access_token);
            followerStats.instagram += igCount;
          }
        } else if (conn.platform === 'pinterest') {
          const pinCount = await getPinterestFollowers(conn.access_token);
          followerStats.pinterest += pinCount;
        }
      } catch (err) {
        console.error(`Export Stats Error (${conn.platform}):`, err.message);
      }
    });
    await Promise.all(promises);

    // 4. Generate CSV
    let csvContent = '--- ACCOUNT OVERVIEW ---\n';
    csvContent += 'Platform,Followers\n';
    csvContent += `Facebook,${followerStats.facebook}\n`;
    csvContent += `Instagram,${followerStats.instagram}\n`;
    csvContent += `LinkedIn,${followerStats.linkedin}\n`;
    csvContent += `Pinterest,${followerStats.pinterest}\n\n`;

    csvContent += '--- POST DETAILS ---\n';
    csvContent += 'ID,Content,Platforms,Status,Scheduled For,Created At,Total Reach,Total Likes\n';

    posts.forEach(post => {
      const platforms = (post.platforms || []).join('; ');
      const scheduledFor = post.scheduled_for || 'N/A';
      const createdAt = post.created_at || 'N/A';

      let reach = 0;
      let likes = 0;
      post.platforms?.forEach(p => {
        reach += post.metadata?.[p]?.reach || 0;
        likes += post.metadata?.[p]?.likes || 0;
      });

      // Escape commas in content for CSV
      const escapedContent = `"${(post.content || '').replace(/"/g, '""')}"`;

      csvContent += `${post.id},${escapedContent},${platforms},${post.status},${scheduledFor},${createdAt},${reach},${likes}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=report_${clientName}_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const { getViralIndustryTrends, getRegionalViralTrends, INDUSTRY_SEEDS } = require('../services/viralService');

/**
 * GET REGIONAL VIRAL TRENDS
 */
router.get('/viral-trends/regional', async (req, res) => {
  try {
    const { country, state, district, industry, client_id } = req.query;
    if (!country || !state || !district || !client_id) {
      return res.status(400).json({ error: 'Missing parameters: country, state, district, and client_id are required' });
    }

    const trends = await getRegionalViralTrends(country, state, district, industry || "General", client_id);
    res.json(trends);
  } catch (error) {
    console.error('Regional Viral Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET GROWTH HISTORY (Snapshots)
 */
router.get('/growth-history', async (req, res) => {
  try {
    const { client_id } = req.query;
    const { data, error } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .eq('client_id', client_id)
      .order('snapshot_date', { ascending: true })
      .limit(30);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET VIRAL TRENDS BY INDUSTRY
 */
router.get('/viral-trends/:industry', async (req, res) => {
  try {
    const { industry } = req.params;
    const { client_id } = req.query;
    const trends = await getViralIndustryTrends(industry, client_id);
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET LIST OF INDUSTRIES
 */
router.get('/industries', (req, res) => {
  res.json(Object.keys(INDUSTRY_SEEDS));
});

module.exports = router;
