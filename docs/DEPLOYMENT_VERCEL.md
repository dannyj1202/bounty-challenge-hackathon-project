# Step-by-Step: Deploy Smart Study Copilot (Vercel + Render)

This guide deploys the **frontend on Vercel** and the **backend on Render** (free tier). The backend is a Node/Express server with SQLite, so it needs a host that runs a long-lived process; Render’s free tier works well.

---

## Prerequisites

- [GitHub](https://github.com) account (repo already pushed)
- [Vercel](https://vercel.com) account (sign up with GitHub)
- [Render](https://render.com) account (sign up with GitHub)
- Your repo: `https://github.com/dannyj1202/bounty-challenge-hackathon-project` (or your fork)

---

## Part 1: Deploy the backend on Render

### 1.1 Create a Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account if needed, then select the repo: **bounty-challenge-hackathon-project** (or your repo name).
4. Configure the service:
   - **Name:** `ecstudy-api` (or any name).
   - **Region:** Choose closest to you.
   - **Branch:** `main`.
   - **Root Directory:** leave empty (repo root).
   - **Runtime:** `Node`.
   - **Build Command:**  
     `npm install && cd backend && npm install`
   - **Start Command:**  
     `cd backend && node server.js`
   - **Instance Type:** **Free** (or paid if you prefer).

### 1.2 Environment variables on Render

In the same Web Service, open **Environment** and add variables. Use the same names as in your local `backend/.env` (values can be placeholders for optional services).

**Required for minimal run:**

| Key | Value | Notes |
|-----|--------|--------|
| `NODE_ENV` | `production` | |
| `PORT` | `3001` | Render sets PORT automatically; 3001 is fine. |
| `FRONTEND_ORIGIN` | `https://YOUR_VERCEL_APP.vercel.app` | **Set this after you have the Vercel URL** (see Part 2). For now you can use `https://localhost:5173` and update later. |

**Optional (copy from `backend/.env` if you use them):**

- `USE_MS_GRAPH`, `USE_ENTRA_AUTH`
- `ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`
- `USE_AZURE_OPENAI`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`
- `USE_AZURE_SEARCH`, `AZURE_SEARCH_*`
- Any other keys from your `.env`

**Important:** Do **not** paste real secrets into this doc. Add them only in Render’s Environment UI.

### 1.3 Deploy and get the backend URL

1. Click **Create Web Service**.
2. Wait for the first deploy to finish (build + start).
3. Copy the service URL, e.g. `https://ecstudy-api.onrender.com` (or `https://ecstudy-api-xxxx.onrender.com`).  
   This is your **backend URL**; the frontend will call `https://<this-url>/api/...`.

### 1.4 (Optional) Persist SQLite on Render

Render’s free tier has **ephemeral disk**: the filesystem is reset on deploy or after idle. So SQLite data will not persist across deploys or restarts. For a demo or hackathon this is often acceptable. For persistent data you’d later switch to a hosted DB (e.g. PostgreSQL on Render) and change the app to use it; that’s beyond this guide.

---

## Part 2: Deploy the frontend on Vercel

### 2.1 Import the project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New…** → **Project**.
3. Import the Git repository: **bounty-challenge-hackathon-project** (or your repo). Authorize Vercel for GitHub if prompted.

### 2.2 Configure the frontend project

Vercel will detect a monorepo. Set:

- **Root Directory:** Click **Edit**, set to **`frontend`** (not the repo root).
- **Framework Preset:** Vite (should be auto-detected).
- **Build Command:** `npm run build` (default).
- **Output Directory:** `dist` (default).
- **Install Command:** `npm install` (default).

### 2.3 Environment variables for the API

In the same screen (or **Settings → Environment Variables**), add:

| Name | Value |
|------|--------|
| `VITE_API_ORIGIN` | `https://ecstudy-api.onrender.com` |
| `VITE_API_BASE` | `https://ecstudy-api.onrender.com` |

Use your **actual** Render backend URL from Part 1 (no trailing slash).  
- `VITE_API_ORIGIN` is used by the main API client and Community.  
- `VITE_API_BASE` is used by the Notes (OneNote) page.  
Setting both to the same backend URL makes all API calls go to your deployed backend.

### 2.4 Deploy

1. Click **Deploy**.
2. Wait for the build to finish. Vercel will show a URL like `https://bounty-challenge-hackathon-project-xxxx.vercel.app`.

### 2.5 Point the backend at the frontend (CORS)

1. Copy your **Vercel app URL** (e.g. `https://bounty-challenge-hackathon-project-xxxx.vercel.app`).
2. In **Render** → your Web Service → **Environment**:
   - Set **`FRONTEND_ORIGIN`** to that Vercel URL (no trailing slash).
   - If you already had a placeholder, replace it.
3. Save. Render will redeploy automatically so CORS allows your Vercel origin.

---

## Part 3: Microsoft Entra / Auth (if you use login with Microsoft)

If you use Entra (Microsoft) login:

1. **Azure Portal** → your Entra app registration → **Authentication**:
   - Add **Redirect URI:**  
     `https://ecstudy-api.onrender.com/api/auth/microsoft/callback`  
     (replace with your real Render backend URL if different.)
   - Add your Vercel frontend URL as a SPA redirect if required.
2. In **Render** env, set **`ENTRA_REDIRECT_URI`** to:  
   `https://ecstudy-api.onrender.com/api/auth/microsoft/callback`
3. Ensure **`FRONTEND_ORIGIN`** on Render is exactly your Vercel URL so the auth flow can redirect back to the app.

---

## Part 4: Verify deployment

1. **Frontend:** Open your Vercel URL. You should see the app (e.g. landing or login).
2. **Backend:** Open `https://<your-render-url>/api/community` (or another public route). You should get JSON, not a 404.
3. **Full flow:** Log in (mock or Microsoft if configured), open Dashboard, Calendar, Notes, etc. Check the browser Network tab: API requests should go to `https://<render-url>/api/...`.

---

## Quick reference

| What | Where |
|------|--------|
| Frontend URL | Vercel project URL (e.g. `https://….vercel.app`) |
| Backend URL | Render Web Service URL (e.g. `https://ecstudy-api.onrender.com`) |
| Frontend env | `VITE_API_ORIGIN` = backend URL |
| Backend env | `FRONTEND_ORIGIN` = frontend URL (for CORS and auth redirects) |

---

## Troubleshooting

- **CORS errors in browser:**  
  Ensure `FRONTEND_ORIGIN` on Render exactly matches the Vercel URL (no trailing slash, correct `https`).

- **API calls go to localhost:**  
  Rebuild the frontend on Vercel after setting `VITE_API_ORIGIN` (Vite bakes env into the build). Trigger a new deploy if needed.

- **Backend 503 or “service unavailable”:**  
  On Render free tier, the service may sleep after inactivity. The first request after sleep can take 30–60 seconds; subsequent requests are fast.

- **Auth redirect fails:**  
  Confirm `ENTRA_REDIRECT_URI` and the redirect URI in Azure match the Render backend URL and path `/api/auth/microsoft/callback`.

---

## Summary

1. **Render:** New Web Service, repo root, build `npm install && cd backend && npm install`, start `cd backend && node server.js`, set `FRONTEND_ORIGIN` (and optionally `ENTRA_REDIRECT_URI` and other env vars).
2. **Vercel:** New Project, root **`frontend`**, build `npm run build`, set `VITE_API_ORIGIN` to your Render URL.
3. Set **`FRONTEND_ORIGIN`** on Render to your Vercel URL.
4. Optionally configure Entra redirect URIs and env for Microsoft login.

After that, the site is live: frontend on Vercel, backend on Render.
