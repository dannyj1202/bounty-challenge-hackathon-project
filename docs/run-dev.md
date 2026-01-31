# Running the app

## One command (recommended)

From the **project root** (not backend, not frontend):

```bash
npm run dev
```

This starts **both** backend (port 3001) and frontend (port 5173).  
Do **not** also run `cd backend && node server.js` in another terminal, or you’ll get **EADDRINUSE** on 3001.

---

## If you already have the backend running

If you started the backend in a separate terminal (`cd backend && node server.js`):

- **Stop** that process (Ctrl+C) and use `npm run dev` from the root, **or**
- **Keep** that backend and start **only** the frontend:

  From **project root**:
  ```bash
  npm run dev:frontend
  ```

  From **frontend** folder:
  ```bash
  npm run dev
  ```
  (There is no script named `frontend`; use `dev`.)

---

## Quick reference

| Goal              | Command (from project root)   |
|-------------------|-------------------------------|
| Backend + frontend| `npm run dev`                 |
| Frontend only     | `npm run dev:frontend`        |
| Backend only      | `cd backend && node server.js`|

If you see **EADDRINUSE :::3001**, something is already using port 3001. Stop the other backend process, then run again.
