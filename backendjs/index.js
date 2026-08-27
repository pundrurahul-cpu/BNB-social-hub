// --- STEP 1: GLOBAL POLYFILLS (MUST BE LINE 1) ---
const ws = require('ws');
global.WebSocket = ws;
globalThis.WebSocket = ws;
// -------------------------------------------------

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

// Load Supabase after polyfills are applied
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173', 'http://frontendjs.test', 'https://frontendjs.test'],
  credentials: true
}));

app.use(express.json());

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n--- 🚀 BNB MASTER SERVER ACTIVE ---`);
  console.log(`✅ Port: ${PORT}`);
  console.log(`------------------------------------\n`);
});
