# Ticketing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Kanban ticket tracker (SPA + HTTP API + PostgreSQL) that passes every requirement of `Hackathon_Ticketing_System_Requirements_v4 1.docx`, includes all four stretch features, and stands out through UX polish and "smart" non-AI features.

**Architecture:** npm-workspaces monorepo. `apps/web` is a React SPA served by nginx, which also proxies `/api` to `apps/api` (Fastify + Drizzle on PostgreSQL 16), so the browser sees a single origin. `packages/shared` holds the zod schemas, enums and pure helpers used by both sides. Everything runs in Docker Compose: a `secrets-init` one-shot container generates the DB password, and Mailpit catches email by default.

**Tech Stack:** Node 22, TypeScript 5, Fastify 5, fastify-type-provider-zod, drizzle-orm + drizzle-kit, pg, @node-rs/argon2, nodemailer, @fastify/cookie, @fastify/rate-limit, @fastify/swagger + @fastify/swagger-ui; React 18, Vite 6, React Router 6, TanStack Query 5, Tailwind 3, Radix UI primitives, dnd-kit, @tanstack/react-virtual, framer-motion, cmdk, sonner, react-markdown + remark-gfm + rehype-sanitize, canvas-confetti; Vitest, Testing Library, Playwright, @axe-core/playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-ticketing-system-design.md` (design) and `Hackathon_Ticketing_System_Requirements_v4 1.docx` (the requirements; section numbers below refer to it).

## Global Constraints

- From a clean checkout, `docker compose up --build` at the repo root starts everything. No host Node, Postgres, or `.env` is required. It must work on Windows, macOS (including arm64) and Linux.
- No secrets are committed. The DB password is generated at first start. SMTP credentials come only from env (`.env` is gitignored; `.env.example` holds placeholders).
- A fresh DB holds only the schema and migration metadata. No code path loads seed data at startup.
- Ticket `type` is exactly `bug | feature | fix`. Ticket `state` is exactly `new | ready_for_implementation | in_progress | ready_for_acceptance | done`. UI labels: `New`, `Ready for implementation`, `In progress`, `Ready for acceptance`, `Done`.
- Passwords are at least 8 characters and hashed with argon2id. Emails are trimmed and lowercased before storage and comparison.
- Verification tokens expire 24 h after issue and are single-use. Issuing a new token invalidates the earlier unused tokens of the same purpose. Reset tokens expire after 1 h (our call).
- Every `/api/*` route requires a session except: `POST /api/auth/signup|login|verify|resend-verification|forgot-password|reset-password`, `GET /api/health`, `GET /api/ready`, and `/api/docs*`. `POST /api/auth/logout` and `GET /api/auth/me` require a session.
- The session token travels only in the httpOnly cookie `sid` (`SameSite=Lax`, `Path=/`, `Secure` when `COOKIE_SECURE=true`) and never in a URL. Session TTL is 7 days.
- Error body is always `{ "error": { "code": string, "message": string, "details"?: unknown } }`. Status codes: 400 validation or bad reference, 401 no session, 403 unverified or not owner, 404 missing record, 409 conflict (duplicate team name, duplicate email, delete with dependents).
- All API timestamps are ISO-8601 UTC strings (`Date.prototype.toISOString()`), and DB columns are `timestamptz`.
- Ticket `modified_at` changes only when a business field (`team_id, type, state, epic_id, title, body`) actually changes. Comments never touch it.
- Nothing from section 12 is in scope (notifications, realtime, roles, attachments, dashboards).
- Ports: web `8080` (`WEB_PORT`), Mailpit UI `8025` (`MAILPIT_PORT`). The DB is not published.

## Review Focus

1. **Email spelling variants.** `"  Alice@Example.COM "` at signup and `alice@example.com` at login must hit the same account, and signing up again with any casing must return 409. Test in Task 4.
2. **Changing a ticket's team while it has an epic.** `PATCH /tickets/:id {teamId: other}` without `epicId` must return 400 `EPIC_TEAM_MISMATCH`, never silently keep the foreign epic. In the UI, picking a new team clears the epic select. Tests in Task 7 and Task 13.
3. **Whitespace-only input.** Team name, epic title, ticket title/body and comment body made only of spaces return 400 with a field message. Team names that differ only in case or surrounding spaces return 409. Tests in Tasks 6–8.
4. **DnD edge cases.** Dropping a card onto its own column sends no request. A failed PATCH returns the card to its original column even if a refetch happened in between. Two quick drags in a row end in the last chosen state. Tests in Task 12.
5. **Expired or invalid session mid-use.** Any 401 from the API sends the SPA to `/login?next=<current path>` instead of a blank screen or an endless spinner, and after login the user returns there. Test in Task 9.

---

## File Structure

```
.gitattributes .gitignore .dockerignore .env.example package.json tsconfig.base.json
docker-compose.yml docker-compose.test.yml docker-compose.e2e.yml README.md
.github/workflows/ci.yml
packages/shared/src/{index,enums,schemas,dto,quickAdd,checklist}.ts (+ *.test.ts)
apps/api/
  Dockerfile drizzle.config.ts vitest.config.ts
  drizzle/                     migrations (generated + custom SQL)
  src/server.ts                entry: config → migrate → buildApp → listen
  src/app.ts                   buildApp(deps): FastifyInstance
  src/config.ts                loadConfig(): Config
  src/errors.ts                AppError, errorHandler
  src/db/{client,schema,migrate}.ts
  src/mail/{mailer,templates}.ts
  src/auth/{passwords,tokens,sessions,guard,routes,service}.ts
  src/teams/{routes,service}.ts  src/epics/...  src/tickets/{routes,service,events}.ts  src/comments/...
  test/helpers.ts              createTestApp(), resetDb(), signupVerified(), MemoryMailer
  test/*.test.ts
apps/web/
  Dockerfile nginx.conf index.html vite.config.ts tailwind.config.ts
  src/main.tsx src/App.tsx src/styles.css
  src/api/{client,queries}.ts
  src/components/ui/*          Button, Input, Select, Dialog, Tooltip, Badge, Skeleton, Tabs, Menu
  src/components/{AppShell,TeamSelector,UserMenu,ThemeToggle,EmptyState,ConfirmDialog}.tsx
  src/features/auth/*          SignupPage, CheckEmailPage, LoginPage, VerifyPage, ForgotPasswordPage, ResetPasswordPage, ResendForm
  src/features/teams/TeamsPage.tsx  src/features/epics/EpicsPage.tsx
  src/features/board/{BoardPage,Column,TicketCard,FilterBar,filterTickets,useMoveTicket,useBoardKeyboard,Onboarding}.tsx/ts
  src/features/ticket/{TicketPanel,TicketForm,QuickAdd,SimilarTickets,MarkdownBody,Comments,Activity}.tsx
  src/features/palette/{CommandPalette,HotkeysHelp,useHotkeys}.tsx/ts
  src/**/*.test.ts(x)
