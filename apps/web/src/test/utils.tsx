import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';

export function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
}

export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  });
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Routes fetch calls by "METHOD /path" prefix; unmatched calls fail the test loudly. */
export function mockFetch(routes: Record<string, Handler | { status: number; body?: unknown }>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init.method ?? 'GET').toUpperCase();
    const key = Object.keys(routes)
      .filter((k) => {
        const [m, p] = k.split(' ');
        return m === method && url.startsWith(p!);
      })
      .sort((a, b) => b.length - a.length)[0];
    if (!key) throw new Error(`unexpected fetch ${method} ${url}`);
    const r = routes[key]!;
    return typeof r === 'function' ? r(url, init) : jsonResponse(r.status, r.body);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

export function renderWithProviders(ui: ReactElement, opts: { route?: string; path?: string; client?: QueryClient; extraRoutes?: ReactElement } = {}) {
  const client = opts.client ?? newQueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[opts.route ?? '/']}>
        <Routes>
          <Route path={opts.path ?? '*'} element={ui} />
          {opts.extraRoutes}
          <Route path="/__probe" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, client };
}
