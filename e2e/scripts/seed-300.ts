/**
 * Dev-only performance fixture: creates one team, 5 epics and 300 tickets through the public API.
 * Never run at startup. Usage (stack running):
 *   docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm e2e npx tsx scripts/seed-300.ts
 * Credentials: SEED_EMAIL + SEED_PASSWORD for an existing verified account; otherwise a new account is
 * signed up and verified through Mailpit. Prints the board URL and the credentials it used.
 */
import { uniqueEmail, waitForVerificationLink } from '../tests/mailpit';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const COUNT = Number(process.env.SEED_COUNT ?? 300);
const STATES = ['new', 'ready_for_implementation', 'in_progress', 'ready_for_acceptance', 'done'] as const;
const TYPES = ['bug', 'feature', 'fix'] as const;
const VERBS = ['Fix', 'Add', 'Refactor', 'Investigate', 'Document', 'Speed up', 'Remove', 'Polish'];
const NOUNS = ['login form', 'invoice export', 'search index', 'email templates', 'board filters', 'audit log', 'password reset', 'team settings', 'API pagination', 'dark mode'];

let cookie = '';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0]!;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

async function login(): Promise<{ email: string; password: string }> {
  let email = process.env.SEED_EMAIL;
  let password = process.env.SEED_PASSWORD;
  if (!email || !password) {
    email = uniqueEmail('perf');
    password = 'perf-password-1';
    await call('POST', '/api/auth/signup', { email, password });
    const link = await waitForVerificationLink(email);
    await call('POST', '/api/auth/verify', { token: new URL(link, BASE_URL).searchParams.get('token') });
  }
  await call('POST', '/api/auth/login', { email, password });
  return { email, password };
}

async function main() {
  const creds = await login();
  const team = await call<{ id: string }>('POST', '/api/teams', { name: `Perf ${COUNT} ${Date.now().toString(36)}` });
  const epics: string[] = [];
  for (const title of ['Onboarding', 'Billing', 'Search', 'Reliability', 'Design system']) {
    epics.push((await call<{ id: string }>('POST', '/api/epics', { teamId: team.id, title })).id);
  }
  const started = Date.now();
  for (let i = 0; i < COUNT; i += 10) {
    await Promise.all(
      Array.from({ length: Math.min(10, COUNT - i) }, (_, k) => {
        const n = i + k;
        return call('POST', '/api/tickets', {
          teamId: team.id,
          type: TYPES[n % TYPES.length],
          state: STATES[n % STATES.length],
          epicId: n % 3 === 0 ? null : epics[n % epics.length],
          title: `${VERBS[n % VERBS.length]} ${NOUNS[(n * 7) % NOUNS.length]} (${n + 1})`,
          body: n % 4 === 0 ? '- [x] reproduce\n- [ ] fix\n- [ ] test' : `Generated ticket ${n + 1}.`,
        });
      }),
    );
  }
  console.log(`Created ${COUNT} tickets in ${Date.now() - started} ms`);
  console.log(`Board: ${BASE_URL}/board/${team.id}`);
  console.log(`Log in as ${creds.email} / ${creds.password}`);
  if (process.env.SEED_OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.SEED_OUT, JSON.stringify({ teamId: team.id, ...creds }));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
