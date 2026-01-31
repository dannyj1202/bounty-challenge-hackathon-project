import { Router } from "express";
import { getDb } from "../db/index.js";
import {
  getStoredAccessToken,
  getCalendarEvents,
  createCalendarEvent,
} from "../services/msGraphService/index.js";

const router = Router();

/* -----------------------------
   Helpers
------------------------------ */

function ensureUser(db, userId) {
  if (!userId) throw new Error("userId required");
  const row = db.prepare("SELECT id FROM users WHERE id = ?").get(String(userId));
  if (row) return;

  db.prepare(
    "INSERT INTO users (id, email, role, displayName) VALUES (?, ?, 'student', ?)"
  ).run(String(userId), `${String(userId)}@local.dev`, String(userId));
}

function buildSourceId({ provider, graphId }) {
  // Must be unique per event for the unique index on (userId, sourceId)
  return `${provider}:${graphId}`;
}

function buildStableLocalId({ provider, graphId }) {
  // ✅ Must be stable across sync runs so ON CONFLICT(id) updates the same row
  return `ms:${provider}:${graphId}`;
}

function upsertLocalEventById(db, evt) {
  // ✅ Use ON CONFLICT(id) because id is PRIMARY KEY
  db.prepare(
    `
    INSERT INTO events (id, userId, title, startAt, endAt, type, sourceId)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId=excluded.userId,
      title=excluded.title,
      startAt=excluded.startAt,
      endAt=excluded.endAt,
      type=excluded.type,
      sourceId=excluded.sourceId
  `
  ).run(
    evt.id,
    evt.userId,
    evt.title,
    evt.startAt,
    evt.endAt,
    evt.type || "academic",
    evt.sourceId || null
  );
}

function normalizeGraphEvent(e) {
  const startAt = e?.start?.dateTime || e?.startAt || e?.startTime;
  const endAt = e?.end?.dateTime || e?.endAt || e?.endTime;

  return {
    graphId: e?.id,
    title: e?.subject || e?.title || "Outlook event",
    startAt,
    endAt,
  };
}

/* -----------------------------
   POST /api/calendar/sync
   Body: { userId, start, end }
------------------------------ */
router.post("/sync", async (req, res) => {
  const { userId, start, end } = req.body || {};
  if (!userId || !start || !end) {
    return res.status(400).json({ error: "userId, start, end required" });
  }

  const db = getDb();

  try {
    ensureUser(db, userId);

    const accessToken = getStoredAccessToken(userId);
    const provider = accessToken ? "outlook" : "mock-outlook";

    const graphEvents = await getCalendarEvents({
      userId,
      start,
      end,
      accessToken,
    });

    const normalized = (graphEvents || [])
      .map(normalizeGraphEvent)
      .filter((x) => x.graphId && x.startAt && x.endAt)
      .map((x) => {
        const sourceId = buildSourceId({ provider, graphId: x.graphId });
        const id = buildStableLocalId({ provider, graphId: x.graphId });

        return {
          id,
          userId: String(userId),
          title: x.title,
          startAt: x.startAt,
          endAt: x.endAt,
          type: "academic",
          sourceId, // unique per event
        };
      });

    normalized.forEach((evt) => upsertLocalEventById(db, evt));

    res.json({
      source: accessToken ? "outlook" : "mock",
      events: normalized,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -----------------------------
   POST /api/calendar/outlook/create
   Body: { userId, subject, start, end, body }
------------------------------ */
router.post("/outlook/create", async (req, res) => {
  const { userId, subject, start, end, body } = req.body || {};
  if (!userId || !subject || !start || !end) {
    return res.status(400).json({ error: "userId, subject, start, end required" });
  }

  const db = getDb();

  try {
    ensureUser(db, userId);

    const accessToken = getStoredAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({ error: "No Microsoft token stored. Please reconnect Microsoft login." });
    }

    const created = await createCalendarEvent({
      userId,
      subject,
      start,
      end,
      body,
      accessToken,
    });

    const graphId = created?.id;
    if (!graphId) {
      return res.status(500).json({ error: "Graph did not return an event id" });
    }

    const provider = "outlook";
    const sourceId = buildSourceId({ provider, graphId });
    const id = buildStableLocalId({ provider, graphId });

    const localEvent = {
      id,
      userId: String(userId),
      title: subject,
      startAt: start,
      endAt: end,
      type: "academic",
      sourceId,
    };

    upsertLocalEventById(db, localEvent);

    res.status(201).json({ ok: true, event: localEvent, raw: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
