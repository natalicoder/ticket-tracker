/** localStorage is only a convenience here: every access tolerates it being absent or blocked. */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const STORAGE_KEYS = {
  lastTeam: 'ticketing.lastTeamId',
  theme: 'ticketing.theme',
  celebrate: 'ticketing.celebrate',
} as const;
