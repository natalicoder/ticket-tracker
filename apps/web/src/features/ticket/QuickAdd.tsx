import { parseQuickAdd, type EpicDto, type TicketState } from '@ticketing/shared';
import { AlertTriangle, Layers, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Chip, TypeBadge } from '../../components/ui/Badge';

export function quickAddUrl(teamId: string, state: TicketState, text: string, epics: Pick<EpicDto, 'id' | 'title'>[]): string | null {
  const parsed = parseQuickAdd(text, epics);
  if (!parsed.title) return null;
  const params = new URLSearchParams({ teamId, state });
  if (parsed.type) params.set('type', parsed.type);
  if (parsed.epicId) params.set('epicId', parsed.epicId);
  params.set('title', parsed.title);
  return `/tickets/new?${params}`;
}

export function QuickAddPreview({ text, epics }: { text: string; epics: EpicDto[] }) {
  const parsed = useMemo(() => parseQuickAdd(text, epics), [text, epics]);
  const epic = epics.find((e) => e.id === parsed.epicId);
  if (!parsed.type && !epic && !parsed.epicQuery) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
      {parsed.type && <TypeBadge type={parsed.type} />}
      {epic && (
        <Chip>
          <Layers className="h-3 w-3" aria-hidden />
          {epic.title}
        </Chip>
      )}
      {parsed.epicQuery && (
        <span className="inline-flex items-center gap-1 text-2xs font-medium text-warn">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Unknown epic @{parsed.epicQuery}
        </span>
      )}
    </div>
  );
}

/**
 * One-line ticket entry: `bug: Login fails @auth`. Enter opens the create form with type, epic, title
 * and the column's state filled in; the body is required, so the form focuses it.
 */
export function QuickAdd({ teamId, state, epics, defaultOpen = false }: { teamId: string; state: TicketState; epics: EpicDto[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted hover:bg-ink/5 hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add ticket
      </button>
    );
  }

  const submit = () => {
    const url = quickAddUrl(teamId, state, text, epics);
    if (!url) return;
    navigate(url, { state: { background: location } });
    setText('');
    setOpen(false);
  };

  return (
    <div className="rounded-md border border-line bg-surface p-2 shadow-card">
      <input
        autoFocus
        aria-label="Quick add ticket"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            setText('');
            setOpen(false);
          }
        }}
        onBlur={() => !text && setOpen(false)}
        placeholder="bug: Login fails @epic"
        className="w-full bg-transparent text-[13px] placeholder:text-muted/80 focus:outline-none"
      />
      <div className="mt-1.5 flex min-h-[1.25rem] items-center justify-between gap-2">
        <QuickAddPreview text={text} epics={epics} />
        <span className="ml-auto shrink-0 text-2xs text-muted">Enter to continue</span>
      </div>
    </div>
  );
}
