import { request, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { STORAGE_STATE } from '../playwright.config';
import { uniqueEmail, waitForVerificationLink } from './mailpit';

export const PASSWORD = 'correct horse battery';

/** Creates one verified, logged-in user shared by the feature specs (the DoD spec signs up its own). */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  const ctx = await request.newContext({ baseURL });
  const email = uniqueEmail('shared');
  const signup = await ctx.post('/api/auth/signup', { data: { email, password: PASSWORD } });
  if (signup.status() !== 201) throw new Error(`signup failed: ${signup.status()} ${await signup.text()}`);
  const link = await waitForVerificationLink(email);
  const token = new URL(link, baseURL).searchParams.get('token');
  const verify = await ctx.post('/api/auth/verify', { data: { token } });
  if (!verify.ok()) throw new Error(`verify failed: ${await verify.text()}`);
  const login = await ctx.post('/api/auth/login', { data: { email, password: PASSWORD } });
  if (!login.ok()) throw new Error(`login failed: ${await login.text()}`);
  mkdirSync('.auth', { recursive: true });
  await ctx.storageState({ path: STORAGE_STATE });
  process.env.E2E_SHARED_EMAIL = email;
  await ctx.dispose();
}
