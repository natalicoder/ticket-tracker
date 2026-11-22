import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { storage, STORAGE_KEYS } from './storage';

export type ThemePref = 'system' | 'light' | 'dark';

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function readTheme(): ThemePref {
  const v = storage.get(STORAGE_KEYS.theme);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function applyTheme(pref: ThemePref = readTheme()): void {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const pref = useSyncExternalStore(subscribe, readTheme, () => 'system' as ThemePref);
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [pref]);
  const set = useCallback((p: ThemePref) => {
    if (p === 'system') storage.remove(STORAGE_KEYS.theme);
    else storage.set(STORAGE_KEYS.theme, p);
    emit();
  }, []);
  return [pref, set];
}

function readCelebrate(): boolean {
  return storage.get(STORAGE_KEYS.celebrate) !== 'off';
}

export function celebrateEnabled(): boolean {
  return readCelebrate() && !prefersReducedMotion();
}

export function useCelebrate(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, readCelebrate, () => true);
  const set = useCallback((v: boolean) => {
    storage.set(STORAGE_KEYS.celebrate, v ? 'on' : 'off');
    emit();
  }, []);
  return [on, set];
}

export function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function rememberTeam(teamId: string): void {
  storage.set(STORAGE_KEYS.lastTeam, teamId);
}

export function lastTeam(): string | null {
  return storage.get(STORAGE_KEYS.lastTeam);
}