e2e/ Dockerfile playwright.config.ts tests/{mvp,wow,a11y}.spec.ts tests/mailpit.ts scripts/seed-300.ts
```

---

### Task 1: Monorepo scaffold and a Compose stack that boots

**Files:**
- Create: root `package.json` (workspaces `apps/*`, `packages/*`, `e2e`), `tsconfig.base.json` (strict, ES2022, moduleResolution bundler), `.gitattributes` (`* text=auto eol=lf`, `*.docx binary`), `.gitignore` (node_modules, dist, .env, test-results, `*.docx`), `.dockerignore`, `.env.example`
- Create: `apps/api/{package.json,tsconfig.json,Dockerfile,vitest.config.ts}`, `apps/api/src/{server,app,config}.ts`, `apps/api/test/health.test.ts`
- Create: `apps/web/{package.json,Dockerfile,nginx.conf,index.html,vite.config.ts}`, `apps/web/src/main.tsx` (placeholder "Ticketing" page)
- Create: `packages/shared/{package.json,tsconfig.json}`, `packages/shared/src/index.ts`
- Create: `docker-compose.yml`, `docker-compose.test.yml`, `README.md` (stub: prerequisites + quick start)

**Interfaces:**
- Produces: `loadConfig(env = process.env): Config` with `Config = { port: number; databaseUrl: string; appBaseUrl: string; cookieSecure: boolean; smtp: { host: string; port: number; secure: boolean; user?: string; pass?: string; from: string }; rateLimit: boolean; exposeMailpitLink: boolean }`. `databaseUrl` is built from `DB_HOST` (default `db`), `DB_PORT` (5432), `DB_USER` (`ticketing`), `DB_NAME` (`ticketing`) and the password read from the `DB_PASSWORD_FILE` path, or taken from `DATABASE_URL` when that is set. SMTP defaults: `mailpit:1025`, not secure, from `Ticketing <no-reply@ticketing.local>`.
- Produces: `buildApp(deps: { config: Config; db: Db; mailer: Mailer }): Promise<FastifyInstance>`. In this task `db` and `mailer` may be typed `unknown`; Tasks 3–4 tighten them.
- Produces: `GET /api/health → 200 {status:"ok"}`.

- [ ] **Step 1: Write the failing test** `apps/api/test/health.test.ts`: `buildApp(...)` then `app.inject({method:'GET', url:'/api/health'})` returns status 200 and body `{status:'ok'}`.
- [ ] **Step 2: Generate the lockfile inside a container** (no host Node): `docker run --rm -v "${PWD}:/w" -w /w node:22-alpine npm install`, then delete `node_modules`. Expected: `package-lock.json` exists and lists `@rollup/rollup-linux-arm64-musl` and `@node-rs/argon2-linux-arm64-musl` (check with `grep`). If either is missing, add it explicitly to `optionalDependencies` of the owning workspace.
- [ ] **Step 3: Run the test and confirm it fails.** `docker compose -f docker-compose.test.yml run --rm api-test` → FAIL (route missing). `docker-compose.test.yml` defines `db-test` (postgres:16-alpine, `POSTGRES_PASSWORD=test`; a test-only value, which is not a secret) and `api-test` (builds the `test` stage of `apps/api/Dockerfile` and runs `npm run test -w apps/api` with `DATABASE_URL=postgres://postgres:test@db-test:5432/postgres`).
- [ ] **Step 4: Implement** `config.ts`, `app.ts` (health route), `server.ts`. `apps/api/Dockerfile` stages: `deps` (`npm ci`), `test` (copy sources), `build` (`tsc -b` shared + api), `runtime` (node:22-alpine, non-root, `CMD node apps/api/dist/server.js`).
- [ ] **Step 5: Write `docker-compose.yml`.** Services:
  - `secrets-init`: `alpine:3.20`. Command: `sh -c '[ -s /secrets/db_password ] || (head -c 48 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 32 > /secrets/db_password); chmod 444 /secrets/db_password'`. Volume `secrets:/secrets`.
  - `db`: postgres:16-alpine with `POSTGRES_PASSWORD_FILE=/secrets/db_password`, user and db `ticketing`, volume `pgdata`, healthcheck `pg_isready`, depends on secrets-init `service_completed_successfully`. No published ports.
  - `mailpit`: `axllent/mailpit:v1.21`, ports `${MAILPIT_PORT:-8025}:8025`.
  - `api`: depends on db `service_healthy`, `env_file` optional (`required: false`), env SMTP_* with `${VAR:-default}`, healthcheck on `/api/health`.
  - `web`: `apps/web/Dockerfile` (vite build stage, then nginx:1.27-alpine), ports `${WEB_PORT:-8080}:80`, depends on api.
  - `nginx.conf`: `location /api/ { proxy_pass http://api:3000; }`, SPA fallback `try_files $uri /index.html`, long cache for `/assets/`.
- [ ] **Step 6: Verify.** Test → PASS. `docker compose up --build -d`, then `curl -s localhost:8080/api/health` → `{"status":"ok"}` and `curl -s localhost:8080/` returns the placeholder HTML. Run `docker compose down`.
- [ ] **Step 7: Commit.** `git commit -m "chore: monorepo scaffold, compose stack with generated DB secret"`

### Task 2: Shared package — enums, schemas, DTOs, quick-add parser, checklist helpers

**Files:**
- Create: `packages/shared/src/{enums,schemas,dto,quickAdd,checklist}.ts`, tests `packages/shared/src/{schemas,quickAdd,checklist}.test.ts`, `packages/shared/vitest.config.ts`
- Modify: `packages/shared/src/index.ts` (re-export everything)

**Interfaces:**
- Produces (`enums.ts`): `TICKET_TYPES = ['bug','feature','fix'] as const`, `TICKET_STATES` (the canonical order), `type TicketType`, `type TicketState`, `STATE_LABELS: Record<TicketState,string>`, `TYPE_LABELS: Record<TicketType,string>` (`Bug`, `Feature`, `Fix`).
- Produces (`schemas.ts`, zod):
  - `emailSchema` (trim → lowercase → email), `passwordSchema` (min 8, message "Password must be at least 8 characters"), `nonBlank(field)` (string, trim, min 1, message "`<Field>` must not be empty");
  - `SignupBody{email,password}`, `LoginBody{email,password:string min1}`, `TokenBody{token:string min1}`, `EmailBody{email}`, `ResetPasswordBody{token,password}`;
  - `TeamBody{name}`, `EpicCreateBody{teamId:uuid,title,description?:string|null}`, `EpicUpdateBody{title,description?}` `.strict()` so that `teamId` → 400;
  - `TicketCreateBody{teamId:uuid,type,state (default 'new'),epicId:uuid|null (default null),title,body}`, `TicketUpdateBody = TicketCreateBody.partial()` (no defaults);
  - `TicketStateBody{state}`, `CommentBody{body}`, `BoardQuery{}`, `SimilarQuery{q:string min 3, excludeId?:coerce int}`.
  - Title and body are stored trimmed. The body is checked as non-blank but kept as entered, apart from trimming trailing whitespace.
- Produces (`dto.ts`, TS types):
  - `UserDto{id,email}`;
  - `TeamDto{id,name,createdAt,modifiedAt,ticketCount,epicCount}`;
  - `EpicDto{id,teamId,title,description:string|null,createdAt,modifiedAt,ticketCount}`;
  - `TicketCardDto{id:number,teamId,type,state,epicId:string|null,title,modifiedAt,stateSince,checklist:{done:number,total:number}}`;
  - `TicketDto = TicketCardDto & {body,createdAt,createdBy:UserDto}`;
  - `CommentDto{id,ticketId,author:UserDto,body,createdAt,editedAt:string|null}`;
  - `TicketEventDto{id,actor:UserDto,kind:'created'|'updated',field:string|null,from:string|null,to:string|null,at}`;
  - `SimilarTicketDto{id,title,state,score:number}`;
  - `ApiErrorBody`.
- Produces: `parseQuickAdd(input: string, epics: {id:string; title:string}[]): { type?: TicketType; epicId?: string; epicQuery?: string; title: string }`.
- Produces: `countChecklist(body: string): {done:number; total:number}`, `toggleChecklistItem(body: string, index: number): string`.

- [ ] **Step 1: Write failing tests.**
  - `schemas.test.ts`: `emailSchema.parse('  Alice@Example.COM ') === 'alice@example.com'`. `passwordSchema` rejects `'1234567'` and accepts `'12345678'`. `TeamBody` rejects `{name:'   '}`. `TicketCreateBody` rejects `type:'task'` and `state:'blocked'`, and defaults `state` to `'new'`. `EpicUpdateBody` rejects `{title:'x', teamId:'…'}`. `TicketUpdateBody.parse({})` returns `{}`.
  - `quickAdd.test.ts`:
    - `parseQuickAdd('bug: Login fails @auth', [{id:'e1',title:'Auth revamp'}])` → `{type:'bug', epicId:'e1', title:'Login fails'}`;
    - `'Feature:  Dark mode'` → `{type:'feature', title:'Dark mode'}`;
    - `'Just a title'` → `{title:'Just a title'}`;
    - `'fix: thing @nomatch'` → `{type:'fix', epicQuery:'nomatch', title:'thing'}`;
    - `'@auth only epic'` resolves the epic, title `'only epic'`.
    - Rules: the type prefix is case-insensitive and recognised only at the start; `@word` matches the first epic whose lowercased title starts with `word` or contains it as a whole word.
  - `checklist.test.ts`: `countChecklist('- [x] a\n- [ ] b\n* [X] c')` → `{done:2,total:3}`. Checklist syntax inside fenced code blocks is ignored. `toggleChecklistItem('- [ ] a\n- [ ] b', 1)` → `'- [ ] a\n- [x] b'`.
- [ ] **Step 2: Run and confirm they fail.** `docker compose -f docker-compose.test.yml run --rm api-test npm run test -w packages/shared` → FAIL.
- [ ] **Step 3: Implement** the files listed above.
- [ ] **Step 4: Run and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(shared): enums, zod schemas, DTOs, quick-add parser, checklist helpers"`

### Task 3: Database schema, migrations, triggers, test harness

**Files:**
- Create: `apps/api/src/db/{schema,client,migrate}.ts`, `apps/api/drizzle.config.ts`, `apps/api/drizzle/0000_init.sql` (generated by `drizzle-kit generate`), `apps/api/drizzle/0001_constraints_triggers.sql` (`drizzle-kit generate --custom`), `apps/api/test/helpers.ts`, `apps/api/test/db.test.ts`
- Modify: `apps/api/src/server.ts` (run `migrate` before listen), `apps/api/src/app.ts` (add `GET /api/ready`, which runs `select 1`)

**Interfaces:**
- Produces: `createDb(url: string): { db: Db; pool: pg.Pool }` (`Db = NodePgDatabase<typeof schema>`), `runMigrations(db: Db): Promise<void>` (drizzle migrator, folder resolved relative to the package).
- Produces (`schema.ts` tables):
  - `users`: id uuid pk default `gen_random_uuid()`, email text not null, password_hash, email_verified_at timestamptz null, created_at;
  - `sessions`: id text pk (sha256 hex), user_id fk cascade, expires_at, created_at;
  - `emailTokens`: id uuid, user_id fk cascade, token_hash text unique, purpose text check in ('verify','reset'), expires_at, used_at null, created_at;
  - `teams`: id uuid, name, created_at, modified_at;
  - `epics`: id uuid, team_id fk restrict, title, description null, created_at, modified_at;
  - `tickets`: id integer identity pk, team_id fk restrict, type, state, epic_id null, title, body, created_by fk users restrict, created_at, modified_at;
  - `comments`: id uuid, ticket_id fk cascade, author_id fk restrict, body, created_at, edited_at null;
  - `ticketEvents`: id uuid, ticket_id fk cascade, actor_id fk restrict, kind, field null, from_value null, to_value null, at.
- Produces (`0001` custom SQL):
  - `create extension if not exists pg_trgm`;
  - `unique index users_email_lower on users (lower(email))`;
  - `unique index teams_name_lower on teams (lower(btrim(name)))`;
  - `unique (id, team_id)` on epics;
  - `constraint tickets_epic_same_team foreign key (epic_id, team_id) references epics(id, team_id) on delete restrict` (MATCH SIMPLE, so a NULL epic passes);
  - check constraints for type and state;
  - gin trigram index on `lower(tickets.title)`;
  - index `tickets(team_id, modified_at desc)`;
  - function `touch_modified_at()` used by BEFORE UPDATE triggers on `teams`, `epics`, `tickets`. It compares business columns with `IS DISTINCT FROM`: on change it sets `NEW.modified_at := now()`, otherwise `NEW.modified_at := OLD.modified_at`. Pass the column list per table via `TG_ARGV`, or write three small functions; the implementer chooses.
- Produces (`test/helpers.ts`):
  - `createTestApp(): Promise<{ app: FastifyInstance; db: Db; mailer: MemoryMailer; close(): Promise<void> }>` (migrates once per process, rate limit off);
  - `resetDb(db)` truncates all app tables `restart identity cascade`;
  - `MemoryMailer` with `sent: MailMessage[]` and `lastLinkTo(email): string`.

- [ ] **Step 1: Write failing tests** `db.test.ts`:
  - after migrations, every app table has `count(*) = 0` (DoD: fresh DB empty);
  - inserting a ticket whose `epic_id` belongs to another team raises pg error `23503` mentioning `tickets_epic_same_team`;
  - `update tickets set title = title` leaves `modified_at` unchanged, and `set title = 'new'` advances it (use `pg_sleep(0.01)` between operations);
  - deleting a team that has an epic raises `23503`;
  - inserting team names `'Core'` then `' core '` raises `23505`.
- [ ] **Step 2: Run and confirm they fail.** `docker compose -f docker-compose.test.yml run --rm api-test` → FAIL.
- [ ] **Step 3: Implement** the schema, generate both migrations (inside the api-test container: `npx drizzle-kit generate` and `npx drizzle-kit generate --custom --name constraints_triggers`, then write the SQL), the migrate runner and the helpers.
- [ ] **Step 4: Run and confirm they pass.** Then run `docker compose up --build -d` and `docker compose exec db psql -U ticketing -c '\dt'`: the tables are listed and `select count(*) from users` returns 0.
- [ ] **Step 5: Commit.** `git commit -m "feat(db): schema, migrations, same-team FK and modified_at triggers"`

### Task 4: Authentication API (signup, verify, resend, login, logout, me, guard)

**Files:**
- Create: `apps/api/src/errors.ts`, `apps/api/src/mail/{mailer,templates}.ts`, `apps/api/src/auth/{passwords,tokens,sessions,guard,service,routes}.ts`, `apps/api/test/auth.test.ts`, `apps/api/test/guard.test.ts`
- Modify: `apps/api/src/app.ts` (register cookie, rate limit, zod type provider, swagger, error handler, guard, auth routes)

**Interfaces:**
- Produces:
  - `class AppError extends Error { constructor(status: number, code: string, message: string, details?: unknown) }`;
  - `errorHandler`, which maps a ZodError or Fastify validation error to 400 `VALIDATION_ERROR` with `details: [{path, message}]`, pg `23505` to 409 `CONFLICT`, pg `23503` to 409 `CONFLICT` (callers pre-check, so this is a safety net) and anything unknown to 500 `INTERNAL` (logged, message generic).
- Produces:
  - `interface Mailer { send(m: MailMessage): Promise<void> }`, `MailMessage{to,subject,text,html}`;
  - `createSmtpMailer(cfg: Config['smtp']): Mailer` (nodemailer; `secure` and auth only when a user is set; `tls.rejectUnauthorized` stays default);
  - `verificationEmail(link: string): {subject,text,html}` and `resetPasswordEmail(link)`. The HTML is a single-column branded card with a button and the plain link below it, using inline styles.
- Produces: `hashPassword(p): Promise<string>`, `verifyPassword(hash, p): Promise<boolean>` (argon2id, library defaults), `generateToken(): {raw: string; hash: string}` (32 random bytes base64url; sha256 hex).
- Produces: `issueEmailToken(db, userId, purpose: 'verify'|'reset', ttlMs): Promise<string /*raw*/>`. It sets `used_at = now()` on the earlier unused tokens of the same user and purpose.
- Produces: `createSession(db, userId): Promise<string /*raw*/>`, `getSessionUser(db, raw): Promise<UserDto|null>` (also checks expiry), `deleteSession(db, raw)`. The guard is an `onRequest` hook: a public allow-list from Global Constraints, otherwise `401 UNAUTHENTICATED`, and it sets `request.user: UserDto`.
- Produces routes:
  - `POST /api/auth/signup` → 201 `{email}`; 409 `EMAIL_TAKEN`. Sends the verification mail with link `${appBaseUrl}/verify?token=<raw>`.
  - `POST /api/auth/verify {token}` → 200 `{status:'verified'}` | 400 `TOKEN_INVALID` | 400 `TOKEN_EXPIRED` | 400 `TOKEN_USED`. Success sets `email_verified_at` and marks the token used.
  - `POST /api/auth/resend-verification {email}` → always 202 `{status:'sent'}`. It only sends when the user exists and is unverified.
  - `POST /api/auth/login` → 200 `UserDto` plus a cookie | 401 `INVALID_CREDENTIALS` | 403 `EMAIL_NOT_VERIFIED`, checked after the password matches.
  - `POST /api/auth/logout` → 204 and the cookie cleared. `GET /api/auth/me` → `UserDto`.
  - Rate limit: 20 requests/min per IP on `/api/auth/*` when `config.rateLimit`.
  - Swagger UI at `/api/docs`, generated by `jsonSchemaTransform`.

- [ ] **Step 1: Write failing tests** `auth.test.ts`:
  - full flow: signup `'  Alice@Example.COM '` → 201 → `mailer.sent[0].to === 'alice@example.com'` → the link contains `/verify?token=` → login before verify → 403 `EMAIL_NOT_VERIFIED` → verify → 200 → second verify with the same token → 400 `TOKEN_USED` → login as `alice@example.com` → 200 and a `set-cookie` with `sid=`, `HttpOnly`, `SameSite=Lax` → `GET /me` with the cookie → 200 → logout → `GET /me` → 401;
  - duplicate signup `ALICE@example.com` → 409 `EMAIL_TAKEN`;
  - `password: 'short'` → 400 with details path `password`;
  - wrong password → 401 `INVALID_CREDENTIALS`, and for an unknown email too (same message);
  - expired token: issue it, `update email_tokens set expires_at = now() - interval '1 second'` → 400 `TOKEN_EXPIRED`;
  - resend invalidates the old token: the first token now returns `TOKEN_USED` and the second verifies;
  - resend for an unknown email → 202 and no mail sent;
  - `users.password_hash` starts with `$argon2id$`;
  - the login response body contains no `password` or `hash` key.
- [ ] **Step 2: Write failing test** `guard.test.ts`: a table over every private route registered so far and added later (`GET /api/teams`, `POST /api/teams`, `GET /api/epics`, `GET /api/teams/:id/tickets`, `GET /api/tickets/1`, `POST /api/tickets`, `GET /api/tickets/1/comments`, `GET /api/auth/me`, …) returns 401 without a cookie. A second table checks that public routes do not return 401. Keep the table in one exported array, `PRIVATE_ROUTES`, and extend it in Tasks 6–8.
- [ ] **Step 3: Run and confirm they fail.**
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run and confirm they pass.** Then a manual smoke test against compose: sign up through `curl`; the mail appears in Mailpit (`curl -s localhost:8025/api/v1/messages | grep -c Verify` ≥ 1).
- [ ] **Step 6: Commit.** `git commit -m "feat(auth): signup, email verification, resend, sessions, auth guard"`

### Task 5: Password reset (stretch)

**Files:**
- Modify: `apps/api/src/auth/{service,routes}.ts`
- Test: `apps/api/test/password-reset.test.ts`

**Interfaces:**
- Consumes: `issueEmailToken`, `resetPasswordEmail`, `hashPassword`.
- Produces:
  - `POST /api/auth/forgot-password {email}` → always 202. It sends a link `${appBaseUrl}/reset-password?token=…` (TTL 1 h) only when the user exists.
  - `POST /api/auth/reset-password {token,password}` → 200 | 400 `TOKEN_INVALID|TOKEN_EXPIRED|TOKEN_USED`. On success it sets the new hash, deletes all of the user's sessions, marks the token used and sets `email_verified_at` if it was null (the reset proved ownership of the inbox; our call).

- [ ] **Step 1: Write failing tests.** The old password fails and the new one logs in. A session cookie from before the reset gets 401. The token is single-use. A verify token is rejected by reset-password (purpose mismatch → `TOKEN_INVALID`). Unknown email → 202 and no mail.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(auth): password reset flow"`

### Task 6: Teams and Epics API

**Files:**
- Create: `apps/api/src/teams/{routes,service}.ts`, `apps/api/src/epics/{routes,service}.ts`
- Test: `apps/api/test/teams.test.ts`, `apps/api/test/epics.test.ts`; extend `PRIVATE_ROUTES`

**Interfaces:**
- Consumes: `request.user`, `AppError`, `TeamBody`, `EpicCreateBody`, `EpicUpdateBody`.
- Produces:
  - `GET /api/teams` → `TeamDto[]` sorted by name, case-insensitive, with counts. `POST /api/teams` → 201 `TeamDto`. `PATCH /api/teams/:id` → `TeamDto`. `DELETE /api/teams/:id` → 204.
  - Errors: 409 `TEAM_NAME_TAKEN` (message `A team named "<name>" already exists`), 404 `TEAM_NOT_FOUND`, 409 `TEAM_NOT_EMPTY` (message `Team has N tickets and M epics. Move or delete them first.`, details `{ticketCount, epicCount}`).
- Produces:
  - `GET /api/epics?teamId=` (teamId optional) → `EpicDto[]` sorted by title. `POST /api/epics` → 201. `PATCH /api/epics/:id` → `EpicDto`. `DELETE /api/epics/:id` → 204.
  - Errors: 400 `TEAM_NOT_FOUND` (unknown teamId in the body), 400 on a body containing `teamId` in PATCH (strict schema), 404 `EPIC_NOT_FOUND`, 409 `EPIC_IN_USE` (`Epic is used by N tickets.`).
  - Path params are validated as uuid → 404 for a malformed id (treated as "not found").

- [ ] **Step 1: Write failing tests.**
  - CRUD happy paths with ISO timestamps (`/Z$/`).
  - Renaming to the same name leaves `modifiedAt` unchanged; renaming to a new name advances it.
  - `'  '` → 400. `'Core'` then `'core '` → 409 `TEAM_NAME_TAKEN`.
  - Deleting a team with an epic → 409 `TEAM_NOT_EMPTY` with counts. Deleting an epic referenced by a ticket → 409 `EPIC_IN_USE`. Insert the ticket directly through `db` here, since the tickets API arrives in Task 7.
  - Epic PATCH with `teamId` → 400.
  - `GET /api/teams` returns `ticketCount`/`epicCount`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): teams and epics CRUD with 409 guards"`

### Task 7: Tickets API with activity events and similar-ticket search

**Files:**
- Create: `apps/api/src/tickets/{routes,service,events}.ts`
- Test: `apps/api/test/tickets.test.ts`, `apps/api/test/similar.test.ts`; extend `PRIVATE_ROUTES`

**Interfaces:**
- Consumes: `TicketCreateBody`, `TicketUpdateBody`, `TicketStateBody`, `SimilarQuery`, `countChecklist`.
- Produces:
  - `GET /api/teams/:teamId/tickets` → `TicketCardDto[]` ordered `modified_at desc, id desc`; 404 for an unknown team. `stateSince = coalesce(max(at) of events where field='state', created_at)`.
  - `GET /api/tickets/:id` → `TicketDto`. `POST /api/tickets` → 201 `TicketDto`. `PATCH /api/tickets/:id` → `TicketDto`. `PATCH /api/tickets/:id/state {state}` → `TicketCardDto`. `DELETE /api/tickets/:id` → 204 (comments and events cascade).
  - `GET /api/teams/:teamId/tickets/similar?q=&excludeId=` → up to 5 `SimilarTicketDto` where `similarity(lower(title), lower(q)) >= 0.3`, ordered by score desc.
  - Errors: 400 `TEAM_NOT_FOUND`, 400 `EPIC_NOT_FOUND`, 400 `EPIC_TEAM_MISMATCH` (`Epic belongs to a different team. Choose an epic from <team>.`), 404 `TICKET_NOT_FOUND`.
  - On PATCH the service merges the body over the current row and validates the epic against the resulting team (Review Focus 2), all in one transaction: an `UPDATE … RETURNING`, then `recordChanges(tx, before, after, actorId)` inserts one `ticket_events` row per changed field (`field`, `from_value`, `to_value`; epic stored as id, rendered as a title in the UI). Create inserts a `kind='created'` event.
  - `events.ts` exports `diffTicket(before, after): {field,from,to}[]`, a pure function covered by a unit test.
  - `GET /api/tickets/:id/events` → `TicketEventDto[]`, oldest first.

- [ ] **Step 1: Write failing tests** `tickets.test.ts`:
  - create → 201, `createdBy.email` is the logged-in user, `state` defaults to `new`, `createdAt === modifiedAt`, ISO UTC;
  - `type:'task'` → 400; `state:'blocked'` → 400; `title:'  '` → 400; `body:''` → 400; unknown `teamId` → 400 `TEAM_NOT_FOUND`;
  - epic from team B on a ticket of team A → 400 `EPIC_TEAM_MISMATCH`;
  - PATCH `{teamId: B}` on a ticket with an epic of A → 400 `EPIC_TEAM_MISMATCH`; PATCH `{teamId: B, epicId: null}` → 200;
  - PATCH with all current values → `modifiedAt` unchanged and no new events; PATCH a title change → `modifiedAt` advanced and one `updated` event `field:'title'`;
  - `PATCH /state` persists, and a GET of the board shows the ticket in the new state at index 0;
  - board order is most recently modified first across 3 tickets;
  - DELETE removes its comments (insert one through `db`), then GET → 404;
  - `stateSince` changes only when the state changes.
- [ ] **Step 2: Write failing test** `similar.test.ts`: with tickets "Login fails on Safari" and "Dark mode", `q='login fail safari'` returns the first ticket with `score > 0.3` and never the second. `excludeId` drops the ticket itself. Tickets of another team never appear.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run** → PASS.
- [ ] **Step 6: Commit.** `git commit -m "feat(api): tickets CRUD, board query, activity events, similar search"`

### Task 8: Comments API (immutable by default, edit/delete own as stretch)

**Files:**
- Create: `apps/api/src/comments/{routes,service}.ts`
- Test: `apps/api/test/comments.test.ts`; extend `PRIVATE_ROUTES`

**Interfaces:**
- Produces:
  - `GET /api/tickets/:id/comments` → `CommentDto[]` ordered `created_at asc, id asc`. `POST /api/tickets/:id/comments {body}` → 201.
  - `PATCH /api/comments/:id {body}` → `CommentDto` with `editedAt` set. `DELETE /api/comments/:id` → 204.
  - Errors: 404 `TICKET_NOT_FOUND` / `COMMENT_NOT_FOUND`, 403 `NOT_COMMENT_AUTHOR`, 400 for a blank body.

- [ ] **Step 1: Write failing tests.**
  - Adding a comment leaves the ticket `modifiedAt` and board order unchanged.
  - Three comments come back oldest first, each with `author.email` and ISO `createdAt`.
  - A blank body → 400.
  - User B editing or deleting user A's comment → 403. Editing your own comment sets `editedAt` and leaves the ticket `modifiedAt` unchanged.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): ticket comments, edit/delete own"`

### Task 9: Web foundation — design system, API client, routing, shell

Before writing UI, invoke the **frontend-design** skill and pick one deliberate visual direction: a calm, dense, keyboard-first tool in the Linear school, avoiding a generic Bootstrap look. Record the tokens in `styles.css` as CSS variables for light and dark.

**Files:**
- Create: `apps/web/tailwind.config.ts`, `postcss.config.js`, `src/styles.css`, `src/App.tsx` (routes), `src/api/client.ts`, `src/api/queries.ts`, `src/components/ui/*`, `src/components/{AppShell,TeamSelector,UserMenu,ThemeToggle,EmptyState,ConfirmDialog,RequireAuth}.tsx`, `apps/web/vitest.config.ts`, `src/api/client.test.ts`, `src/components/RequireAuth.test.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; code: string; details?: unknown }`;
  - `api<T>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T>`. It uses `credentials:'same-origin'`, JSON in and out, returns `undefined` on 204, and on 401 calls `onUnauthenticated()` (registered by `App`, which navigates to `/login?next=`) before throwing.
- Produces (`queries.ts`) TanStack Query keys and hooks:
  - keys: `['me']`, `['teams']`, `['epics', teamId?]`, `['board', teamId]`, `['ticket', id]`, `['comments', id]`, `['events', id]`;
  - hooks: `useMe`, `useTeams`, `useEpics(teamId?)`, `useBoard(teamId)`, `useTicket(id)`, `useComments(id)`, `useEvents(id)`;
  - mutations: `useCreateTeam`, `useRenameTeam`, `useDeleteTeam`, `useCreateEpic`, `useUpdateEpic`, `useDeleteEpic`, `useCreateTicket`, `useUpdateTicket`, `useDeleteTicket`, `useAddComment`, `useEditComment`, `useDeleteComment`, `useLogout`. Each invalidates the affected keys.
- Produces routes:
  - public: `/login`, `/signup`, `/check-email`, `/verify`, `/forgot-password`, `/reset-password`;
  - private, inside `RequireAuth` + `AppShell`: `/` (redirects to `/board/:lastTeamId` or onboarding), `/board/:teamId`, `/tickets/:id` (rendered as a panel over the board using `location.state.background`, or as a full page on a direct load), `/teams`, `/epics`.
  - `lastTeamId` lives in `localStorage` purely as a convenience: every access is wrapped in try/catch and the code survives its absence.
- `AppShell` header: logo, `TeamSelector`, nav (Board / Epics / Teams), search trigger (`⌘K`), `ThemeToggle`, `UserMenu` (email, "Keyboard shortcuts", "Celebrate on Done" toggle, Log out).

- [ ] **Step 1: Write failing tests.**
  - `client.test.ts` (mocked `fetch`): a 400 body becomes `ApiError{status:400, code:'VALIDATION_ERROR'}`; a 401 calls the registered `onUnauthenticated` exactly once and throws; a 204 resolves `undefined`.
  - `RequireAuth.test.tsx`: when `/api/auth/me` returns 401, it renders the login redirect with `next=/board/abc`.
- [ ] **Step 2: Run** `docker compose -f docker-compose.test.yml run --rm api-test npm run test -w apps/web` → FAIL. Add a `web-test` service if the api-test image lacks the web deps; the implementer chooses.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS. `docker compose up --build` → `/` redirects to `/login`.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): design system, API client, routing, app shell"`

### Task 10: Auth screens

**Files:**
- Create: `apps/web/src/features/auth/{SignupPage,CheckEmailPage,LoginPage,VerifyPage,ForgotPasswordPage,ResetPasswordPage,ResendForm}.tsx`, `src/features/auth/VerifyPage.test.tsx`

**Interfaces:**
- Consumes: `api`, `SignupBody`, `LoginBody` (zod resolver in react-hook-form, so client messages match server messages).
- Behaviour:
  - Signup → `/check-email?email=` shows "We sent a link to `<email>`", a resend button and, when the build-time flag `VITE_SHOW_MAILPIT_LINK` is true (set in the compose web build arg, default true), an "Open Mailpit" link to `http://localhost:${MAILPIT_PORT}`.
  - Login: on 403 `EMAIL_NOT_VERIFIED` it shows an inline callout with `ResendForm` prefilled; on 401 it shows "Invalid email or password"; on success it navigates to `next` or `/`.
  - Verify: on mount, POSTs the token once (guard against StrictMode double-run with a ref). States: verifying (spinner) → success ("Email verified" + button "Go to login", no auto-login) | expired/used/invalid (specific message + `ResendForm` with an email input).
  - Forgot/Reset: generic "If an account exists, we sent a link"; reset success → login with a toast.
  - Every form shows the submitting state (disabled button + spinner) and field errors from `ApiError.details`.

- [ ] **Step 1: Write failing tests** `VerifyPage.test.tsx`: when the API returns 200 it renders "Email verified" and a link to `/login`; when it returns 400 `TOKEN_EXPIRED` it renders the "expired" message and a resend form; the API is called exactly once under StrictMode.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Manually click through** the full sign-up → Mailpit → verify → login flow on `localhost:8080`.
- [ ] **Step 6: Commit.** `git commit -m "feat(web): signup, login, verification, resend, password reset screens"`

### Task 11: Teams and Epics screens

**Files:**
- Create: `apps/web/src/features/teams/TeamsPage.tsx`, `apps/web/src/features/epics/EpicsPage.tsx`, `src/features/teams/TeamsPage.test.tsx`

**Behaviour:**
- **Teams:** a table of name, epics, tickets, created and modified dates. An inline "New team" row. Rename is in-place with Enter to save and Esc to cancel. Delete is disabled while `ticketCount+epicCount>0`, with a tooltip like "Team has 3 tickets and 1 epic"; when enabled it opens `ConfirmDialog`. A 409 from the server is shown as a toast with the server message. An empty state invites the user to create the first team.
- **Epics:** a team filter select (defaults to the current team) and a list. The create dialog has a team select that is fixed after creation; the edit dialog shows the team as read-only text. Delete is disabled while `ticketCount>0` with a tooltip, and 409 is handled. Loading shows skeleton rows.

- [ ] **Step 1: Write failing test.** With a team `{ticketCount:2, epicCount:0}`, the delete button is disabled and its accessible description contains "2 tickets"; when the server answers rename with 409, the server message is shown.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): team and epic management screens"`

### Task 12: Kanban board — columns, filters, DnD with rollback and undo, virtualization, onboarding

**Files:**
- Create: `apps/web/src/features/board/{BoardPage,Column,TicketCard,FilterBar,Onboarding}.tsx`, `filterTickets.ts`, `useMoveTicket.ts`, tests `filterTickets.test.ts`, `useMoveTicket.test.tsx`

**Interfaces:**
- Produces: `type BoardFilters = { type?: TicketType; epic?: string /* epic id or 'none' */; q?: string }`, `filterTickets(cards: TicketCardDto[], f: BoardFilters): TicketCardDto[]` (AND logic; `q` is trimmed and matched as a case-insensitive substring of the title), `filtersFromSearchParams(sp: URLSearchParams): BoardFilters` and `filtersToSearchParams(f): URLSearchParams`.
- Produces: `useMoveTicket(teamId): { move(id: number, to: TicketState, opts?: {undoable?: boolean}): void }`.
  - Optimistic: it updates `['board', teamId]` with the card moved to the top of its new column and `modifiedAt = now`, after calling `cancelQueries` first.
  - On error it restores the snapshot taken just before this move and shows `toast.error(server message)`.
  - On success it shows the toast `Moved to <Label> · Undo` for 5 s; Undo calls `move(id, previous, {undoable:false})`.
  - If the card is already in `to`, it does nothing.
  - On success it invalidates the board. A per-ticket sequence counter keeps a stale response from overwriting a newer move (Review Focus 4).
- Card contents:
  - `#id` and a type badge (bug red, feature violet, fix amber; the colour is never the only signal);
  - the title in two lines with ellipsis;
  - an epic chip;
  - a checklist progress bar when `total>0`;
  - a "state age" pill: `stateSince` as a relative time, highlighted after 7 days in a non-`done` state;
  - relative `modifiedAt` with the absolute time in a `title` tooltip.
