# Phase 4 Copilot — Smoke Test Checklist

Use this checklist to verify Phase 4 Copilot integration (Azure OpenAI streaming + suggestions) works end-to-end.

## Prerequisites

- Backend running (e.g. `npm run dev` from repo root or `node server.js` in `backend/`)
- Frontend running (e.g. `npm run dev` in `frontend/`)
- Logged in with Microsoft Entra
- Copilot widget visible on Home (widgets include `copilot`)

## Checklist

### 1. `/help` fast response

- In the Copilot input, type `/help` and send.
- **Expected:** Response returns quickly (streaming or single chunk). Content mentions the 10 commands (e.g. /plan, /reschedule, /summarize, /flashcards, /quiz, /check, /tasks, /deadline, /notes).
- **Pass:** Yes / No

### 2. `/plan` returns pending suggestion(s)

- Type `/plan` and send.
- **Expected:** Copilot streams a reply. At the end, one or more **suggestion cards** appear below the message with type (e.g. `create_calendar_block`), label, and payload preview. Each card has **Accept** and **Reject** buttons.
- **Pass:** Yes / No

### 3. Streaming works (tokens appear progressively)

- Send any valid command (e.g. `/help` or `/summarize`).
- **Expected:** "Copilot is thinking…" appears immediately, then text streams in (tokens appear progressively). No long blank wait before full response.
- **Pass:** Yes / No

### 4. Azure disabled → fallback generator still works

- In `backend/.env`, comment out or remove Azure OpenAI vars (e.g. `AZURE_OPENAI_ENDPOINT` or `AZURE_OPENAI_API_KEY`). Restart backend.
- Send `/help` or `/plan`.
- **Expected:** Copilot still responds (using deterministic/mock fallback). No hard error; response may be shorter or template-like.
- **Pass:** Yes / No

### 5. Accept / Reject suggestions

- Send `/plan` (or any command that returns suggestions).
- **Reject:** Click **Reject** on one suggestion. It should disappear from that message.
- **Accept:** Click **Accept** on a suggestion (e.g. `create_calendar_block` or `create_task`). Suggestion disappears; Assignments (or Calendar) panel updates (new task or event).
- **Pass:** Yes / No

### 6. Command gating and safety

- Type a message **without** leading `/` (e.g. "hello") and send.
- **Expected:** Error or message: "Copilot only accepts commands starting with /".
- Try a disallowed/cheating-style prompt if you have one; it should be refused.
- **Pass:** Yes / No

---

## Quick commands reference

| Command     | Expectation                          |
|------------|--------------------------------------|
| `/help`    | Fast list of commands                |
| `/plan`    | Streamed reply + calendar suggestions|
| `/tasks`   | Streamed reply + task suggestions    |
| `/reschedule` | Streamed reply + suggestions     |
| `/summarize`, `/flashcards`, `/quiz`, `/check`, `/notes`, `/deadline` | Non-cheating, AI or fallback reply |

## Notes

- Do **not** commit or log `.env` or any secrets; all config is read from environment only.
- If streaming fails (e.g. Azure timeout), the backend falls back to the Phase 3 deterministic reply and still streams it in chunks so the UI behaves the same.

---

# Phase 4 Add-on: Azure Document Intelligence — Smoke Test

Use this checklist to verify document ingestion and command-gated Copilot with document source (noteId).

## Prerequisites

- Backend with `USE_AZURE_DOCUMENT_INTELLIGENCE=true` and `AZURE_DOCINTEL_*` set in `backend/.env` (or expect 503/502 on upload).
- Frontend and backend running; logged in.

## Checklist

### 1. Upload PDF → returns noteId

- In the Copilot panel, click **Upload PDF / image** and select a PDF (or PNG/JPG).
- **Expected:** After processing, "Active document: &lt;title&gt;" appears with a **Clear** button. No crash; if DI is disabled, a clear error (e.g. "Document Intelligence is disabled" or "Text extraction failed").
- With DI enabled: response from `POST /api/docs/ingest` returns `{ ok: true, noteId, title, chars }`.
- **Pass:** Yes / No

### 2. Run /summarize with noteId → summary returned

- With an active document set (from step 1), click the **/summarize** chip (or type `/summarize` and Send).
- **Expected:** Copilot runs on the extracted note content; summary is returned (streamed or single reply).
- **Pass:** Yes / No

### 3. Run /quiz with noteId → quiz returned

- With an active document set, click the **/quiz** chip (or type `/quiz` and Send).
- **Expected:** A quiz is generated from the document content; reply includes quiz ID and preview.
- **Pass:** Yes / No

### 4. Non-command message rejected

- Type a message **without** leading `/` (e.g. "hello") and click Send.
- **Expected:** Error/tip: "Commands only..." or "Copilot only accepts commands starting with /". No request sent to run a non-command.
- **Pass:** Yes / No

## Env (do not commit secrets)

- `USE_AZURE_DOCUMENT_INTELLIGENCE=true|false`
- `AZURE_DOCINTEL_ENDPOINT=`
- `AZURE_DOCINTEL_KEY=`
- `AZURE_DOCINTEL_MODEL=prebuilt-read` (default)
