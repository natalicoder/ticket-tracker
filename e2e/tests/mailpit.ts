const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface SearchResult {
  messages: Array<{ ID: string; Subject: string }>;
}

async function latestMessage(email: string, subject: RegExp, timeoutMs: number): Promise<{ Text: string; HTML: string; Subject: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    if (res.ok) {
      const data = (await res.json()) as SearchResult;
      const hit = data.messages.find((m) => subject.test(m.Subject));
      if (hit) {
        const msg = await fetch(`${MAILPIT_URL}/api/v1/message/${hit.ID}`);
        return (await msg.json()) as { Text: string; HTML: string; Subject: string };
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email matching ${subject} for ${email} within ${timeoutMs} ms`);
}

/** Polls Mailpit for the newest verification email and returns its link path, e.g. `/verify?token=…`. */
export async function waitForVerificationLink(email: string, timeoutMs = 15_000): Promise<string> {
  const msg = await latestMessage(email, /verify/i, timeoutMs);
  const match = /https?:\/\/[^\s"<]+(\/verify\?token=[A-Za-z0-9_-]+)/.exec(msg.Text);
  if (!match) throw new Error(`No verification link in email to ${email}`);
  return match[1]!;
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}
