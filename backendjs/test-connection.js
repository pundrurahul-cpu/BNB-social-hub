const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.trim() : '';

console.log('--- Debugging Connection ---');
console.log('URL:', url);
console.log('Key Length:', key.length);
console.log('Key starts with:', key.substring(0, 10));

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('posts').select('count');
  if (error) {
    console.error('Connection Failed:', error.message);
    console.error('Hint:', error.hint);
  } else {
    console.log('Connection Successful! Posts count:', data);
  }
}

test();
