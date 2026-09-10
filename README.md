# CAUSE AI Agent

NestJS application for the CAUSE AI agent.

## Setup

```bash
npm install
npm run start:dev
```

The application listens on `http://localhost:3000` by default. Set `PORT` to use a different port.
Environment variables are loaded from `.env` through Nest's global `ConfigModule`; use `.env.example` as a starting point. `NODE_ENV` must be `dev`, `prod`, or `test`, and `PORT` must be a number.

The backend requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses row-level security and must remain server-only. For local development, obtain it from `npx supabase status` and set it in the untracked `.env` file.

## Chats

Routes use the `/api/v1` prefix. These endpoints are for a private internal prototype and do not authenticate callers or enforce chat ownership.

- `POST /api/v1/chats` accepts `{ "user_id": "<uuid>" }`, `{ "external_id": "<identity>" }`, or both. An external identity finds or creates a user; a user UUID must already exist. Both identifiers must match when supplied together. Returns `202` with `{ "thread_id": "<uuid>" }` after creating an empty thread.
- `GET /api/v1/chats/<thread_id>/messages` returns all message rows in ascending `created_at`, then `id` order. An empty chat returns `[]`; a missing chat returns `404`.
- `GET /api/v1/chats/<thread_id>/events` opens an SSE stream for new messages inserted into that thread, including writes from other processes.

```bash
curl -X POST http://localhost:3000/api/v1/chats \
  -H 'Content-Type: application/json' -d '{"external_id":"U123"}'
curl 'http://localhost:3000/api/v1/chats/<thread_id>/messages'
curl -N 'http://localhost:3000/api/v1/chats/<thread_id>/events'
```

Invalid input returns `400`, unknown user IDs return `404`, conflicting identities return `409`, and database failures return a sanitized `500`. Creation does not submit a message or start an agent.

### Live events

Run `npx supabase start` and `npx supabase migration up --local` to apply the schema and enable `messages` in the Realtime publication. Hosted environments must apply the same migrations to their linked project before starting the app.

The stream sends named events:

| Event | JSON data |
| --- | --- |
| `ready` | `{ "thread_id": "<uuid>" }`, after Realtime confirms subscription |
| `message.created` | Complete message row: `id`, `thread_id`, `role`, `content`, `created_at`; SSE event ID is the message UUID |
| `heartbeat` | `{}`, every 25 seconds after readiness |
| `stream.error` | `{ "code": "SUBSCRIPTION_FAILED" }`, `SUBSCRIPTION_TIMEOUT`, or `SUBSCRIPTION_CLOSED`; stream then closes |

Connect with `EventSource` and register named listeners with `addEventListener`. Wait for `ready`, then fetch history while buffering live messages and merge by message ID. Repeat after each reconnect. This version streams inserts only and does not replay events or honor `Last-Event-ID`; message IDs support deduplication, not replay. A subscription that fails to become ready within 10 seconds closes with `stream.error`. Client disconnects and application shutdown release channels and timers.

Run the optional local database integration test after applying migrations and configuring `.env`:

```bash
RUN_SUPABASE_INTEGRATION=1 node --env-file=.env node_modules/jest/bin/jest.js --runInBand chat.integration
```

It checks concurrent user creation, history beyond 1,000 messages, Realtime delivery, thread isolation, multiple subscribers, and disconnect cleanup. It creates uniquely named test data and removes it afterward; it refuses non-local Supabase URLs.

## Scripts

- `npm run build` compiles the application.
- `npm run start` starts the application.
- `npm run start:dev` starts it in watch mode.
- `npm run start:prod` runs the compiled application.
- `npm test` runs the unit tests.