- Column: a header with the label and count, and an empty-drop hint. The list is virtualized with `@tanstack/react-virtual` once it exceeds 30 cards. dnd-kit uses `PointerSensor` and `KeyboardSensor`; screen-reader announcements use the state labels.
- FilterBar:
  - type select (All/Bug/Feature/Fix), epic select (All / No epic / each epic of the team), search input (`/` focuses it);
  - a "Clear filters" button and the result count;
  - filters stay in the URL.
- States:
  - loading: 5 skeleton columns;
  - error: an inline retry card;
  - no tickets: an empty column hint plus a prominent "New ticket" button;
  - no teams at all: `Onboarding`, a 3-step checklist (Create a team → Create an epic (optional) → Create your first ticket). Steps tick off from live data.

- [ ] **Step 1: Write failing tests.**
  - `filterTickets.test.ts`: type+epic+q combine with AND; `q:'LOGIN'` matches "Fix login bug"; `epic:'none'` keeps only cards with `epicId===null`; whitespace-only `q` filters nothing; URL params round-trip.
  - `useMoveTicket.test.tsx` (QueryClient + mocked api):
    - success moves the card and calls `PATCH /api/tickets/1/state` with `{state:'done'}`;
    - a 500 response restores the card to `new` and shows a toast with the error message;
    - moving to the same state sends nothing;
    - two rapid moves (`in_progress` then `done`) whose responses arrive out of order end with the card in `done`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Manually verify.** Drag a card, refresh, and the card is still in the new column. Stop the api container (`docker compose stop api`), drag again, and the card snaps back with an error toast.
