const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const ws = require('ws');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Simplified cleaning: just remove quotes and whitespace
function cleanEnvValue(val) {
  if (!val) return null;
  return val.replace(/['"\r\n]/g, '').trim();
}

const supabaseUrl = cleanEnvValue(process.env.SUPABASE_URL);
const supabaseServiceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (supabaseUrl && supabaseServiceKey) {
  console.log('--- 🛡️ Supabase Connection Status ---');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Key Length: ${supabaseServiceKey.length} characters`);
  console.log(`Key verification: ${supabaseServiceKey.substring(0, 8)}...${supabaseServiceKey.slice(-5)}`);
  console.log('------------------------------------');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  },
  global: {
    fetch: (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)),
  },
  realtime: {
    websocket: ws,
  },
});

module.exports = supabase;
