import { getDb } from "../../db/index.js";
import { msalApp, getScopes } from "./msalClient.js";

function assertConfigured() {
  if (!process.env.ENTRA_CLIENT_ID || !process.env.ENTRA_CLIENT_SECRET || !process.env.ENTRA_REDIRECT_URI) {
    throw new Error("Missing Entra configuration (ENTRA_CLIENT_ID/SECRET/REDIRECT_URI).");
  }
}

/**
 * Build Entra authorize URL.
 * state will carry our userId so we know where to store tokens on callback.
 */
export async function getAuthorizeUrl(state = "") {
  assertConfigured();

  const scopes = getScopes();

  return msalApp.getAuthCodeUrl({
    scopes,
    redirectUri: process.env.ENTRA_REDIRECT_URI,
    state: String(state),
    prompt: "select_account",
  });
}

/**
 * Exchange OAuth code for tokens, store in oauth_accounts.
 */
export async function exchangeCodeForTokens(code, userId) {
  assertConfigured();

  const scopes = getScopes();
  const tokenResponse = await msalApp.acquireTokenByCode({
    code: String(code),
    scopes,
    redirectUri: process.env.ENTRA_REDIRECT_URI,
  });

  const now = Date.now();
  const expiresAt = now + (tokenResponse.expiresIn ?? 3600) * 1000;

  const account = tokenResponse.account || {};
  const db = getDb();

  db.prepare(`
    INSERT INTO oauth_accounts
      (userId, provider, homeAccountId, tenantId, username, scopes, accessToken, expiresAt, createdAt, updatedAt)
    VALUES
      (?, 'microsoft', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(userId, provider) DO UPDATE SET
      homeAccountId=excluded.homeAccountId,
      tenantId=excluded.tenantId,
      username=excluded.username,
      scopes=excluded.scopes,
      accessToken=excluded.accessToken,
      expiresAt=excluded.expiresAt,
      updatedAt=excluded.updatedAt
  `).run(
    String(userId),
    account.homeAccountId || null,
    account.tenantId || null,
    account.username || null,
    (tokenResponse.scopes || []).join(" "),
    tokenResponse.accessToken,
    expiresAt,
    now,
    now
  );

  return tokenResponse;
}

/**
 * Helper: get a valid access token from DB (no refresh logic for hackathon MVP).
 * If expired, frontend should reconnect.
 */
export function getStoredAccessToken(userId) {
  const db = getDb();
  const row = db
    .prepare("SELECT accessToken, expiresAt FROM oauth_accounts WHERE userId = ? AND provider = 'microsoft'")
    .get(String(userId));

  if (!row?.accessToken) return null;
  if (typeof row.expiresAt === "number" && row.expiresAt <= Date.now()) return null;
  return row.accessToken;
}
