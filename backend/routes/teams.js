import { Router } from 'express';
import * as msGraph from '../services/msGraphService/index.js';

const router = Router();

// POST /api/teams/post { userId, message } or GET deep link
router.post('/post', async (req, res) => {
  const { userId, message, channelId } = req.body || {};
  const accessToken = req.headers.authorization?.replace('Bearer ', '') || null;
  try {
    const result = await msGraph.postTeamsMessage({ userId, channelId, message, accessToken });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/teams/deep-link?userId=...
router.get('/deep-link', async (req, res) => {
  const userId = req.query.userId;
  const accessToken = req.headers.authorization?.replace('Bearer ', '') || null;
  try {
    const result = await msGraph.getTeamsDeepLink({ userId, accessToken });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
