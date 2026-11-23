import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { STORAGE_STATE } from '../playwright.config';
import { arrange, unique } from './helpers';

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = serious.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
  expect(serious, `${label}\n${summary}`).toEqual([]);
  // Nested <form>s are invalid HTML and submit the wrong form (this suite once caught that bug).
  expect(await page.locator('form form').count(), `${label}: nested forms`).toBe(0);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('login and signup pages', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
      await expectNoSeriousViolations(page, 'login');
      await page.goto('/signup');
      await expectNoSeriousViolations(page, 'signup');
    });

    test.describe('signed in', () => {
      test.use({ storageState: STORAGE_STATE });

      test('board, ticket panel, teams and epics', async ({ page }) => {
        const a = arrange(page);
        const team = await a.team(unique(`A11y ${scheme}`));
        const epic = await a.epic(team.id, 'Accessibility');
        const t = await a.ticket(team.id, 'Screen reader labels', { epicId: epic.id, body: '- [x] audit\n- [ ] fix' });
        await a.ticket(team.id, 'Contrast in dark mode', { type: 'fix', state: 'in_progress' });

        await page.goto(`/board/${team.id}`);
        await expect(page.locator('[data-board]')).toBeVisible();
        await expectNoSeriousViolations(page, 'board');

        await page.locator(`[data-ticket-id="${t.id}"]`).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expectNoSeriousViolations(page, 'ticket panel');
        await page.keyboard.press('Escape');

        await page.goto('/teams');
        await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
        await expectNoSeriousViolations(page, 'teams');

        await page.goto(`/epics?team=${team.id}`);
        await expect(page.getByRole('heading', { name: 'Epics' })).toBeVisible();
        await expectNoSeriousViolations(page, 'epics');
      });
    });
  });
}
