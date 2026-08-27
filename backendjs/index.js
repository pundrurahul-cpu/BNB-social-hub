const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const postRoutes = require('./routes/postRoutes');
const authRoutes = require('./routes/authRoutes');
const strategyRoutes = require('./routes/strategyRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const clientRoutes = require('./routes/clientRoutes');
const reelRoutes = require('./routes/reelRoutes');
const scheduler = require('./services/scheduler');
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5000;

// Improved CORS: Explicitly allow frontend origins
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true
}));

app.use(express.json());

// Global Error Handlers to prevent crashes from unhandled issues
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ CRITICAL: Uncaught Exception:', err.message);
  console.error(err.stack);
});

// Root Route for Health Check
app.get('/', (req, res) => {
  res.json({ status: 'active', version: 'V1000.1', message: 'BNB Master Server is Online' });
});

// Routes
app.use('/api', postRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/automation', strategyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/reels', reelRoutes);

async function checkSystemHealth() {
  console.log('🔍 Running System Diagnostics...');

  // 1. Check Supabase
  try {
    const { error } = await supabase.from('posts').select('id').limit(1);
    if (error) console.error('❌ Supabase Connection Failed:', error.message);
    else console.log('✅ Supabase Connection: SECURE');
  } catch (err) {
    console.error('❌ Supabase Error:', err.message);
  }

  // 2. Check Ollama & Models
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    console.log(`📡 Checking Local AI (Ollama) at ${ollamaUrl}...`);
    const response = await axios.get(`${ollamaUrl}/api/tags`).catch(e => {
        throw new Error(`Connection Refused at ${ollamaUrl}`);
    });

    if (response.data && response.data.models) {
        const models = response.data.models.map(m => m.name);
        console.log(`✅ Local AI (Ollama): ACTIVE`);

        const hasText = models.some(m => m.includes(process.env.OLLAMA_MODEL || 'llama3'));
        const hasVision = models.some(m => m.includes(process.env.OLLAMA_VISION_MODEL || 'llava'));

        console.log(`   - Text Model (${process.env.OLLAMA_MODEL || 'llama3'}): ${hasText ? 'READY' : 'NOT FOUND'}`);
        console.log(`   - Vision Model (${process.env.OLLAMA_VISION_MODEL || 'llava'}): ${hasVision ? 'READY' : 'NOT FOUND'}`);
    }
  } catch (err) {
    console.warn('⚠️  Local AI (Ollama): OFFLINE (Expected if not running locally).');
  }
}

app.listen(PORT, () => {
  console.log(`\n***************************************************`);
  console.log(`🚀 MASTER SERVER V1000.0 - SYSTEM REBOOT COMPLETE`);
  console.log(`📍 SERVER ACTIVE ON PORT: ${PORT}`);
  console.log(`⚙️  AI ENGINE: QUAD-FAILOVER (Local-First)`);
  console.log(`***************************************************\n`);
  checkSystemHealth();
  scheduler.start();
});
