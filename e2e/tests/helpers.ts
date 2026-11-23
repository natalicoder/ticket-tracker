import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

/** Drags with real pointer moves, which dnd-kit's PointerSensor needs (it waits for a 6px movement). */
export async function dragTo(page: Page, card: Locator, target: Locator): Promise<void> {
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 140, { steps: 15 });
  await page.mouse.up();
}

export const column = (page: Page, state: string) => page.locator(`section[data-state="${state}"]`);
export const cardIn = (page: Page, state: string, title: string) => column(page, state).locator('[data-ticket-id]', { hasText: title });

async function json<T>(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as T;
}

/** API shortcuts for arranging test data; they use the page's session cookie. */
export function arrange(page: Page) {
  const api = page.request;
  return {
    team: (name: string) => api.post('/api/teams', { data: { name } }).then((r) => json<{ id: string; name: string }>(r)),
    epic: (teamId: string, title: string) => api.post('/api/epics', { data: { teamId, title } }).then((r) => json<{ id: string }>(r)),
    ticket: (teamId: string, title: string, extra: Record<string, unknown> = {}) =>
      api.post('/api/tickets', { data: { teamId, type: 'bug', title, body: 'Body', ...extra } }).then((r) => json<{ id: number }>(r)),
    getTicket: (id: number) => api.get(`/api/tickets/${id}`).then((r) => json<{ state: string; modifiedAt: string; title: string }>(r)),
  };
}

export const unique = (label: string) => `${label} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
