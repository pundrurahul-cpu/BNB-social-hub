const { analyzeLocalImage } = require('./services/ollamaService');
const fs = require('fs');

async function testVision() {
  console.log("👁️ Testing V1000 Local Vision...");

  // Note: This requires a 'test.jpg' in your server folder, or change the path
  const testImagePath = './test.jpg';

  if (!fs.existsSync(testImagePath)) {
    console.log("💡 To test, place a 'test.jpg' image in the server folder.");
    return;
  }

  try {
    const imageBuffer = fs.readFileSync(testImagePath);
    const result = await analyzeLocalImage(imageBuffer, "Describe what you see in this image in one sentence.");
    console.log("\n✅ Llava Response:", result);
  } catch (err) {
    console.error("❌ Vision Test Failed:", err.message);
  }
}

testVision();
