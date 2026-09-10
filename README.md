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

## Scripts

- `npm run build` compiles the application.
- `npm run start` starts the application.
- `npm run start:dev` starts it in watch mode.
- `npm run start:prod` runs the compiled application.
- `npm test` runs the unit tests.
