import { Router } from 'express';
import * as copilot from '../services/copilotService/index.js';

const router = Router();

// POST /api/copilot/chat { userId, messages, context }
router.post('/chat', async (req, res) => {
  const { userId, messages, context } = req.body || {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
  try {
    const result = await copilot.chat({ messages, context });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
