import { isTicketType, type TicketCardDto, type TicketType } from '@ticketing/shared';

export interface BoardFilters {
  type?: TicketType;
  /** Epic id, or 'none' for tickets without an epic. */
  epic?: string;
  q?: string;
}

/** All filters combine with AND. The search is a trimmed, case-insensitive substring of the title, or `#id`. */
export function filterTickets(cards: TicketCardDto[], f: BoardFilters): TicketCardDto[] {
  const q = f.q?.trim().toLowerCase() ?? '';
  const idQuery = /^#\d+$/.test(q) ? Number(q.slice(1)) : null;
  return cards.filter((c) => {
    if (f.type && c.type !== f.type) return false;
    if (f.epic === 'none' ? c.epicId !== null : f.epic && c.epicId !== f.epic) return false;
    if (q) {
      if (idQuery !== null) return c.id === idQuery;
      if (!c.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function hasFilters(f: BoardFilters): boolean {
  return !!(f.type || f.epic || f.q?.trim());
}

export function filtersFromSearchParams(sp: URLSearchParams): BoardFilters {
  const out: BoardFilters = {};
  const type = sp.get('type');
  if (isTicketType(type)) out.type = type;
  const epic = sp.get('epic');
  if (epic) out.epic = epic;
  const q = sp.get('q');
  if (q) out.q = q;
  return out;
}

export function filtersToSearchParams(f: BoardFilters, base?: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base);
  for (const key of ['type', 'epic', 'q'] as const) {
    const value = f[key];
    if (value) sp.set(key, value);
    else sp.delete(key);
  }
  return sp;
}
