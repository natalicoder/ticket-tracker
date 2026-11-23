/**
 * Dev-only performance check for a board seeded by seed-300.ts (reads SEED_OUT, default /tmp/seed.json).
 * Measures: time to first card, filter response, and the longest main-thread task during a drag.
 *   docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm e2e \
 *     sh -c "SEED_OUT=/tmp/seed.json npx tsx scripts/seed-300.ts && npx tsx scripts/perf-check.ts"
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const seed = JSON.parse(readFileSync(process.env.SEED_OUT ?? '/tmp/seed.json', 'utf8')) as { teamId: string; email: string; password: string };

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
  const login = await context.request.post('/api/auth/login', { data: { email: seed.email, password: seed.password } });
  if (!login.ok()) throw new Error(`login failed: ${login.status()}`);
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as unknown as { __long: number[] }).__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (window as unknown as { __long: number[] }).__long.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  });

  const t0 = Date.now();
  await page.goto(`/board/${seed.teamId}`);
  await page.locator('[data-ticket-id]').first().waitFor();
  const firstCard = Date.now() - t0;
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1);
  const total = await page.locator('section[data-state] header span[aria-label$="tickets"]').allTextContents();
  const rendered = await page.locator('[data-ticket-id]').count();

  const t1 = Date.now();
  await page.getByLabel('Search tickets by title').fill('invoice');
  await page.waitForFunction(() => document.querySelectorAll('[data-ticket-id]').length > 0 && [...document.querySelectorAll('[data-ticket-id]')].every((c) => /invoice/i.test(c.textContent ?? '')));
  const filterMs = Date.now() - t1;
  await page.getByLabel('Search tickets by title').fill('');

  await page.evaluate(() => ((window as unknown as { __long: number[] }).__long = []));
  const card = page.locator('section[data-state="new"] [data-ticket-id]').first();
  const target = page.locator('section[data-state="in_progress"]');
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  const t2 = Date.now();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 30, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 200, { steps: 30 });
  await page.mouse.up();
  await page.getByText(/Moved #\d+ to In progress/).waitFor();
  const dragMs = Date.now() - t2;
  const longTasks = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);

  console.log(JSON.stringify({
    columnCounts: total.map(Number),
    cardsInDom: rendered,
    firstContentfulPaintMs: Math.round(fcp),
    navigationToFirstCardMs: firstCard,
    filterResponseMs: filterMs,
    dragRoundTripMs: dragMs,
    longestTaskDuringDragMs: Math.round(Math.max(0, ...longTasks)),
  }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
