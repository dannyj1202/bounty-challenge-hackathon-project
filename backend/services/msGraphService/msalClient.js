import 'dotenv/config';
import { ConfidentialClientApplication } from "@azure/msal-node";

const enabled = String(process.env.USE_ENTRA_AUTH || '').toLowerCase() === 'true';

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing in backend/.env`);
  return v;
}

export let msalApp = null;

if (enabled) {
  const tenant = process.env.ENTRA_TENANT_ID || 'common';
  msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: must('ENTRA_CLIENT_ID'),
      authority: `https://login.microsoftonline.com/${tenant}`,
      clientSecret: must('ENTRA_CLIENT_SECRET'),
    },
  });
}

export function getScopes() {
  const raw = process.env.GRAPH_SCOPES || 'openid,profile,offline_access,User.Read';
  const scopes = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Ensure OIDC scopes exist for sign-in
  for (const s of ['openid', 'profile', 'offline_access']) {
    if (!scopes.includes(s)) scopes.unshift(s);
  }
  return Array.from(new Set(scopes));
}
