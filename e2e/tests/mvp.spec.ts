import { expect, test } from '@playwright/test';
import { cardIn, column, dragTo, unique } from './helpers';
import { uniqueEmail, waitForVerificationLink } from './mailpit';

// Walks the Definition of Done from a brand-new account, entirely through the UI.
test('DoD walkthrough: sign up → verify → board → ticket lifecycle → log out', async ({ page }) => {
  const email = uniqueEmail('dod');
  const password = 'password-123';
  const teamName = unique('Core');
  const epicTitle = unique('Checkout');
  const title = unique('Login fails on Safari');

  await test.step('sign up', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole('link', { name: 'Create an account' }).click();
    await page.getByLabel('Email').fill(`  ${email.toUpperCase()} `);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  await test.step('login is blocked until the email is verified', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText(/verify your email first/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  await test.step('verify through the link from Mailpit', async () => {
    const link = await waitForVerificationLink(email);
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
    await page.getByRole('link', { name: 'Go to login' }).click();
  });

  await test.step('log in', async () => {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).not.toHaveURL(/\/login/);
    // Teams are shared by all users: depending on what already exists, the user lands on onboarding or a board.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  await test.step('create a team and open its board', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Teams' }).click();
    await page.getByRole('button', { name: 'New team' }).first().click();
    await page.getByRole('textbox', { name: 'Team name' }).fill(teamName);
    await page.keyboard.press('Enter');
    await page.getByRole('link', { name: teamName }).click();
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your board is ready' })).toBeVisible();
  });

  await test.step('create an epic', async () => {
    await page.getByRole('link', { name: 'Add an epic' }).click();
    await page.getByRole('button', { name: 'New epic' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title').fill(epicTitle);
    await dialog.getByRole('button', { name: 'Create epic' }).click();
    await expect(page.getByRole('link', { name: epicTitle })).toBeVisible();
  });

  await test.step('create a ticket with the epic', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Board' }).click();
    await page.getByRole('button', { name: /^New ticket/ }).first().click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Title').fill(title);
    await sheet.getByLabel('Type').selectOption('bug');
    await sheet.getByLabel('Epic').selectOption({ label: epicTitle });
    await sheet.getByLabel('Body', { exact: true }).fill('Steps:\n- [ ] reproduce\n- [ ] fix');
    await sheet.getByRole('button', { name: 'Create ticket' }).click();
    await expect(cardIn(page, 'new', title)).toBeVisible();
    await expect(cardIn(page, 'new', title)).toContainText(epicTitle);
  });

  await test.step('drag it to In progress; it stays there after reload', async () => {
    await dragTo(page, cardIn(page, 'new', title), column(page, 'in_progress'));
    await expect(cardIn(page, 'in_progress', title)).toBeVisible();
    await expect(page.getByText(/Moved #\d+ to In progress/)).toBeVisible();
    await page.reload();
    await expect(cardIn(page, 'in_progress', title)).toBeVisible();
    await expect(cardIn(page, 'new', title)).toHaveCount(0);
  });

  await test.step('open it and add a comment', async () => {
    await cardIn(page, 'in_progress', title).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByLabel('Title')).toHaveValue(title);
    await expect(sheet.getByText('Created by')).toBeVisible();
    await sheet.getByLabel('Add a comment').fill('Reproduced on Safari 17.');
    await sheet.getByRole('button', { name: 'Comment', exact: true }).click();
    const comment = sheet.getByRole('listitem').filter({ hasText: 'Reproduced on Safari 17.' });
    await expect(comment).toBeVisible();
    await expect(comment).toContainText(email);
    await expect(comment.locator('time')).toHaveAttribute('datetime', /Z$/);
  });

  await test.step('edit the title; Modified changes', async () => {
    const sheet = page.getByRole('dialog');
    const modified = sheet.locator('dt', { hasText: 'Modified' }).locator('xpath=following-sibling::dd[1]//time');
    const before = await modified.getAttribute('datetime');
    await sheet.getByLabel('Title').fill(`${title} (renamed)`);
    await sheet.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Changes saved')).toBeVisible();
    await expect(modified).not.toHaveAttribute('datetime', before!);
  });

  await test.step('delete the ticket after confirming', async () => {
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Delete ticket' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('1 comment');
    await confirm.getByRole('button', { name: 'Delete ticket' }).click();
    await expect(page.getByText(/Ticket #\d+ deleted/)).toBeVisible();
    await expect(page.locator('[data-ticket-id]', { hasText: title })).toHaveCount(0);
  });

  await test.step('a team that still has an epic cannot be deleted', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Teams' }).click();
    const del = page.getByRole('button', { name: `Delete team ${teamName}` });
    await expect(del).toHaveAttribute('aria-disabled', 'true');
    await expect(del).toHaveAccessibleDescription(/1 epic/);
  });

  await test.step('log out', async () => {
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/teams');
    await expect(page).toHaveURL(/\/login\?next=%2Fteams/);
  });
});
