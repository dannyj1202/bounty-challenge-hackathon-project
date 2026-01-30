# Azure Hosting Plan

This document outlines how to host **Smart Study Copilot** on Azure for production.

## Overview

| Component | Azure service | Notes |
|-----------|---------------|--------|
| Frontend | Azure Static Web Apps | React/Vite build; global CDN |
| Backend API | Azure Functions (Node) or App Service | Map Express routes to Functions or run Express on App Service |
| Database | Azure SQL Database or Cosmos DB | Replace SQLite; run migrations |
| File uploads | Azure Blob Storage | For voice/notes attachments |
| Auth | Microsoft Entra ID | Already scaffolded (Entra OAuth) |

## Frontend: Azure Static Web Apps

1. Build the frontend: `cd frontend && npm run build` (output in `dist/`).
2. Create a Static Web App in Azure Portal (or via CLI).
3. Connect the repo; set build command `npm run build`, output location `dist`, app location `frontend`.
4. Set **API proxy** or **custom backend URL** to your API base URL (e.g. Azure Functions URL) so `/api/*` is forwarded.
5. Configure environment variables in SWA for `VITE_API_BASE` if you use a different API origin in production.

## Backend: Azure Functions (Node.js)

- **Option A – HTTP-triggered Functions:** Map each Express route to a Function (e.g. `auth`, `assignments`, `copilot`, etc.). Use a shared router or duplicate route logic into handlers. Use **Azure Functions Node.js** runtime; keep the same service modules (`copilotService`, `msGraphService`, etc.) and call them from handlers.
- **Option B – Single Function with Express:** Use **Azure Functions custom handler** or a single HTTP-triggered Function that loads Express and forwards the request. This keeps the existing Express app with minimal changes.

Example (Option B) sketch:

- Function: HTTP trigger, route `{*path}`.
- Handler: Start Express, forward `req.url` and body to Express; return Express response.

## Backend: Azure App Service (alternative)

- Deploy the Node.js backend as-is to App Service (e.g. zip deploy or GitHub Actions).
- Set **Start command:** `node server.js` (or `npm start`).
- Enable **CORS** with the Static Web App origin.
- Use **Application Settings** for all env vars (provider switches, Azure keys, Entra IDs).

## Database: Azure SQL / Cosmos DB

- **Azure SQL:** Replace `better-sqlite3` with `mssql` or `tedious`; run the same schema (tables: users, preferences, assignments, events, quizzes, quizAttempts, topicStats, feedback, notifications, checkins). Run migrations on deploy.
- **Cosmos DB:** Model the same entities; use a single container or multiple. Replace direct SQL with Cosmos client calls in a new `backend/db/cosmos.js` (or keep a thin adapter so routes stay unchanged).

## Blob Storage (file uploads)

- For voice recordings and optional file uploads in Notes, upload to **Azure Blob Storage** (e.g. container `uploads`).
- Backend: generate SAS or use managed identity to write; return URL or store reference in DB. Extend `POST /api/notes/transcribe` to accept a blob URL if needed.

## Environment variables in production

Set all variables from `.env.example` in the hosting environment:

- Provider switches: `USE_AZURE_OPENAI`, `USE_AZURE_SPEECH`, etc.
- Azure OpenAI, Speech, Translator, Search, Entra/Graph credentials.
- `FRONTEND_ORIGIN`: your Static Web App URL (e.g. `https://<app>.azurestaticapps.net`).
- `PORT`: leave default or set as required by the host.

## Summary

- **Frontend:** Azure Static Web Apps.
- **Backend:** Azure Functions (with Express or per-route handlers) or App Service.
- **Database:** Azure SQL or Cosmos DB (replace SQLite).
- **Files:** Azure Blob Storage for uploads.
- **Auth:** Microsoft Entra ID (OAuth flow already scaffolded; complete token exchange and store in production).
