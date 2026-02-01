# Deploy in ~10 minutes

## 1. Backend (Render) — ~5 min

1. Go to **[render.com](https://render.com)** → Sign in with GitHub.
2. **New +** → **Blueprint** → Connect your repo **bounty-challenge-hackathon-project** (or your fork).
3. Render will read `render.yaml`. Click **Apply** to create the service.
4. Open the new **ecstudy-api** service → **Environment**.
5. Add **`FRONTEND_ORIGIN`** = `https://localhost:5173` for now (you’ll change it after step 2).
6. Wait for **Deploy** to finish (green). Copy the service URL, e.g. **`https://ecstudy-api.onrender.com`**.

---

## 2. Frontend (Vercel) — ~3 min

1. Go to **[vercel.com](https://vercel.com)** → Sign in with GitHub.
2. **Add New…** → **Project** → Import **bounty-challenge-hackathon-project**.
3. **Root Directory:** click **Edit** → choose **`frontend`** → **Continue**.
4. **Environment Variables:** Add:
   - **Name:** `VITE_API_ORIGIN`  
   - **Value:** your Render URL from step 1 (e.g. `https://ecstudy-api.onrender.com`)  
   Then add:
   - **Name:** `VITE_API_BASE`  
   - **Value:** same Render URL.
5. Click **Deploy**. Wait for the build. Copy your app URL, e.g. **`https://xxx.vercel.app`**.

---

## 3. Fix CORS (1 min)

1. Back in **Render** → **ecstudy-api** → **Environment**.
2. Change **`FRONTEND_ORIGIN`** to your **Vercel URL** from step 2 (e.g. `https://xxx.vercel.app`).
3. Save. Render will auto-redeploy.

---

## Done

- **App:** open your Vercel URL.
- **API:** requests go to your Render URL. First load after Render sleep may take ~30s.

If you use **Microsoft login**, add your Render URL in Azure Entra (Redirect URI: `https://YOUR-RENDER-URL/api/auth/microsoft/callback`) and set **`ENTRA_REDIRECT_URI`** and **`FRONTEND_ORIGIN`** in Render. See `docs/DEPLOYMENT_VERCEL.md` for details.