- [ ] **Step 6: Commit.** `git commit -m "feat(web): kanban board with filters, optimistic DnD, rollback, undo, virtualization"`

### Task 13: Ticket create/edit/details panel, comments, activity, similar tickets, quick-add

**Files:**
- Create: `apps/web/src/features/ticket/{TicketPanel,TicketForm,QuickAdd,SimilarTickets,MarkdownBody,Comments,Activity}.tsx`, tests `TicketForm.test.tsx`, `QuickAdd.test.tsx`

**Interfaces:**
- Consumes: `parseQuickAdd`, `toggleChecklistItem`, `TicketCreateBody`, `useSimilar(teamId, q, excludeId)` (add to `queries.ts`, debounced 300 ms, enabled when `q.length>=3`).
- `TicketPanel` (route `/tickets/:id`, and `/tickets/new?teamId=&state=&title=&type=&epicId=` for create): a right-side sheet with header `#id` + title, close on Esc, and links to copy.
  - Details view: all fields, including Created by, Created (absolute UTC-aware local time with relative time in a tooltip) and Modified.
  - Tabs: Comments | Activity.
- `TicketForm`:
  - team, type, state, epic (options limited to the selected team, plus "No epic"), title, body (Write/Preview tabs).
  - **Changing the team sets epic to "No epic"** and shows a one-line hint "Epic cleared — epics belong to a team".
  - Save is disabled while there are no changes. Server errors map to fields.
  - Delete sits behind `ConfirmDialog` ("Delete ticket #12 and its N comments?"), then the panel closes and returns to the board with a toast.
