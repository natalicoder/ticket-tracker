export const TICKET_TYPES = ['bug', 'feature', 'fix'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

/** Canonical workflow order. */
export const TICKET_STATES = ['new', 'ready_for_implementation', 'in_progress', 'ready_for_acceptance', 'done'] as const;
export type TicketState = (typeof TICKET_STATES)[number];

export const STATE_LABELS: Record<TicketState, string> = {
  new: 'New',
  ready_for_implementation: 'Ready for implementation',
  in_progress: 'In progress',
  ready_for_acceptance: 'Ready for acceptance',
  done: 'Done',
};

export const TYPE_LABELS: Record<TicketType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  fix: 'Fix',
};

export function isTicketState(value: unknown): value is TicketState {
  return typeof value === 'string' && (TICKET_STATES as readonly string[]).includes(value);
}

export function isTicketType(value: unknown): value is TicketType {
  return typeof value === 'string' && (TICKET_TYPES as readonly string[]).includes(value);
}
