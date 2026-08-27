const supabase = require('./supabaseClient');

async function checkUnreplied() {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .is('replied_at', null);

    if (error) throw error;
    console.log(`📋 Found ${data?.length || 0} unreplied comments.`);
    console.log("Unreplied Comments Details:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

checkUnreplied();