- `SimilarTickets`: under the title field in create mode, "Possibly duplicates:" followed by up to 3 links with a score % badge.
- `MarkdownBody`: react-markdown + remark-gfm + rehype-sanitize. Task-list checkboxes are clickable; a click sends `PATCH {body: toggleChecklistItem(body, i)}`.
- `QuickAdd`:
  - an input in each column footer (`+ Add ticket`) and in the palette;
  - shows live chips for the parsed type/epic and an "Unknown epic @x" warning;
  - Enter opens `/tickets/new` prefilled with the column state and the parsed fields, with focus on the body (the body is required by the spec).
- `Comments`:
  - a list ordered oldest first, with author email, avatar initials, and relative time with an absolute tooltip;
  - an "(edited)" marker; edit/delete actions only on your own comments;
  - a composer with Ctrl/⌘+Enter to send; an empty state.
- `Activity`: a timeline of events ("alice changed State from In progress to Done · 2h ago"), with epic ids resolved to titles.

- [ ] **Step 1: Write failing tests.**
  - `TicketForm.test.tsx`:
    - changing the team select clears the epic select to "No epic" and lists only the new team's epics;
    - submitting a whitespace-only title shows "Title must not be empty" without calling the API;
    - in edit mode, Save is disabled until a field changes.
  - `QuickAdd.test.tsx`: typing `bug: Crash @pay` with epic "Payments" shows the chips "Bug" and "Payments", and Enter navigates to `/tickets/new?…type=bug&epicId=…&title=Crash&state=<column>`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): ticket panel, comments, activity, markdown checklists, similar tickets, quick-add"`

