import { getDb } from "../../db/index.js";
import { msalApp, getScopes } from "./msalClient.js";
import { getCalendarEvents, createCalendarEvent } from "./calendar.graph.js";

/**
 * Minimal Graph request helper.
 * Some routes import graphRequest from msGraphService; exporting it prevents crashes.
 */
export async function graphRequest(accessToken, method, path, body) {
  const url = path.startsWith("http")
    ? path
    : `https://graph.microsoft.com/v1.0${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    method: method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph request failed: ${res.status} ${text}`);
  }

  // Some Graph endpoints return 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

function assertConfigured() {
  if (
    !process.env.ENTRA_CLIENT_ID ||
    !process.env.ENTRA_CLIENT_SECRET ||
    !process.env.ENTRA_REDIRECT_URI
  ) {
    throw new Error(
      "Missing Entra configuration (ENTRA_CLIENT_ID/SECRET/REDIRECT_URI)."
    );
  }
}

/** Redirect URI must match Azure app registration and be identical for authorize + token exchange (no trailing slash). */
function getRedirectUri() {
  const raw = process.env.ENTRA_REDIRECT_URI || "";
  return raw.trim().replace(/\/+$/, "") || null;
}

/**
 * Build Entra authorize URL.
 * state carries userId so we can store tokens on callback.
 */
export async function getAuthorizeUrl(state = "") {
  assertConfigured();
  if (!msalApp) {
    throw new Error("MSAL not initialized. Set USE_ENTRA_AUTH=true in .env");
  }
  const scopes = getScopes();
  const redirectUri = getRedirectUri();
  if (!redirectUri) throw new Error("ENTRA_REDIRECT_URI is empty");

  return msalApp.getAuthCodeUrl({
    scopes,
    redirectUri,
    state: String(state),
    prompt: "select_account",
  });
}

/**
 * Exchange OAuth code for tokens only (no DB store).
 */
export async function exchangeCodeOnly(code) {
  assertConfigured();
  if (!msalApp) {
    throw new Error("MSAL not initialized. Set USE_ENTRA_AUTH=true in .env");
  }
  const scopes = getScopes();
  const redirectUri = getRedirectUri();
  if (!redirectUri) throw new Error("ENTRA_REDIRECT_URI is empty");

  console.log("[auth] exchangeCodeOnly redirectUri=" + redirectUri + " scopesCount=" + scopes.length);

  try {
    const tokenResponse = await msalApp.acquireTokenByCode({
      code: String(code),
      scopes,
      redirectUri,
    });
    return tokenResponse;
  } catch (err) {
    const msg = err.message || String(err);
    const code = err.errorCode || err.code || "";
    const body = err.response?.body ?? err.body ?? "";
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    console.error("[auth] MSAL acquireTokenByCode failed:", {
      errorCode: code,
      message: msg,
      redirectUriUsed: redirectUri,
      responseBody: bodyStr ? bodyStr.slice(0, 500) : "(none)",
    });
    throw err;
  }
}

/**
 * Store token response in oauth_accounts for a given userId.
 */
export function storeTokensForUser(userId, tokenResponse) {
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
}

/**
 * Exchange OAuth code for tokens, store in oauth_accounts.
 */
export async function exchangeCodeForTokens(code, userId) {
  const tokenResponse = await exchangeCodeOnly(code);
  storeTokensForUser(userId, tokenResponse);
  return tokenResponse;
}

/**
 * Call Graph /me to get profile (mail, userPrincipalName, displayName).
 */
export async function getMe(accessToken) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Graph /me failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  return {
    mail: data.mail || null,
    userPrincipalName: data.userPrincipalName || null,
    displayName: data.displayName || null,
  };
}

/**
 * Get a valid access token from DB (no refresh logic for MVP).
 * If expired/null, user must reconnect.
 */
export function getStoredAccessToken(userId) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT accessToken, expiresAt FROM oauth_accounts WHERE userId = ? AND provider = 'microsoft'"
    )
    .get(String(userId));

  if (!row?.accessToken) return null;
  if (typeof row.expiresAt === "number" && row.expiresAt <= Date.now()) return null;

  return row.accessToken;
}

/**
 * Calendar exports (used by routes/calendar.js)
 */
export { getCalendarEvents, createCalendarEvent };
