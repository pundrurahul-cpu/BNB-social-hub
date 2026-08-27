const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabaseClient');
const { parseInstagramUrl, getGlobalMediaData } = require('../services/instagramService');
const { analyzeCommentSentiment } = require('../services/aiService');

/**
 * GET ALL TRACKED REELS
 */
router.get('/', async (req, res) => {
  const { client_id } = req.query;
  try {
    let query = supabase.from('reel_tracker').select('*').order('created_at', { ascending: false });

    // Only filter by client_id if it's a valid string and not "undefined" or "null"
    if (client_id && client_id !== 'undefined' && client_id !== 'null') {
      query = query.eq('client_id', String(client_id));
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ GET Reels Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * START TRACKING A REEL
 */
router.post('/', async (req, res) => {
  const { url, client_id } = req.body;
  if (!url || !client_id) return res.status(400).json({ error: 'URL and client_id are required' });

  console.log(`📥 [Reel Intelligence] New Tracking Request: ${url}`);

  try {
    let info = await parseInstagramUrl(url);
    console.log(`🔍 [Reel Intelligence] Parsed Info:`, info);

    if (!info || !info.shortcode) {
      return res.status(400).json({ error: 'Invalid Instagram URL. Please use a direct post or reel link.' });
    }

    // Find Business Connection for Discovery
    const { data: connection } = await supabase
      .from('connections')
      .select('*')
      .eq('platform', 'facebook')
      .eq('client_id', client_id)
      .single();

    if (!connection || !connection.metadata?.instagram_accounts?.length) {
      throw new Error('Discovery requires a connected Instagram Business account.');
    }

    const igBusinessId = connection.metadata.instagram_accounts[0].id;
    const token = connection.metadata.instagram_accounts[0].page_access_token;

    // IF USERNAME IS MISSING: We must resolve it first
    if (!info.username) {
      console.log(`🔍 [Reel Intelligence] No username in URL. Attempting to resolve shortcode: ${info.shortcode}`);
      try {
        const oembedRes = await axios.get(`https://graph.facebook.com/v19.0/instagram_oembed`, {
          params: { url: `https://www.instagram.com/p/${info.shortcode}/`, access_token: token }
        });

        // Use author_name or author_url to find the username
        if (oembedRes.data && (oembedRes.data.author_name || oembedRes.data.author_url)) {
          let resolvedUsername = oembedRes.data.author_name;
          if (oembedRes.data.author_url) {
            const urlParts = oembedRes.data.author_url.split('/').filter(Boolean);
            resolvedUsername = urlParts[urlParts.length - 1];
          }
          info.username = resolvedUsername;
          console.log(`✅ [Reel Intelligence] Resolved username: @${info.username}`);
        } else {
          throw new Error('Could not resolve username from shortcode.');
        }
      } catch (err) {
        // Log the permission error but don't crash
        console.warn('⚠️ [Reel Intelligence] oEmbed resolution failed (Permission required).');

        return res.status(400).json({
          error: 'Due to Instagram privacy rules, short links cannot be auto-detected. Please copy the FULL URL from the browser bar that includes the username (e.g., instagram.com/nike/reel/abc/).'
        });
      }
    }

    // Check if already tracking
    const { data: existing } = await supabase
      .from('reel_tracker')
      .select('id')
      .eq('client_id', client_id)
      .eq('shortcode', info.shortcode)
      .maybeSingle();

    if (existing) return res.status(400).json({ error: 'This reel is already in your watchlist.' });

    // Fetch Initial Data
    const mediaData = await getGlobalMediaData(info.username, info.shortcode, igBusinessId, token);

    // Initial Sentiment Pass
    const stats = { total: 0, positive: 0, negative: 0, neutral: 0 };
    for (const comment of mediaData.comments.slice(0, 20)) { // Limit initial pass to 20 for speed
      const analysis = await analyzeCommentSentiment(comment.text);
      if (analysis) {
        stats.total++;
        stats[analysis.polarity_label]++;
      }
    }

    const { data, error } = await supabase.from('reel_tracker').insert([{
      client_id,
      url,
      shortcode: info.shortcode,
      username: info.username,
      caption: mediaData.caption,
      like_count: mediaData.like_count,
      comments_count: mediaData.comments_count,
      sentiment_stats: stats,
      last_analyzed_at: new Date()
    }]).select();

    if (error) throw error;
    res.status(201).json(data[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ANALYZE / REFRESH REEL DATA
 */
router.post('/:id/analyze', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: reel, error: fetchErr } = await supabase.from('reel_tracker').select('*').eq('id', id).single();
    if (fetchErr || !reel) throw new Error('Reel tracker not found');

    const { data: connection } = await supabase
      .from('connections')
      .select('*')
      .eq('platform', 'facebook')
      .eq('client_id', reel.client_id)
      .single();

    if (!connection) throw new Error('Connection lost. Please reconnect.');

    const igBusinessId = connection.metadata.instagram_accounts[0].id;
    const token = connection.metadata.instagram_accounts[0].page_access_token;

    const mediaData = await getGlobalMediaData(reel.username, reel.shortcode, igBusinessId, token);

    // Deep Analysis
    const stats = { total: 0, positive: 0, negative: 0, neutral: 0 };
    for (const comment of mediaData.comments) {
      const analysis = await analyzeCommentSentiment(comment.text);
      if (analysis) {
        stats.total++;
        stats[analysis.polarity_label]++;
      }
    }

    const { data: updated, error: updateErr } = await supabase.from('reel_tracker').update({
      like_count: mediaData.like_count,
      comments_count: mediaData.comments_count,
      sentiment_stats: stats,
      last_analyzed_at: new Date()
    }).eq('id', id).select();

    if (updateErr) throw updateErr;
    res.json(updated[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * REMOVE FROM WATCHLIST
 */
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('reel_tracker').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
