/**
 * Dev-only: records the README media from a board seeded by seed-300.ts (SEED_OUT, default /tmp/seed.json).
 * Writes test-results/media/board.png, board-dark.png and demo.webm (converted to a GIF outside this container).
 */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, renameSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const OUT = 'test-results/media';
const seed = JSON.parse(readFileSync(process.env.SEED_OUT ?? '/tmp/seed.json', 'utf8')) as { teamId: string; email: string; password: string };
const size = { width: 1280, height: 760 };
const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

async function newContext(colorScheme: 'light' | 'dark', video: boolean) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: size,
    colorScheme,
    ...(video ? { recordVideo: { dir: `${OUT}/raw`, size } } : {}),
  });
  const login = await context.request.post('/api/auth/login', { data: { email: seed.email, password: seed.password } });
  if (!login.ok()) throw new Error(`login failed: ${login.status()}`);
  return { browser, context };
}

async function glide(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 25 });
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  for (const scheme of ['light', 'dark'] as const) {
    const { browser, context } = await newContext(scheme, false);
    const page = await context.newPage();
    await page.goto(`/board/${seed.teamId}`);
    await page.locator('[data-ticket-id]').first().waitFor();
    await pause(page, 600);
    await page.screenshot({ path: `${OUT}/${scheme === 'light' ? 'board' : 'board-dark'}.png` });
    await browser.close();
  }

  const { browser, context } = await newContext('light', true);
  const page = await context.newPage();
  await page.goto(`/board/${seed.teamId}`);
  await page.locator('[data-ticket-id]').first().waitFor();
  await pause(page, 1200);

  // 1. Drag a card from New to In progress, then undo.
  const card = page.locator('section[data-state="new"] [data-ticket-id]').first();
  const from = (await card.boundingBox())!;
  const to = (await page.locator('section[data-state="in_progress"]').boundingBox())!;
  await glide(page, from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 15, from.y + from.height / 2 + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 160, { steps: 40 });
  await pause(page, 300);
  await page.mouse.up();
  await page.getByText(/Moved #\d+ to In progress/).waitFor();
  await pause(page, 1200);
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const u = (await undo.boundingBox())!;
  await glide(page, u.x + u.width / 2, u.y + u.height / 2);
  await undo.click();
  await pause(page, 1400);

  // 2. Keyboard: focus a card and move it one state right.
  await page.mouse.move(size.width / 2, size.height - 10);
  await page.keyboard.press('j');
  await pause(page, 500);
  await page.keyboard.press('j');
  await pause(page, 500);
  await page.keyboard.press('Shift+ArrowRight');
  await pause(page, 1400);

  // 3. Command palette: find a ticket and open it.
  await page.keyboard.press('Control+k');
  await pause(page, 400);
  await page.keyboard.type('invoice', { delay: 90 });
  await pause(page, 700);
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  await pause(page, 2000);
  await page.keyboard.press('Escape');
  await pause(page, 700);

  // 4. Quick add with type and epic shortcuts.
  const add = page.locator('section[data-state="ready_for_implementation"]').getByRole('button', { name: 'Add ticket' });
  const a = (await add.boundingBox())!;
  await glide(page, a.x + a.width / 2, a.y + a.height / 2);
  await add.click();
  await page.keyboard.type('bug: Card declined on checkout @bill', { delay: 60 });
  await pause(page, 900);
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  await pause(page, 1800);
  await page.keyboard.press('Escape');
  await pause(page, 600);

  // 5. Filters combine and land in the URL.
  await page.getByLabel('Search tickets by title').click();
  await page.keyboard.type('login', { delay: 90 });
  await pause(page, 600);
  await page.getByLabel('Type').selectOption('bug');
  await pause(page, 1800);

  const video = page.video()!;
  await context.close();
  await browser.close();
  renameSync(await video.path(), `${OUT}/demo.webm`);
  console.log(`Wrote ${OUT}/board.png, board-dark.png, demo.webm`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
