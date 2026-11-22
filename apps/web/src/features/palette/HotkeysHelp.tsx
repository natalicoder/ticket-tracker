import { Dialog } from '../../components/ui/Dialog';
import { Kbd, modKey } from '../../components/ui/misc';

const GROUPS: Array<{ title: string; items: Array<[keys: string[], label: string]> }> = [
  {
    title: 'Anywhere',
    items: [
      [[modKey, 'K'], 'Search, jump to and run commands'],
      [['C'], 'New ticket'],
      [['?'], 'Show keyboard shortcuts'],
      [['G', 'B'], 'Go to board'],
      [['G', 'E'], 'Go to epics'],
      [['G', 'T'], 'Go to teams'],
    ],
  },
  {
    title: 'Board',
    items: [
      [['/'], 'Search tickets'],
      [['J', 'K'], 'Next / previous ticket in a column (or ↓ ↑)'],
      [['H', 'L'], 'Previous / next column (or ← →)'],
      [['Shift', '→'], 'Move ticket to the next state'],
      [['Shift', '←'], 'Move ticket to the previous state'],
      [['Enter'], 'Open ticket'],
      [['Space'], 'Pick up a ticket to drag; arrows move it, Space drops'],
    ],
  },
  {
    title: 'Ticket',
    items: [
      [[modKey, 'Enter'], 'Save, or send a comment'],
      [['Esc'], 'Close'],
    ],
  },
];

export function HotkeysHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" className="max-w-lg">
      <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-xs font-semibold text-muted">{g.title}</h3>
            <ul className="divide-y divide-line">
              {g.items.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                  <span className="text-ink-2">{label}</span>
                  <span className="flex shrink-0 gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
