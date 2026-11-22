/** Tiny app-wide event bus for UI commands (open palette, show shortcuts, …). */
export type AppCommand = 'palette' | 'shortcuts' | 'new-ticket' | 'focus-search';

const EVENT = 'ticketing:command';

export function sendCommand(command: AppCommand): void {
  window.dispatchEvent(new CustomEvent<AppCommand>(EVENT, { detail: command }));
}

export function onCommand(handler: (command: AppCommand) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<AppCommand>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
