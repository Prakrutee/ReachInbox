# ReachInbox.ai 🚀

> **AI-powered email outreach platform** — smart scheduling, Groq AI generation, BullMQ rate limiting, and real-time analytics.

[![Deploy Frontend](https://github.com/Prakrutee/ReachInbox/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Prakrutee/ReachInbox/actions/workflows/deploy-pages.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?logo=github)](https://prakrutee.github.io/ReachInbox/)

---

## 🌍 Live Deployment

| Component | URL |
|---|---|
| **Frontend (GitHub Pages)** | https://prakrutee.github.io/ReachInbox/ |
| **Backend API (local Docker + tunnel)** | https://nam-mentor-robust-title.trycloudflare.com |
| **Health Check** | https://nam-mentor-robust-title.trycloudflare.com/api/health |
| **Bull Board Queue UI** | https://nam-mentor-robust-title.trycloudflare.com/admin/queues |

> **Note:** The Cloudflare tunnel URL is temporary and only active while Docker Desktop is running locally. The GitHub Pages frontend will show "API Offline" if the tunnel is down — click the status pill to configure a new backend URL without redeploying.

---

## ✨ Features

- 🤖 **Groq AI Email Generation** — generate full email subjects + bodies using `openai/gpt-oss-120b` from a topic, tone, and audience
- 📅 **BullMQ Delayed Job Scheduling** — no cron, no polling; jobs are delayed to the exact scheduled timestamp
- 🛡️ **Per-Sender Rate Limiting** — Redis INCR enforces `MAX_EMAILS_PER_HOUR`; excess jobs are rescheduled to the next window, never dropped
- 📬 **Zero-Config Email Delivery** — Ethereal SMTP credentials are auto-provisioned if not set; preview URLs logged per send
- 📊 **Bull Board UI** — real-time queue dashboard showing waiting, delayed, active, completed, failed jobs
- 🔍 **Elasticsearch Search** — optional full-text search on recipient/subject/body
- 🔔 **Slack Notifications** — webhook alerts when rate limits are hit
- 🔐 **Google OAuth** — optional; dashboard also supports instant demo-mode login
- 💪 **Resilient Architecture** — in-memory fallback when Postgres/Redis not available; no crashes on missing env vars
- 🔄 **Live API Status Indicator** — dashboard shows real-time backend health + Groq AI status; click to change the backend URL

---

## 🏗️ Architecture

```
  User Browser
      │ React + Tailwind (GitHub Pages Static Site)
      │ HTTPS REST API calls
      ▼
  ┌─────────────────────┐
  │   Express.js API    │  ← port 10000 (Docker) / Render Web Service
  │   + Bull Board UI   │
  │   + Passport OAuth  │
  └──────────┬──────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
┌──────────┐    ┌──────────┐
│ Postgres │    │  Redis   │  ← BullMQ job queue
│ (emails, │    │  + Rate  │
│  users,  │    │  Limits  │
│ sessions)│    └────┬─────┘
└──────────┘         │ BullMQ Delayed Jobs
                      ▼
             ┌──────────────────────┐
             │   BullMQ Worker      │  ← Render Background Worker
             │  - Sends via SMTP    │
             │  - Rate limits Redis │
             │  - ES indexing       │
             │  - Slack alerts      │
             └──────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **BullMQ delayed jobs** (not cron) | Jobs survive restarts; zero duplicate risk via jobId = email UUID |
| **Conditional DB update** for idempotency | `UPDATE WHERE status='scheduled'` — concurrent workers safely skip already-claimed jobs |
| **`env_file` for Docker secrets** | API keys never hardcoded in source; loaded from `.env` at runtime |
| **Ethereal auto-provisioning** | Zero-config email delivery for demos and local dev |
| **In-memory fallback** | Postgres/Redis optional for local dev; never crashes on missing infra |

---

## 🚀 Quick Start — Docker (Recommended)

```bash
# Clone
git clone https://github.com/Prakrutee/ReachInbox.git
cd ReachInbox

# Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env — set GROQ_API_KEY at minimum

# Start full backend stack (Postgres + Redis + API + Worker)
docker compose up -d --build

# Verify
curl http://localhost:10001/api/health
# → {"status":"ok","db":"ok","groq":"active"}

# Start frontend dev server
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

---

## 🛠️ Manual Local Setup

### Backend
```bash
cd backend
cp .env.example .env          # fill in values
npm install
npm run dev                   # API server on :10000
# in a second terminal:
npm run dev:worker            # BullMQ worker process
```

### Frontend
```bash
cd frontend
cp .env.example .env          # set VITE_API_BASE_URL if needed
npm install
npm run dev                   # Vite on :5173
```

---

## ☁️ Render Deployment

1. Push code to GitHub
2. In Render: **New → Blueprint** → connect `Prakrutee/ReachInbox`
3. Render reads `render.yaml` and auto-creates:
   - `reachinbox-db` — Postgres
   - `reachinbox-redis` — Redis
   - `reachinbox-api` — Express API (web service)
   - `reachinbox-worker` — BullMQ worker (background worker)
   - `reachinbox-frontend` — React static site
4. **Manually set these env vars** in the Render dashboard for `reachinbox-api` and `reachinbox-worker`:

| Variable | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq API key |
| `FRONTEND_URL` | Your GitHub Pages or Render frontend URL |
| `GOOGLE_CLIENT_ID` | *(optional)* Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *(optional)* Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | `https://your-api.onrender.com/auth/google/callback` |
| `SLACK_CLIENT_ID` | *(optional)* Slack app client ID |
| `SLACK_CLIENT_SECRET` | *(optional)* Slack app client secret |
| `SLACK_REDIRECT_URI` | `https://your-api.onrender.com/auth/slack/callback` |
| `ETHEREAL_USER` | *(optional — auto-provisioned)* |
| `ETHEREAL_PASSWORD` | *(optional — auto-provisioned)* |

5. After deploy, visit the frontend and click the **API status pill** → enter your Render API URL.

---

## 🔑 Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Default / Required |
|---|---|---|
| `PORT` | API server port | `10000` |
| `DATABASE_URL` | Postgres connection string | Required |
| `REDIS_URL` | Redis URL (`redis://` or `rediss://`) | Required |
| `SESSION_SECRET` | Express session secret | Required |
| `FRONTEND_URL` | Frontend origin for CORS | Required |
| `GROQ_API_KEY` | Groq API key for AI generation | Required for AI |
| `GROQ_MODEL` | Groq model ID | `openai/gpt-oss-120b` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Optional |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback | Optional |
| `SLACK_CLIENT_ID` | Slack app client ID | Optional |
| `SLACK_CLIENT_SECRET` | Slack app secret | Optional |
| `SLACK_REDIRECT_URI` | Slack OAuth redirect | Optional |
| `ETHEREAL_HOST` | SMTP host | `smtp.ethereal.email` |
| `ETHEREAL_PORT` | SMTP port | `587` |
| `ETHEREAL_USER` | SMTP user | Auto-provisioned if empty |
| `ETHEREAL_PASSWORD` | SMTP password | Auto-provisioned if empty |
| `ELASTICSEARCH_URL` | Elasticsearch URL | Optional |
| `CONCURRENCY` | Worker concurrency | `5` |
| `MIN_EMAIL_DELAY_MS` | Min delay between sends | `2000` |
| `MAX_EMAILS_PER_HOUR` | Rate limit per sender/hour | `20` |

---

## 📋 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (db + groq status) |
| `GET` | `/api/auth/me` | Get current authenticated user |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/auth/google` | Start Google OAuth |
| `GET` | `/auth/google/callback` | Google OAuth callback |
| `GET` | `/api/emails/scheduled` | List scheduled emails |
| `GET` | `/api/emails/sent` | List sent/failed emails |
| `GET` | `/api/emails/search?q=` | Full-text search (Elasticsearch) |
| `POST` | `/api/emails/schedule` | Schedule email(s) (multipart/form-data) |
| `POST` | `/api/ai/generate-email` | Generate email with Groq AI |
| `POST` | `/api/ai/suggest-subjects` | Suggest subject lines |
| `POST` | `/api/ai/improve-draft` | Improve an email draft |
| `POST` | `/api/ai/clean-recipients` | Parse and validate a raw recipient list |
| `GET` | `/api/slack/status` | Slack connection status |
| `POST` | `/api/slack/disconnect` | Disconnect Slack |
| `GET` | `/admin/queues` | Bull Board job queue UI |

---

## 📂 Monorepo Structure

```
ReachInbox/
├── backend/
│   ├── src/
│   │   ├── config/         # database, redis, queue, elasticsearch
│   │   ├── controllers/
│   │   ├── db/             # schema init (CREATE TABLE IF NOT EXISTS)
│   │   ├── middleware/     # auth guard, passport strategy
│   │   ├── routes/         # auth, emails, ai, slack
│   │   ├── services/       # emailService, aiService, mailer, slack
│   │   ├── workers/        # emailWorker (BullMQ processor)
│   │   ├── server.ts       # Express API only
│   │   └── worker.ts       # Worker entry point (separate process)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # EmailTable, ComposeModal
│   │   ├── hooks/
│   │   ├── pages/          # LoginPage, DashboardPage
│   │   ├── services/       # api.ts (axios + dynamic base URL)
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── .github/
│   └── workflows/
│       └── deploy-pages.yml   # Auto-deploy frontend to GitHub Pages
├── docker-compose.yml          # Full local stack
├── render.yaml                 # Render Blueprint (all 5 services)
└── README.md
```

---

## 🔒 Security Notes

- API keys are loaded from `backend/.env` via `env_file` in docker-compose — never hardcoded in source
- CORS allows only known origins (GitHub Pages, localhost, Cloudflare, Render)
- Session cookies use `sameSite: "none"` + `secure: true` in production for cross-origin auth
- `app.set("trust proxy", 1)` ensures correct IP detection behind Render/Cloudflare proxies
- Google OAuth route fails gracefully (redirect, not crash) when credentials are missing

---

## ⚠️ Known Limitations

- The Cloudflare tunnel URL changes each Docker restart; update the frontend settings accordingly
- Render free tier services sleep after inactivity — first request after sleep is slow
- Google and Slack OAuth require credentials that must be obtained from their developer consoles
- Bull Board is unauthenticated in this deployment — add auth middleware before production use
- Elasticsearch is optional; search returns an empty array if not configured

---

## 📜 License

MIT
