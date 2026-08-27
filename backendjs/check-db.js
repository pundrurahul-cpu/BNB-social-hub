const supabase = require('./supabaseClient');

async function runDiagnostics() {
  console.log("\n🔍 [V1000] Starting System Diagnostics...");

  // --- 1. DATABASE CHECK ---
  console.log("\n📊 Checking 'posts' table...");
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .limit(1);

    if (error) {
      console.error("❌ Database Error:", error.message);
      console.log("💡 Tip: Go to Supabase Dashboard -> Table Editor and make sure 'posts' exists.");
    } else {
      console.log("✅ Database Connection: SUCCESS");
      if (data && data.length > 0) {
        console.log("📋 Found Columns:", Object.keys(data[0]).join(', '));
      } else {
        console.log("ℹ️ Table 'posts' is empty. To see columns, add one row manually in Supabase.");
      }
    }
  } catch (err) {
    console.error("❌ Unexpected DB Error:", err.message);
  }

  // --- 2. STORAGE CHECK ---
  console.log("\n📦 Checking Storage Buckets (for photos)...");
  try {
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      console.error("❌ Storage Error:", bucketError.message);
    } else {
      const mediaBucket = buckets.find(b => b.name === 'media');
      if (mediaBucket) {
        console.log(`✅ 'media' bucket: FOUND (Public: ${mediaBucket.public})`);
        if (!mediaBucket.public) {
          console.warn("⚠️ WARNING: Bucket is PRIVATE. Go to Supabase -> Storage -> media -> Edit -> Set to PUBLIC.");
        }
      } else {
        console.error("❌ 'media' bucket: NOT FOUND");
        console.log("💡 FIX: Go to Supabase Dashboard -> Storage -> Create a bucket named exactly 'media' and set it to PUBLIC.");
      }
    }
  } catch (err) {
    console.error("❌ Unexpected Storage Error:", err.message);
  }
}

runDiagnostics();
