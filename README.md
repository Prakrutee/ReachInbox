# ReachInbox.ai

AI-powered email outreach platform with smart scheduling, rate limiting, and real-time analytics.

## Live Demo
- **Frontend**: https://reachinbox-frontend.onrender.com (replace with your URL)
- **Backend API**: https://reachinbox-api.onrender.com (replace with your URL)
- **Bull Board**: https://reachinbox-api.onrender.com/admin/queues

## Architecture

```
                    +---------------------+
     User Browser --? React + Tailwind    �  (Render Static Site)
                    +---------------------+
                           � REST API
                    +------?--------------+
                    �  Express API         �  (Render Web Service)
                    �  + Bull Board UI     �
                    +----------------------+
                       �          �
              +--------?--+  +----?----------+
              � Postgres  �  �   Redis        �
              � (Render)  �  � (Render KV)    �
              +-----------+  +----?----------+
                       �          � BullMQ Jobs
              +--------?---------------------+
              �     BullMQ Worker Process     �  (Render Background Worker)
              �   - Sends via Nodemailer      �
              �   - Rate limits via Redis     �
              �   - Indexes to Elasticsearch  �
              +-------------------------------+
```

## No Cron � Scheduling uses BullMQ delayed jobs exclusively

All email scheduling is implemented using BullMQ delayed jobs:
- `emailQueue.add("send-email", data, { jobId: emailId, delay: scheduledAt - Date.now() })`
- The worker process continuously listens and processes jobs when their delay expires
- No cron jobs, no node-cron, no setInterval, no Agenda

## Local Development

### Prerequisites
- Node.js 18+
- Redis (local or remote)
- Postgres (local or remote)

### Backend
```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npm run dev             # API server on :10000
npm run dev:worker      # Worker process (separate terminal)
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev             # Vite dev server on :5173
```

## Render Deploy Steps

1. Push code to GitHub
2. In Render dashboard: New ? Blueprint
3. Connect your GitHub repo
4. Render reads `render.yaml` and creates all services automatically:
   - `reachinbox-db` � Postgres database
   - `reachinbox-redis` � Redis Key Value store
   - `reachinbox-api` � Express web service
   - `reachinbox-worker` � BullMQ background worker
   - `reachinbox-frontend` � React static site
5. Set the following env vars in Render dashboard (sync: false vars):
   - `FRONTEND_URL` ? your static site URL
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
   - `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`
   - `ETHEREAL_USER`, `ETHEREAL_PASSWORD`
   - `ELASTICSEARCH_URL` (optional)
6. Deploy!

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Yes |
| `REDIS_URL` | Redis URL (redis:// or rediss://) | Yes |
| `SESSION_SECRET` | Express session secret | Yes |
| `FRONTEND_URL` | Frontend URL for CORS and redirects | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | For OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | For OAuth |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | For OAuth |
| `SLACK_CLIENT_ID` | Slack app client ID | For Slack |
| `SLACK_CLIENT_SECRET` | Slack app client secret | For Slack |
| `SLACK_REDIRECT_URI` | Slack OAuth redirect URI | For Slack |
| `ETHEREAL_HOST` | Nodemailer SMTP host | Yes (for sending) |
| `ETHEREAL_PORT` | SMTP port | Yes |
| `ETHEREAL_USER` | SMTP username | Yes |
| `ETHEREAL_PASSWORD` | SMTP password | Yes |
| `ELASTICSEARCH_URL` | Elasticsearch URL | Optional |
| `CONCURRENCY` | Worker concurrency (default: 5) | No |
| `MIN_EMAIL_DELAY_MS` | Min delay between sends (default: 2000) | No |
| `MAX_EMAILS_PER_HOUR` | Rate limit per sender per hour (default: 20) | No |

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://reachinbox-api.onrender.com/auth/google/callback`
4. Set `GOOGLE_CALLBACK_URL=https://reachinbox-api.onrender.com/auth/google/callback`

## Slack OAuth Setup

1. Create a [Slack App](https://api.slack.com/apps)
2. Enable incoming webhooks and OAuth
3. Add redirect URL: `https://reachinbox-api.onrender.com/auth/slack/callback`
4. Set scopes: `incoming-webhook`, `chat:write`

## Ethereal Setup

1. Visit [ethereal.email](https://ethereal.email/) and create a free account
2. Copy SMTP credentials to your env vars
3. Preview URLs are logged in the worker console after each send

## Persistence & Restart Survival

- **Postgres** is the source of truth for all email records
- **Redis** holds the BullMQ delayed job queue
- On worker restart, BullMQ automatically resumes all pending delayed jobs already in Redis
- The app does NOT recreate jobs on boot (avoids duplicates)
- To ensure no job is lost: always write to Postgres first, then enqueue

## Idempotency

Status transitions: `scheduled ? processing ? sent | failed`

- Worker uses conditional update: `UPDATE emails SET status='processing' WHERE id=$1 AND status='scheduled'`
- If another worker already claimed it (`rowCount === 0`), the current processor skips
- `jobId` = email UUID prevents duplicate BullMQ jobs
- Reschedules use unique jobId to avoid overwriting the original

## Rate Limiting & Concurrency

- **Per-sender rate limit**: Redis `INCR` on key `email-rate:{sender}:{yyyy-mm-dd-HH}`
  - On limit: job is rescheduled to the next hourly window (not dropped)
  - Slack notification sent when limit is hit
- **Concurrency**: configurable via `CONCURRENCY` env var (default: 5 parallel workers)
- **Delay**: `MIN_EMAIL_DELAY_MS` throttles each individual send

## Elasticsearch

- Emails indexed after send success or failure
- `GET /api/emails/search?q=` searches recipient/subject/body
- ES failures are non-fatal � successful sends are never rolled back
- If `ELASTICSEARCH_URL` is not set, search returns empty array

## Bull Board

Accessible at `/admin/queues` on the web service URL.
Shows: waiting, delayed, active, completed, failed job counts.

## Trade-offs

- Render free tier may sleep � first request after sleep is slow
- Elasticsearch is optional � search falls back gracefully
- Google/Slack OAuth require credentials that cannot be auto-generated
- Bull Board is unauthenticated on free tier (add middleware for production)
- Render Postgres free tier has storage limits
