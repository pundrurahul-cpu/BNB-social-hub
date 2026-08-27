const { createClient } = require('@supabase/supabase-js');
const path = require('path');
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;
