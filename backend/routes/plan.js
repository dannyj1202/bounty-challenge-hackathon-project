import { Router } from 'express';
import { run as runPlanCommand } from '../services/commands/plan.js';

const router = Router();

// POST /api/plan/generate { userId, spread?: 'light'|'balanced'|'intensive' } -> reply, suggestions. No Azure required.
// spread: light=2 blocks/week, balanced=4, intensive=6; planning window = until furthest assignment due (cap 12 weeks).
router.post('/generate', async (req, res) => {
  const { userId, spread } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const validSpread = ['light', 'balanced', 'intensive'].includes(spread) ? spread : undefined;
  try {
    const result = await runPlanCommand({
      userId,
      messages: [{ role: 'user', content: '/plan' }],
      context: validSpread ? { spread: validSpread } : {},
      args: '',
    });
    const blocks = (result.structured?.blocks || []).map((b) => ({
      ...b,
      start: b.start ? String(b.start).slice(11, 16) : '',
      end: b.end ? String(b.end).slice(11, 16) : '',
    }));
    res.json({
      reply: result.reply,
      blocks,
      suggestions: result.suggestions || [],
      explanation: result.reply,
      spread: result.structured?.spread,
      planningDays: result.structured?.planningDays,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
