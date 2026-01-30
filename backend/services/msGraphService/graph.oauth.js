/**
 * OAuth helper scaffolding for Microsoft Entra ID (Azure AD) + Graph.
 * TODO: Implement full OAuth2 flow: authorize URL, token exchange, refresh.
 * Requires: ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, ENTRA_TENANT_ID, ENTRA_REDIRECT_URI, GRAPH_SCOPES
 */

export function getAuthorizeUrl(state) {
  const tenant = process.env.ENTRA_TENANT_ID || 'common';
  const clientId = process.env.ENTRA_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ENTRA_REDIRECT_URI || '');
  const scopes = encodeURIComponent((process.env.GRAPH_SCOPES || 'User.Read Calendars.ReadWrite').split(',').map(s => s.trim()).join(' '));
  if (!clientId) throw new Error('ENTRA_CLIENT_ID required for OAuth');
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&response_mode=query&state=${encodeURIComponent(state || '')}`;
}

export async function exchangeCodeForTokens(code) {
  const tenant = process.env.ENTRA_TENANT_ID || 'common';
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const redirectUri = process.env.ENTRA_REDIRECT_URI;
  if (!clientId || !clientSecret || !code) throw new Error('OAuth: client id, secret, and code required');

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function graphRequest(accessToken, method, path, body) {
  const base = 'https://graph.microsoft.com/v1.0';
  const url = path.startsWith('http') ? path : `${base}/${path.replace(/^\//, '')}`;
  const opts = {
    method: method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Graph API error: ${res.status} ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}
