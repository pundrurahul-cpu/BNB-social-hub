// 1. WebSocket Polyfill (MUST BE FIRST)
const ws = require('ws');
global.WebSocket = ws;
globalThis.WebSocket = ws;

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
const PORT = process.env.PORT || 5001;

// Improved CORS: Explicitly allow frontend origins
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://frontendjs.test',
    'https://frontendjs.test'
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n--- 🚀 BNB MASTER SERVER V1000.1 ---`);
  console.log(`✅ Status: ACTIVE`);
  console.log(`✅ Port: ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`------------------------------------\n`);
});