### Task 14: Wow layer — command palette, hotkeys, keyboard board navigation, motion

**Files:**
- Create: `apps/web/src/features/palette/{CommandPalette,HotkeysHelp,useHotkeys}.tsx/ts`, `apps/web/src/features/board/useBoardKeyboard.ts`, test `useBoardKeyboard.test.ts`
- Modify: `BoardPage.tsx`, `TicketCard.tsx`, `Column.tsx`, `useMoveTicket.ts` (confetti on Done), `AppShell.tsx`

**Interfaces:**
- `useHotkeys(map: Record<string, (e: KeyboardEvent) => void>)` ignores events from inputs, textareas and contenteditable elements, except `mod+k` and `Escape`.
  - Global keys: `mod+k` opens the palette, `c` creates a ticket in the current team, `/` focuses search, `?` opens `HotkeysHelp`, `g b` / `g t` / `g e` go to the board, teams and epics.
- `CommandPalette` (cmdk) groups: Actions (New ticket, Quick add `<text>`, Toggle theme, Log out), Teams (switch), Tickets (fuzzy search over the current board by title and `#id`; Enter opens the ticket).
- `useBoardKeyboard(columns: TicketCardDto[][]): { focused: {col:number; row:number} | null; onKeyDown(e): void }` is pure navigation: `j/k` or ↓/↑ move within a column, `h/l` or ←/→ move between columns (clamping the row, skipping empty columns), `Enter` opens, `Shift+←/→` call `move()` to the adjacent state and keep focus on the moved card.
- Motion:
  - framer-motion `layout` on cards for the reflow;
  - drag overlay with 3° rotation, scale 1.03 and a shadow;
  - the target column gets an accent outline;
  - `canvas-confetti` (a small burst from the card position) when a card lands in Done, if "Celebrate on Done" is on (default on; preference in localStorage with try/catch);
  - with `prefers-reduced-motion`, all of this is disabled.
