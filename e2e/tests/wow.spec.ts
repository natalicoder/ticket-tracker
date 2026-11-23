import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../playwright.config';
import { arrange, cardIn, column, dragTo, unique } from './helpers';

test.use({ storageState: STORAGE_STATE });

test('keyboard: focus a card and move it with Shift+→; the move persists', async ({ page }) => {
  const a = arrange(page);
  const team = await a.team(unique('Keys'));
  const t = await a.ticket(team.id, 'Keyboard me');
  await page.goto(`/board/${team.id}`);
  await expect(cardIn(page, 'new', 'Keyboard me')).toBeVisible();
  await page.keyboard.press('j');
  await expect(cardIn(page, 'new', 'Keyboard me')).toBeFocused();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(cardIn(page, 'ready_for_implementation', 'Keyboard me')).toBeVisible();
  await expect.poll(async () => (await a.getTicket(t.id)).state).toBe('ready_for_implementation');
  await page.reload();
  await expect(cardIn(page, 'ready_for_implementation', 'Keyboard me')).toBeVisible();
});

test('undo after a drag puts the ticket back', async ({ page }) => {
  const a = arrange(page);
  const team = await a.team(unique('Undo'));
  const t = await a.ticket(team.id, 'Undo me');
  await page.goto(`/board/${team.id}`);
  await dragTo(page, cardIn(page, 'new', 'Undo me'), column(page, 'done'));
  await expect(cardIn(page, 'done', 'Undo me')).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cardIn(page, 'new', 'Undo me')).toBeVisible();
  await expect.poll(async () => (await a.getTicket(t.id)).state).toBe('new');
});

test('creating a similar ticket shows a duplicate hint', async ({ page }) => {
  const a = arrange(page);
  const team = await a.team(unique('Dupes'));
  await a.ticket(team.id, 'Login fails on Safari');
  await page.goto(`/tickets/new?teamId=${team.id}`);
  await page.getByLabel('Title').fill('Login fails on Safari');
  await expect(page.getByText('Possibly duplicates:')).toBeVisible();
  await expect(page.getByRole('link', { name: /Login fails on Safari/ })).toBeVisible();
});

test('command palette finds a ticket and opens it', async ({ page }) => {
  const a = arrange(page);
  const team = await a.team(unique('Palette'));
  const t = await a.ticket(team.id, 'Export invoices as PDF', { type: 'feature' });
  await page.goto(`/board/${team.id}`);
  await expect(cardIn(page, 'new', 'Export invoices')).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder(/Search tickets/).fill('invoices');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/tickets/${t.id}$`));
  await expect(page.getByRole('dialog').getByLabel('Title')).toHaveValue('Export invoices as PDF');
});

test('quick add opens a prefilled form', async ({ page }) => {
  const a = arrange(page);
  const team = await a.team(unique('Quick'));
  await a.epic(team.id, 'Payments');
  await a.ticket(team.id, 'Existing ticket'); // an empty board shows onboarding instead of columns
  await page.goto(`/board/${team.id}`);
  await column(page, 'in_progress').getByRole('button', { name: 'Add ticket' }).click();
  await page.keyboard.type('bug: Card declined @pay');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByLabel('Title')).toHaveValue('Card declined');
  await expect(sheet.getByLabel('Type')).toHaveValue('bug');
  await expect(sheet.getByLabel('State')).toHaveValue('in_progress');
  await expect(sheet.getByLabel('Epic').locator('option:checked')).toHaveText('Payments');
  await expect(sheet.getByLabel('Body', { exact: true })).toBeFocused();
});

test('filters combine and live in the URL', async ({ page }) => {
  const a = arrange(page);
  const team = await a.team(unique('Filters'));
  await a.ticket(team.id, 'Fix login bug', { type: 'bug' });
  await a.ticket(team.id, 'Login with SSO', { type: 'feature' });
  await a.ticket(team.id, 'Crash on logout', { type: 'bug' });
  await page.goto(`/board/${team.id}`);
  await page.getByLabel('Search tickets by title').fill('LOGIN');
  await page.getByLabel('Type').selectOption('bug');
  await expect(page.locator('[data-ticket-id]')).toHaveCount(1);
  await expect(page).toHaveURL(/type=bug/);
  await page.reload();
  await expect(page.locator('[data-ticket-id]')).toHaveCount(1);
  await expect(page.getByText('Fix login bug')).toBeVisible();
});

test('an expired session sends the user to login and back', async ({ page, context }) => {
  const a = arrange(page);
  const team = await a.team(unique('Session'));
  await page.goto(`/board/${team.id}`);
  await expect(page.getByRole('heading', { name: team.name })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Teams' }).click();
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  const cookies = await context.cookies();
  await context.clearCookies();
  // The next API call fails with 401: the app must send the user to login, remembering where they were.
  await page.getByRole('button', { name: 'New team' }).click();
  await page.getByRole('textbox', { name: 'Team name' }).fill(unique('Never'));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/login\?next=%2Fteams/);
  await expect(page.getByText(/session ended/i)).toBeVisible();
  await context.addCookies(cookies);
});
