const express = require('express');
const router = express.Router();
const { buildMonthlyStrategy } = require('../services/autoStrategyService');
const supabase = require('../supabaseClient');

/**
 * GET STRATEGY SETTINGS
 * Used by the UI to load existing client configurations.
 */
router.get('/settings/:client_id', async (req, res) => {
  const { client_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('client_strategies')
      .select('*')
      .eq('client_id', String(client_id))
      .maybeSingle();

    if (error) throw error;
    res.json(data || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * SAVE STRATEGY
 * Uses upsert to handle both first-time saves and updates.
 */
router.post('/save', async (req, res) => {
  const { client_id, id, ...strategyData } = req.body;
  if (!client_id) return res.status(400).json({ error: 'Missing client_id' });

  try {
    const payload = {
      ...strategyData,
      client_id: String(client_id),
      updated_at: new Date()
    };

    const { data, error } = await supabase
      .from('client_strategies')
      .upsert(payload, { onConflict: 'client_id' })
      .select();

    if (error) throw error;
    res.json({ message: 'Strategy saved successfully!', data: data[0] });
  } catch (error) {
    console.error('❌ Strategy Save Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * STRATEGY BRAIN TRIGGER
 */
const triggerBrain = async (req, res) => {
  const { client_id, month, year } = req.body;

  if (!client_id || !month || !year) {
    return res.status(400).json({ error: 'Missing parameters (client_id, month, year)' });
  }

  console.log(`🧠 [Route] Strategy Brain Triggered for Client: ${client_id}`);

  try {
    const result = await buildMonthlyStrategy(client_id, month, year);
    res.json({
      success: true,
      message: `Success! Generated ${result.count} unique content ideas.`,
      count: result.count
    });
  } catch (error) {
    console.error('❌ Strategy Brain Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

router.post('/plan-month', triggerBrain);
router.post('/smart-strategy', triggerBrain);

module.exports = router;
