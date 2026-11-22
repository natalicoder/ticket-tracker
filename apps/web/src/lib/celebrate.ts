import { celebrateEnabled } from './prefs';

const COLORS = ['#2968c9', '#c4800c', '#804ecd', '#1e8758', '#3d4ed8'];

/** A small confetti burst from a ticket card. Skipped when turned off or with reduced motion. */
export function celebrate(ticketId: number): void {
  try {
    if (!celebrateEnabled() || typeof HTMLCanvasElement === 'undefined') return;
    const el = document.querySelector(`[data-ticket-id="${ticketId}"]`);
    const r = el?.getBoundingClientRect();
    const origin = r && r.width > 0 ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight } : { x: 0.5, y: 0.4 };
    void import('canvas-confetti')
      .then(({ default: confetti }) =>
        confetti({ particleCount: 70, spread: 75, startVelocity: 30, gravity: 1.1, ticks: 140, scalar: 0.85, origin, colors: COLORS, disableForReducedMotion: true, zIndex: 60 }),
      )
      .catch(() => undefined);
  } catch {
    /* purely decorative */
  }
}
