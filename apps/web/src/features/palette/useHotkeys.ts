import { useEffect, useRef } from 'react';

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

const ALWAYS = new Set(['mod+k', 'Escape']);

export function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]');
}

/**
 * Global shortcuts. Keys: "mod+k" (⌘/Ctrl), single keys ("c", "/", "?"), and two-key sequences ("g b").
 * Ignored while typing in a field or when a dialog is open, except mod+k and Escape.
 */
export function useHotkeys(map: HotkeyMap): void {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    let pending: { key: string; at: number } | null = null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = mod ? `mod+${e.key.toLowerCase()}` : e.key;
      const blocked = isEditable(e.target) || dialogOpen();
      if (blocked && !ALWAYS.has(key)) return;
      if (!mod && e.altKey) return;
      const handlers = mapRef.current;

      if (pending && Date.now() - pending.at < 1200) {
        const seq = `${pending.key} ${key}`;
        pending = null;
        if (handlers[seq]) {
          e.preventDefault();
          handlers[seq]!(e);
          return;
        }
      }
      if (!mod && Object.keys(handlers).some((k) => k.startsWith(`${key} `))) {
        pending = { key, at: Date.now() };
        return;
      }
      if (handlers[key]) {
        e.preventDefault();
        handlers[key]!(e);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
