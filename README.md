# Smart Study Copilot

Microsoft-powered AI Study Helper web app — **MVP**, runnable in **mock mode** without Azure credentials, with clear integration points for real Microsoft services.

## Tech stack

- **Frontend:** React + Vite + React Router; minimal CSS
- **Backend:** Node.js + Express
- **Storage:** SQLite (backend `data/copilot.db`)
- **CORS:** Enabled for local dev (`FRONTEND_ORIGIN`)

## Microsoft stack (provider switches)

Each integration can be toggled via environment variables; when `false` or unset, mock implementations are used.

| Capability | Env switch | Service module | Real when |
|------------|------------|----------------|-----------|
| Core AI | `USE_AZURE_OPENAI` | `backend/services/copilotService/` | Azure OpenAI credentials set |
| Speech-to-Text | `USE_AZURE_SPEECH` | `backend/services/speechService/` | `AZURE_SPEECH_KEY` + region |
| Translator | `USE_AZURE_TRANSLATOR` | `backend/services/translateService/` | `AZURE_TRANSLATOR_KEY` |
| RAG / Search | `USE_AZURE_SEARCH` | `backend/services/searchService/` | Search endpoint + key + index |
| Microsoft Graph (Calendar, OneNote, Teams, Files) | `USE_MS_GRAPH` | `backend/services/msGraphService/` | OAuth token provided |
| University login (Entra ID) | `USE_ENTRA_AUTH` | Auth routes + Graph OAuth | Entra app configured |

See **.env.example** for all variables.

## Setup

1. **Clone and install**
   ```bash
   npm run install:all
   ```
   Or manually:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Environment**
   - Copy `.env.example` to `backend/.env` (optional; defaults work for mock).
   - For real Azure/Microsoft: set the variables in `backend/.env`.

3. **Run locally (mock mode — no credentials needed)**
   ```bash
   npm run dev
   ```
   - Backend: http://localhost:3001  
   - Frontend: http://localhost:5173 (proxies `/api` to backend)

4. **Single commands**
   - Backend only: `npm run dev:backend`
   - Frontend only: `npm run dev:frontend`

## Demo flow

1. Open http://localhost:5173.
2. **Login:** Use “Sign in (mock)” with any email (e.g. `student@university.edu`) and role **Student** or **Admin**. Or click **Quick demo (seed data)** to create a user with sample assignments and events.
3. **Home:** 3-column dashboard — left: notifications + widgets; center: Copilot chat + action buttons; right: assignments. Add a task, open Copilot, mark a task complete (difficulty + comment in modal).
4. **Calendar:** Add personal events; see assignment due dates; click “Generate study schedule around my calendar” and **Accept** suggested blocks to create events.
5. **Quiz:** Enter topic, difficulty, number of questions → Generate → answer MCQs → Submit → see score, weak topics, suggestions; **Accept** suggestions (demo shows confirmation).
6. **Notes:** Paste text; use Summarize, Translate (language dropdown), Generate flashcards, Generate practice Qs; Voice record (mock); **Save to OneNote** (mock or real Graph when configured).
7. **Community:** Open Teams deep link; **Post question** (mock or Graph stub).
8. **Insights:** Visible only for **Admin**. View aggregated, anonymized university stats (engagement, feedback distribution, weak topics, workload weeks).
9. **Settings:** Widget toggles, notification preferences, monetization text.

## API routes (summary)

- **Auth:** `POST /api/auth/mock-login`, `GET /api/auth/entra/login`, `GET /api/auth/entra/callback`
- **User:** `GET/PUT /api/user/preferences`
- **Assignments:** `GET/POST/PUT/DELETE /api/assignments`, `POST /api/assignments/:id/complete`
- **Events:** `GET/POST/DELETE /api/events`
- **Plan:** `POST /api/plan/generate`
- **Copilot:** `POST /api/copilot/chat`
- **Quiz:** `POST /api/quiz/generate`, `POST /api/quiz/submit`
- **Notes:** `POST /api/notes/summarize`, `translate`, `flashcards`, `questions`, `transcribe`, `save-onenote`
- **Teams:** `POST /api/teams/post`, `GET /api/teams/deep-link`
- **Notifications:** `POST /api/notifications/checkin`, `GET /api/notifications`
- **Insights:** `GET /api/insights/student`, `GET /api/insights/university`
- **Webhooks:** `POST /api/webhooks/power-automate/deadline-reminder`, `weekly-summary`
- **Dev:** `POST /api/dev/seed`

## Backend service modules (mandatory structure)

- `backend/services/copilotService/` — index (mock vs azure-openai), copilot.mock.js, copilot.azureOpenAI.js
- `backend/services/speechService/` — index, speech.mock.js, speech.azure.js
- `backend/services/translateService/` — index, translate.mock.js, translate.azure.js
- `backend/services/searchService/` — index, search.mock.js, search.azureSearch.js
- `backend/services/msGraphService/` — index, graph.mock.js, graph.oauth.js, calendar.graph.js, onenote.graph.js, teams.graph.js, files.graph.js

All Graph methods work in mock mode; real OAuth/Graph is used when `USE_MS_GRAPH=true` and a valid token is provided (see TODOs in code).

## Data storage

SQLite DB: `backend/data/copilot.db`. Tables: users, preferences, assignments, events, quizzes, quizAttempts, topicStats, feedback, notifications, checkins. DB is created and migrated on backend startup. Seed: `POST /api/dev/seed`.

## Core principles

- **AI suggests, user controls:** Accept / edit / ignore everywhere (e.g. study blocks, quiz suggestions).
- **AI responses:** Include reply, explanation, confidence where applicable.
- **Privacy:** University insights are aggregated and anonymized; no raw individual student messages in insights.

## Power Platform

- **Power Automate:** See `docs/power-automate.md` for recommended flows (deadline reminders, weekly summary, check-in reminders, quiz nudges) and webhook endpoints.
- **Power Apps / Dataverse / Power BI:** Optional extensions; mentioned in the same doc.

## Azure hosting

See `docs/deployment.md` for:

- Azure Static Web Apps (frontend)
- Azure Functions or App Service (backend)
- Azure SQL / Cosmos DB (replace SQLite)
- Blob Storage (file uploads)

## TODOs in code

- Entra OAuth: complete token exchange in `GET /api/auth/entra/callback` and store session.
- Azure Speech: real-time or batch REST in `speech.azure.js` if needed.
- Graph: resolve team/channel for Teams deep link and post message when using real OAuth.
- OneNote: resolve default notebook/section in `onenote.graph.js` when using Graph.

Run locally in mock mode with `npm run dev`; no Azure credentials required.
