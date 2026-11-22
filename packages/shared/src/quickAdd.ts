import { TICKET_TYPES, type TicketType } from './enums.js';

export interface QuickAddResult {
  type?: TicketType;
  epicId?: string;
  /** Set when an `@word` token did not match any epic. */
  epicQuery?: string;
  title: string;
}

const TYPE_PREFIX = new RegExp(`^(${TICKET_TYPES.join('|')})\\s*:\\s*`, 'i');
const EPIC_TOKEN = /(^|\s)@([\p{L}\p{N}_-]+)/u;

function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function findEpic<E extends { id: string; title: string }>(query: string, epics: readonly E[]): E | undefined {
  const q = query.toLowerCase();
  return epics.find((e) => {
    const title = e.title.toLowerCase();
    return title.startsWith(q) || words(title).includes(q);
  });
}

/**
 * Parses a one-line ticket description such as `bug: Login fails @auth`.
 * - `bug:` / `feature:` / `fix:` at the very start sets the type (case-insensitive).
 * - The first `@word` picks the first epic whose title starts with `word` or contains it as a whole word.
 * - Whatever remains is the title.
 */
export function parseQuickAdd(input: string, epics: readonly { id: string; title: string }[]): QuickAddResult {
  let rest = input.trim();
  const result: QuickAddResult = { title: '' };

  const typeMatch = TYPE_PREFIX.exec(rest);
  if (typeMatch) {
    result.type = typeMatch[1]!.toLowerCase() as TicketType;
    rest = rest.slice(typeMatch[0].length);
  }

  const epicMatch = EPIC_TOKEN.exec(rest);
  if (epicMatch) {
    const query = epicMatch[2]!;
    const epic = findEpic(query, epics);
    if (epic) result.epicId = epic.id;
    else result.epicQuery = query;
    rest = rest.slice(0, epicMatch.index) + epicMatch[1] + rest.slice(epicMatch.index + epicMatch[0].length);
  }

  result.title = rest.replace(/\s+/g, ' ').trim();
  return result;
}
