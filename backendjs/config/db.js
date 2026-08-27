const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/bnb_sentiment';
    await mongoose.connect(mongoUrl);
    console.log('✅ MongoDB Connected (Sentiment Engine Active)');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
  }
};

module.exports = connectDB;
