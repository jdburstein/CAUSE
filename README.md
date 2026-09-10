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

```bash
curl -X POST http://localhost:3000/api/v1/chats \
  -H 'Content-Type: application/json' -d '{"external_id":"U123"}'
curl http://localhost:3000/api/v1/chats/<thread_id>/messages
```

Invalid input returns `400`, unknown user IDs return `404`, conflicting identities return `409`, and database failures return a sanitized `500`. Creation does not submit a message or start an agent.

## Scripts

- `npm run build` compiles the application.
- `npm run start` starts the application.
- `npm run start:dev` starts it in watch mode.
- `npm run start:prod` runs the compiled application.
- `npm test` runs the unit tests.
