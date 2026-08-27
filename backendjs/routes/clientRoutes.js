const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

const DEFAULT_CLIENTS = [
  { id: '1', name: 'OakTree Coffee', logo: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=100&h=100', theme: 'orange' },
  { id: '2', name: 'Acme Agency', logo: 'A', theme: 'indigo' },
  { id: '3', name: 'TechStart Inc.', logo: 'T', theme: 'blue' },
  { id: '4', name: 'Global Retail', logo: 'G', theme: 'emerald' }
];

/**
 * GET ALL CLIENTS
 * Fetches the list of active clients for selection in the UI.
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('⚠️  Database table "clients" not found, serving defaults.');
      return res.json(DEFAULT_CLIENTS);
    }
    res.json(data && data.length > 0 ? data : DEFAULT_CLIENTS);
  } catch (error) {
    console.error('Client Route Error:', error.message);
    res.json(DEFAULT_CLIENTS);
  }
});

/**
 * POST NEW CLIENT
 */
router.post('/', async (req, res) => {
  try {
    const { name, theme, logo } = req.body;
    const { data, error } = await supabase
      .from('clients')
      .insert([{ name, theme, logo }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE CLIENT
 */
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Client agency removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET SINGLE CLIENT DETAILS
 */
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*, client_strategies(*)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Client not found' });
  }
});

module.exports = router;
