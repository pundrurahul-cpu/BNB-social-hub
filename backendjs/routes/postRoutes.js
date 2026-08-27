const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabaseClient');
const { enhanceContent } = require('../services/aiService');
const { handleFacebookPost, deleteFacebookPost, getFacebookFollowers } = require('../services/facebookService');
const { handleLinkedInPost } = require('../services/linkedinService');
const { handleInstagramPost, deleteInstagramPost, getInstagramFollowers } = require('../services/instagramService');
const { handlePinterestPost, deletePinterestPin, getPinterestFollowers } = require('../services/pinterestService');
const { generateVisualReference } = require('../services/imageService');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

/**
 * GENERATE STRATEGIC VISUAL REFERENCE
 * Automatically detects whether to make a conceptual graphic or a quote poster.
 */
router.post('/posts/:id/generate-visual', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Fetch Post Data
    const { data: post, error: postErr } = await supabase.from('posts').select('*').eq('id', id).single();
    if (postErr || !post) return res.status(404).json({ error: 'Post not found' });

    // 2. Fetch Brand Context
    const { data: client } = await supabase.from('clients').select('name').eq('id', post.client_id).single();
    const { data: strategy } = await supabase.from('client_strategies').select('*').eq('client_id', post.client_id).maybeSingle();

    const brandData = {
      clientName: client?.name || "Premium Brand",
      brandVoice: strategy?.brand_voice || "Professional",
      contentFocus: strategy?.content_focus || "General"
    };

    // 3. Generate Visual (Logic inside service handles Quote vs Concept)
    const visualUrl = await generateVisualReference(post, brandData);

    // 4. Update post with the new media_url
    const { error: updateErr } = await supabase.from('posts').update({ media_url: visualUrl }).eq('id', id);
    if (updateErr) throw updateErr;

    res.json({ success: true, media_url: visualUrl });
  } catch (error) {
    console.error('❌ Visual Generation Route Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * AI ENHANCER
 */
router.post('/ai/enhance', upload.single('image'), async (req, res) => {
  try {
    let imageBuffer;
    let mimeType;
    if (req.file) {
      imageBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body.image_url) {
      const response = await axios.get(req.body.image_url, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data, 'binary');
      mimeType = response.headers['content-type'] || 'image/jpeg';
    } else {
      return res.status(400).json({ error: 'No image provided' });
    }
    const result = await enhanceContent(imageBuffer, mimeType);
    res.json({ caption: result });
  } catch (error) {
    res.status(500).json({ error: 'AI Refiner busy.' });
  }
});

/**
 * DELETE POST
 */
router.delete('/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Fetch post metadata to get social media IDs
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. If published, attempt to delete from platforms
    if (post && post.status === 'published' && post.metadata) {
      const { facebook, instagram } = post.metadata;

      // NOTE: Instagram Graph API does NOT support deleting organic posts via third-party apps.
      // We skip the Instagram deletion to avoid "Insufficient Permissions" errors.
      if (instagram && instagram.platform_post_id) {
        console.log(`ℹ️ [Instagram] Manual deletion required for post: ${instagram.platform_post_id} (API restriction)`);
      }

      // Delete from Facebook if ID exists (Facebook DOES allow Page post deletion)
      if (facebook && facebook.platform_post_id) {
        console.log(`🗑️ [Facebook] Removing post: ${facebook.platform_post_id}`);
        await deleteFacebookPost(facebook.platform_post_id, facebook.page_access_token)
          .catch(e => console.error('FB Delete Fail:', e.message));
      }
    }

    // 3. Delete from Database
    const { error: deleteError } = await supabase.from('posts').delete().eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Post deleted from Hub and social platforms' });
  } catch (error) {
    console.error('❌ Delete Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POSTS MANAGEMENT: Create & Update (V1000 with Instant Trigger)
 */
router.post('/posts', upload.single('media'), async (req, res) => {
  console.log('\n📥 [V1000] Saving Post Request Received...');

  let {
    id, content, media_url, platforms, scheduled_at, status,
    client_id, user_id, funnel_stage, topic, is_placeholder,
    copy_direction, visual_idea, title
  } = req.body;

  try {
    const cleanClientId = (client_id && client_id !== 'null' && client_id !== 'undefined') ? String(client_id) : null;
    if (!cleanClientId) {
       return res.status(400).json({ error: "❌ NO CLIENT SELECTED. Please select a client first." });
    }

    // 1. Handle File Upload
    if (req.file) {
      console.log(`📸 [Storage] Uploading: ${req.file.originalname}`);
      const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (uploadError) throw new Error(`Photo Upload Failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(fileName);
      media_url = publicUrlData.publicUrl;
      console.log('✅ [Storage] Public URL generated');
    }

    // 2. Prepare Payload
    const postPayload = {
      content: content || '',
      media_url: (media_url && !media_url.startsWith('blob:')) ? media_url : null,
      platforms: typeof platforms === 'string' ? JSON.parse(platforms) : (platforms || []),
      scheduled_at: scheduled_at || new Date().toISOString(),
      status: status || 'draft',
      client_id: cleanClientId,
      is_placeholder: is_placeholder === 'true' || is_placeholder === true,
      funnel_stage: funnel_stage || null,
      topic: topic || null,
      copy_direction: copy_direction || null,
      visual_idea: visual_idea || null,
      metadata: { title: title || '' }
    };

    if (user_id && user_id !== 'null') postPayload.user_id = user_id;

    // 3. Save to Database
    let dbResponse;
    if (id && id !== 'null' && id !== 'undefined') {
      dbResponse = await supabase.from('posts').update(postPayload).eq('id', id).select();
    } else {
      dbResponse = await supabase.from('posts').insert([postPayload]).select();
    }

    if (dbResponse.error) throw dbResponse.error;
    const savedPost = dbResponse.data[0];

    // --- ⚡ INSTANT TRIGGER LOGIC ---
    if (status === 'published') {
      console.log('⚡ [Instant Trigger] Pushing to Social Media immediately...');
      const targetPlatforms = savedPost.platforms || [];
      const updatedMetadata = { ...savedPost.metadata };

      // Direct execution instead of waiting for scheduler
      if (targetPlatforms.includes('facebook')) {
        await handleFacebookPost(savedPost).then(res => updatedMetadata.facebook = res).catch(e => console.error('FB Instant Fail:', e.message));
      }
      if (targetPlatforms.includes('instagram')) {
        await handleInstagramPost(savedPost).then(res => updatedMetadata.instagram = res).catch(e => console.error('IG Instant Fail:', e.message));
      }
      if (targetPlatforms.includes('linkedin')) {
        await handleLinkedInPost(savedPost).then(res => updatedMetadata.linkedin = res).catch(e => console.error('LI Instant Fail:', e.message));
      }
      if (targetPlatforms.includes('pinterest')) {
        await handlePinterestPost(savedPost).then(res => updatedMetadata.pinterest = res).catch(e => console.error('Pin Instant Fail:', e.message));
      }

      // Update the record with social IDs
      await supabase.from('posts').update({ metadata: updatedMetadata }).eq('id', savedPost.id);
      console.log('✅ Social Handshake Complete');
    }

    console.log('✨ [Success] Post is processed!');
    res.status(201).json(savedPost);

  } catch (error) {
    console.error('❌ V1000 Server Error:', error.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

router.get('/posts', async (req, res) => {
  const { client_id } = req.query;
  try {
    let query = supabase.from('posts').select('*').order('scheduled_at', { ascending: true });
    if (client_id && client_id !== 'undefined' && client_id !== 'null') {
      query = query.eq('client_id', String(client_id));
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Fetch Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
