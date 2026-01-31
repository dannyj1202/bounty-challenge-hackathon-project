import { Router } from 'express';
import { getCalendarEvents, createCalendarEvent } from '../services/msGraphService/index.js';

const router = Router();

/**
 * POST /api/calendar/sync
 * Body: { userId?, start?, end? }
 * Header: Authorization: Bearer <accessToken>  (optional)
 *
 * - If USE_MS_GRAPH !== 'true' OR token missing -> returns MOCK events
 * - If USE_MS_GRAPH === 'true' and token present -> returns real Outlook events via Graph
 */
router.post("/sync", async (req, res) => {
  try {
    const userId = req.body.userId || "demo";

    const now = new Date();
    const start = req.body.start || now.toISOString();
    const end =
      req.body.end ||
      new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // next 7 days

    const auth = req.headers.authorization || "";
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

    const events = await getCalendarEvents({ userId, start, end, accessToken });

    return res.json({
      ok: true,
      source: process.env.USE_MS_GRAPH === "true" && accessToken ? "outlook" : "mock",
      start,
      end,
      events
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * POST /api/calendar/create
 * Body: { userId?, subject, start, end, body? }
 * Header: Authorization: Bearer <accessToken> (optional)
 *
 * - Creates a calendar event in Outlook if Graph enabled + token present
 * - Otherwise creates a mock event (still demo-able)
 */
router.post("/create", async (req, res) => {
  try {
    const userId = req.body.userId || "demo";
    const { subject, start, end, body } = req.body;

    if (!subject || !start || !end) {
      return res.status(400).json({ ok: false, error: "subject, start, end are required" });
    }

    const auth = req.headers.authorization || "";
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

    const created = await createCalendarEvent({ userId, subject, start, end, body, accessToken });

    return res.json({
      ok: true,
      source: process.env.USE_MS_GRAPH === "true" && accessToken ? "outlook" : "mock",
      created
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