- Theme: system/light/dark through the `data-theme` attribute, stored in localStorage with try/catch.

- [ ] **Step 1: Write failing tests** `useBoardKeyboard.test.ts`: with columns `[[a,b],[],[c]]`, starting at `a`: `j` → b; `l` from b → c (skips the empty column, row clamped to 0); `Shift+ArrowRight` on a calls `move(a.id,'ready_for_implementation')`; `k` at the top stays put.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): command palette, hotkeys, keyboard board navigation, motion and confetti"`

### Task 15: End-to-end tests in Docker and CI

**Files:**
- Create: `e2e/{package.json,Dockerfile,playwright.config.ts}`, `e2e/tests/{mailpit.ts,mvp.spec.ts,wow.spec.ts,a11y.spec.ts}`, `docker-compose.e2e.yml`, `.github/workflows/ci.yml`

**Interfaces:**
- `docker-compose.e2e.yml` extends the main file with service `e2e` (`mcr.microsoft.com/playwright:v1.49.0-jammy`, which must match the `@playwright/test` version), env `BASE_URL=http://web`, `MAILPIT_URL=http://mailpit:8025`, depending on web and api being healthy.
- `mailpit.ts`: `waitForVerificationLink(email: string): Promise<string>` polls `GET /api/v1/search?query=to:<email>` and then `GET /api/v1/message/<id>`, extracts `/verify?token=…` from the text body and returns the path, so the test can open `${BASE_URL}${path}`.
- `mvp.spec.ts` walks the DoD: sign up with a random email → login is blocked as unverified → verify via Mailpit → login → create a team → create an epic → create a ticket (with the epic) → drag it from New to In progress → reload → it is still in In progress → open it → add a comment → the author and time are visible → edit the title → Modified changes → delete the ticket after confirming → a team with an epic cannot be deleted (button disabled) → log out.
- `wow.spec.ts`: keyboard `Shift+ArrowRight` moves a card, and the move survives a reload. Undo after a drag restores the state. Creating "Login fails on Safari" twice shows the duplicate hint on the second. `⌘K` → type a ticket title → Enter opens it.
- `a11y.spec.ts`: `@axe-core/playwright` on login, board, ticket panel, teams and epics, with zero `serious`/`critical` violations, in both themes.
- `ci.yml`: on push/PR, job `test` runs `docker compose -f docker-compose.test.yml run --rm api-test npm run ci` (`npm run ci` = lint + typecheck + all vitest suites). Job `e2e` runs `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e` and uploads the Playwright report as an artifact.

