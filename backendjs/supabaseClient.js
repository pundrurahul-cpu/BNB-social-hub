const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Definitive fix for Node.js 20 / Supabase Realtime
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: {
    transport: ws,
    params: { eventsPerSecond: 10 }
  },
  global: {
    headers: { 'x-application-name': 'bnb-social-hub' }
  }
});

module.exports = supabase;
