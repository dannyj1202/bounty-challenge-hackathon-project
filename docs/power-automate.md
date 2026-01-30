# Power Platform: Power Automate Integration

Smart Study Copilot exposes webhook endpoints that **Power Automate** can call to trigger notifications or sync data. Optional extensions: **Power Apps**, **Dataverse**, **Power BI** for dashboards and low-code apps.

## Recommended flows

### 1. Deadline reminders
- **Trigger:** Recurrence (e.g. daily) or when assignment due date is within 24h (if using Dataverse/connectors).
- **Action:** HTTP POST to `POST /api/webhooks/power-automate/deadline-reminder`
- **Body:** `{ "userId": "...", "assignmentId": "...", "title": "Math homework", "dueDate": "2025-02-01" }`
- **Effect:** Creates a notification record for the user so they see it in the app.

### 2. Weekly summary
- **Trigger:** Recurrence (e.g. every Monday 8:00).
- **Action:** HTTP POST to `POST /api/webhooks/power-automate/weekly-summary`
- **Body:** `{ "userId": "...", "summary": "Your week: 3 assignments due, 2 study blocks completed." }`
- **Effect:** Stores a weekly summary notification.

### 3. Check-in reminders
- Use Power Automate to send an email or Teams message reminding users to check in; the app’s `POST /api/notifications/checkin` can be called when the user opens the app or via a “Check in” button that Power Automate could log.

### 4. Quiz streak nudges
- **Trigger:** When a user hasn’t taken a quiz in N days (e.g. from Dataverse or a scheduled flow that checks app data via API).
- **Action:** Send a nudge (email/Teams) and optionally call a custom webhook that creates a notification: extend the app with e.g. `POST /api/webhooks/power-automate/quiz-nudge` with `{ "userId": "..." }` and have the backend insert a notification.

## Webhook endpoints (implemented)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/power-automate/deadline-reminder` | POST | Store deadline reminder notification |
| `/api/webhooks/power-automate/weekly-summary` | POST | Store weekly summary notification |

These endpoints are simple: they accept JSON and insert into the `notifications` table. No auth is required in this MVP; in production, secure with shared secret or Azure AD.

## Optional extensions

- **Power Apps:** Build a companion app that calls the same REST API (auth with Entra ID) for quick “add assignment” or “view calendar.”
- **Dataverse:** Store assignments/events in Dataverse and sync with the app via Power Automate or custom connectors.
- **Power BI:** Use aggregated insights (e.g. from `GET /api/insights/university`) to build dashboards; ensure data remains aggregated and anonymized.