- [ ] **Step 1: Write the three spec files** as described.
- [ ] **Step 2: Run** `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e`. Expected: all pass. Any failure is a product bug: fix it in the owning task's files and re-run.
- [ ] **Step 3: Commit.** `git commit -m "test(e2e): DoD walkthrough, wow features, axe a11y; CI workflow"`

### Task 16: README, traceability matrix, demo script, performance check

**Files:**
- Create: `e2e/scripts/seed-300.ts` (a dev-only script that creates a team and 300 tickets **through the public API** using a provided cookie; never run at startup), `docs/demo-script.md`, `docs/media/demo.gif`
- Modify: `README.md`, `.env.example`

**README sections:**
1. One-paragraph pitch and screenshot/GIF.
2. Prerequisites: Docker Desktop / Docker Engine with Compose v2.
3. Quick start (`docker compose up --build`, then open http://localhost:8080, emails at http://localhost:8025, API docs at http://localhost:8080/api/docs).
4. Configuration table (every env var, default, purpose).
5. **Using relay1.dataart.com** — a `.env` block (`SMTP_HOST=relay1.dataart.com`, `SMTP_PORT=25`, `SMTP_SECURE=false`, `MAIL_FROM=…`, `APP_BASE_URL=http://<host>:8080`).
6. Architecture (mermaid: browser → nginx(web) → api → postgres; api → SMTP).
7. Running tests (the three commands).
8. **Requirements traceability matrix**: one row per bullet of spec sections 2–11 and 13, with columns: requirement, where implemented (file), proof (test name or e2e step).
9. Stretch features and extras, kept apart from the mandatory scope.
10. Security notes (argon2id, httpOnly cookie, no tokens in URLs except the single-use verify/reset token, generated DB secret, rate limit).
11. Resetting data (`docker compose down -v`).

- [ ] **Step 1: Performance check.** Run the seed script against a running stack (`docker compose run --rm e2e npx tsx scripts/seed-300.ts`). Open the board: first paint is under 1 s, dragging stays smooth, and the filter responds immediately. The React Profiler shows no full-board re-render on a single card move: memoize `TicketCard`.
- [ ] **Step 2: Write the README and the matrix.** Every matrix row names an existing test, so walk `apps/api/test` and `e2e/tests` to confirm.
- [ ] **Step 3: Record the demo GIF** (Playwright video of `wow.spec.ts` → gif) and write `docs/demo-script.md`, a 3-minute walkthrough for the presentation.
- [ ] **Step 4: Clean-checkout check.** `git clone . /tmp/fresh && cd /tmp/fresh && docker compose up --build`. The full DoD works by hand. `git grep -nEi 'password\s*[:=]\s*["'"'"'][^"'"'"'$]'` returns only test files and the `.env.example` placeholders.
- [ ] **Step 5: Commit.** `git commit -m "docs: README with traceability matrix, demo script, perf seed tool"`

### Task 17: Independent requirements audit

- [ ] **Step 1: Dispatch a fresh `general-purpose` agent** without this conversation. Give it the repo path and the requirements file. Its prompt:
  - extract the docx text;
  - for every bullet in sections 2–13, verify it against the running system (`docker compose up --build`, `curl` against the API with a cookie jar, the Mailpit API, the Playwright e2e run) and the code;
  - report each bullet as PASS / FAIL / DOUBTFUL with evidence (command + output or file:line);
  - also flag anything from section 12 that slipped in.
- [ ] **Step 2: Fix every FAIL and DOUBTFUL** in its owning task's files, with a test where one is possible, and commit each fix.
- [ ] **Step 3: Re-run the audit agent** until the report shows zero FAILs. Report the final matrix to the user.
