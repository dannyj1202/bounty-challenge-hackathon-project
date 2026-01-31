import { Router } from "express";
import { getDb } from "../db/index.js";
import { getStoredAccessToken } from "../services/msGraphService/index.js";

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

async function graphRequest(accessToken, method, path, body) {
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    throw new Error(
      `Graph ${method} ${path} failed: ${res.status} ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }
  return data;
}

function pickLink(links) {
  return (
    links?.oneNoteWebUrl?.href ||
    links?.oneNoteClientUrl?.href ||
    null
  );
}

/* -----------------------------
   GET /api/onenote/notebooks?userId=...
------------------------------ */
router.get("/notebooks", async (req, res) => {
  const { userId } = req.query || {};
  if (!userId) return res.status(400).json({ error: "userId required" });

  const db = getDb();
  try {
    ensureUser(db, userId);

    const accessToken = getStoredAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({ error: "No Microsoft token stored. Please login with Microsoft first." });
    }

    const data = await graphRequest(
      accessToken,
      "GET",
      "/me/onenote/notebooks?$select=id,displayName,links"
    );

    const notebooks = (data?.value || []).map((n) => ({
      id: n.id,
      name: n.displayName,
      url: pickLink(n.links),
    }));

    res.json({ notebooks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -----------------------------
   GET /api/onenote/notebooks/:id/sections?userId=...
------------------------------ */
router.get("/notebooks/:id/sections", async (req, res) => {
  const { userId } = req.query || {};
  const { id } = req.params;

  if (!userId) return res.status(400).json({ error: "userId required" });
  if (!id) return res.status(400).json({ error: "notebook id required" });

  const db = getDb();
  try {
    ensureUser(db, userId);

    const accessToken = getStoredAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({ error: "No Microsoft token stored. Please login with Microsoft first." });
    }

    const data = await graphRequest(
      accessToken,
      "GET",
      `/me/onenote/notebooks/${encodeURIComponent(id)}/sections?$select=id,displayName,links`
    );

    const sections = (data?.value || []).map((s) => ({
      id: s.id,
      name: s.displayName,
      url: pickLink(s.links),
    }));

    res.json({ sections });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -----------------------------
   GET /api/onenote/sections/:id/pages?userId=...
------------------------------ */
router.get("/sections/:id/pages", async (req, res) => {
  const { userId } = req.query || {};
  const { id } = req.params;

  if (!userId) return res.status(400).json({ error: "userId required" });
  if (!id) return res.status(400).json({ error: "section id required" });

  const db = getDb();
  try {
    ensureUser(db, userId);

    const accessToken = getStoredAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({ error: "No Microsoft token stored. Please login with Microsoft first." });
    }

    const data = await graphRequest(
      accessToken,
      "GET",
      `/me/onenote/sections/${encodeURIComponent(id)}/pages?$select=id,title,links,lastModifiedDateTime&$top=50`
    );

    const pages = (data?.value || []).map((p) => ({
      id: p.id,
      title: p.title,
      url: pickLink(p.links),
      lastModifiedDateTime: p.lastModifiedDateTime,
    }));

    res.json({ pages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;