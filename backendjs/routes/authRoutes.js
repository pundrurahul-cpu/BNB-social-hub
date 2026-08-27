const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const supabase = require('../supabaseClient');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

function cleanValue(val) {
  if (!val) return null;
  return val.replace(/['"\r\n]/g, '').trim().split(' ')[0];
}

const FB_APP_ID = cleanValue(process.env.FACEBOOK_APP_ID);
const FB_APP_SECRET = cleanValue(process.env.FACEBOOK_APP_SECRET);
const FB_REDIRECT_URI = cleanValue(process.env.FACEBOOK_REDIRECT_URL);

const LI_CLIENT_ID = cleanValue(process.env.LINKEDIN_CLIENT_ID);
const LI_CLIENT_SECRET = cleanValue(process.env.LINKEDIN_CLIENT_SECRET);
const LI_REDIRECT_URI = cleanValue(process.env.LINKEDIN_REDIRECT_URL);

const PIN_CLIENT_ID = cleanValue(process.env.PINTEREST_CLIENT_ID);
const PIN_CLIENT_SECRET = cleanValue(process.env.PINTEREST_CLIENT_SECRET);
const PIN_REDIRECT_URI = cleanValue(process.env.PINTEREST_REDIRECT_URL);

// GET all connected accounts
router.get('/connections', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a connection
router.delete('/connections/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('connections')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Connection removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * FACEBOOK & INSTAGRAM AUTH
 */
router.get('/facebook', (req, res) => {
  const { client_id } = req.query;
  const state = client_id || 'default';

  const scopes = [
    'public_profile',
    'pages_show_list',
    'pages_manage_posts',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'business_management'
  ].join(',');

  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}&scope=${scopes}&response_type=code&state=${state}`;
  console.log(`🔗 [Meta] Starting OAuth flow for client: ${state}`);
  res.redirect(url);
});

router.get('/facebook/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error) return res.redirect(`http://localhost:3000/settings?status=error`);

  const client_id = state && state !== 'default' ? state : null;

  try {
    const tRes = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
      params: { client_id: FB_APP_ID, redirect_uri: FB_REDIRECT_URI, client_secret: FB_APP_SECRET, code }
    });
    const accessToken = tRes.data.access_token;

    const lRes = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
      params: { grant_type: 'fb_exchange_token', client_id: FB_APP_ID, client_secret: FB_APP_SECRET, fb_exchange_token: accessToken }
    });
    const longLivedToken = lRes.data.access_token;

    const uMe = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${longLivedToken}&fields=id,name`);
    const pRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}`);

    const pages = pRes.data.data.map(p => ({
      ...p,
      picture_url: `https://graph.facebook.com/${p.id}/picture?type=large&access_token=${p.access_token}`
    }));

    const instagramAccounts = pages
      .filter(p => p.instagram_business_account)
      .map(p => ({
        ...p.instagram_business_account,
        linked_page_id: p.id,
        page_access_token: p.access_token
      }));

    await supabase.from('connections').upsert({
      client_id: client_id,
      platform: 'facebook',
      platform_account_id: uMe.data.id,
      platform_account_name: uMe.data.name,
      access_token: longLivedToken,
      metadata: {
        pages,
        instagram_accounts: instagramAccounts,
        profile_picture: `https://graph.facebook.com/${uMe.data.id}/picture?type=large&access_token=${longLivedToken}`
      },
      updated_at: new Date()
    }, { onConflict: 'platform, platform_account_id' });

    res.redirect(`http://localhost:3000/settings?connection=facebook&status=success&client_id=${client_id || ''}`);
  } catch (err) {
    res.redirect(`http://localhost:3000/settings?status=error`);
  }
});

/**
 * LINKEDIN AUTH
 */
router.get('/linkedin', (req, res) => {
  const { client_id } = req.query;
  const state = client_id || 'default';
  const scope = encodeURIComponent('openid profile w_member_social email');
  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LI_CLIENT_ID}&redirect_uri=${encodeURIComponent(LI_REDIRECT_URI)}&scope=${scope}&state=${state}`;
  res.redirect(url);
});

router.get('/linkedin/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error) return res.redirect(`http://localhost:3000/settings?status=error`);

  const client_id = state && state !== 'default' ? state : null;

  try {
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LI_CLIENT_ID,
        client_secret: LI_CLIENT_SECRET,
        redirect_uri: LI_REDIRECT_URI,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenResponse.data.access_token;
    const userResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    await supabase.from('connections').upsert({
      client_id: client_id,
      platform: 'linkedin',
      platform_account_id: userResponse.data.sub,
      platform_account_name: userResponse.data.name,
      access_token: accessToken,
      metadata: { profile_picture: userResponse.data.picture },
      updated_at: new Date()
    }, { onConflict: 'platform, platform_account_id' });
    res.redirect(`http://localhost:3000/settings?connection=linkedin&status=success&client_id=${client_id || ''}`);
  } catch (err) {
    res.redirect(`http://localhost:3000/settings?status=error`);
  }
});

/**
 * PINTEREST AUTH
 */
router.get('/pinterest', (req, res) => {
  const { client_id } = req.query;
  const state = client_id || 'default';
  const scopes = ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'].join(',');
  const url = `https://www.pinterest.com/oauth/?client_id=${PIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(PIN_REDIRECT_URI)}&scope=${scopes}&response_type=code&state=${state}`;
  console.log(`🔗 [Pinterest] Starting OAuth flow for client: ${state}`);
  res.redirect(url);
});

router.get('/pinterest/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error) return res.redirect(`http://localhost:3000/settings?status=error`);

  const client_id = state && state !== 'default' ? state : null;

  try {
    const authHeader = Buffer.from(`${PIN_CLIENT_ID}:${PIN_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await axios.post('https://api.pinterest.com/v5/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: PIN_REDIRECT_URI,
      }), { headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get User Profile
    const userRes = await axios.get('https://api.pinterest.com/v5/user_account', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    // Get Boards
    const boardsRes = await axios.get('https://api.pinterest.com/v5/boards', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    await supabase.from('connections').upsert({
      client_id: client_id,
      platform: 'pinterest',
      platform_account_id: userRes.data.username,
      platform_account_name: userRes.data.username,
      access_token: accessToken,
      metadata: {
        profile_picture: userRes.data.profile_image,
        boards: boardsRes.data.items || []
      },
      updated_at: new Date()
    }, { onConflict: 'platform, platform_account_id' });

    res.redirect(`http://localhost:3000/settings?connection=pinterest&status=success&client_id=${client_id || ''}`);
  } catch (err) {
    console.error('❌ Pinterest Auth Error:', err.response?.data || err.message);
    res.redirect(`http://localhost:3000/settings?status=error`);
  }
});

module.exports = router;
