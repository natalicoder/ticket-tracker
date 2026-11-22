import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../test/utils';
import { api, ApiError, setOnUnauthenticated } from './client';

afterEach(() => setOnUnauthenticated(null));

describe('api client', () => {
  it('turns an error body into an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty', details: [{ path: 'name', message: 'Name must not be empty' }] } })));
    const err = await api('/api/teams', { method: 'POST', body: { name: ' ' } }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Name must not be empty', details: [{ path: 'name', message: 'Name must not be empty' }] });
  });

  it('sends JSON with credentials and parses JSON back', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { id: 't1' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/api/teams', { method: 'POST', body: { name: 'Core' } })).resolves.toEqual({ id: 't1' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', body: '{"name":"Core"}' });
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('does not send a content-type without a body', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(204));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/api/teams/x', { method: 'DELETE' })).resolves.toBeUndefined();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['content-type']).toBeUndefined();
  });

  it('calls the unauthenticated handler once on a 401 UNAUTHENTICATED and throws', async () => {
    const handler = vi.fn();
    setOnUnauthenticated(handler);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Please log in to continue.' } })));
    await expect(api('/api/teams')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not redirect on a wrong password (401 INVALID_CREDENTIALS)', async () => {
    const handler = vi.fn();
    setOnUnauthenticated(handler);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } })));
    await expect(api('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('reports a network failure as an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api('/api/teams')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('reports a non-JSON error (e.g. proxy 502) with a readable message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(api('/api/teams')).rejects.toMatchObject({ status: 502, code: 'HTTP_502' });
  });
});
