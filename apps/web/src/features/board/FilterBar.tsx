import { TICKET_TYPES, TYPE_LABELS, type EpicDto } from '@ticketing/shared';
import { Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Select } from '../../components/ui/Field';
import { Kbd } from '../../components/ui/misc';
import { onCommand } from '../../lib/events';
import { hasFilters, type BoardFilters } from './filterTickets';

interface FilterBarProps {
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
  epics: EpicDto[];
  shown: number;
  total: number;
}

export function FilterBar({ filters, onChange, epics, shown, total }: FilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(
    () =>
      onCommand((c) => {
        if (c === 'focus-search') {
          searchRef.current?.focus();
          searchRef.current?.select();
        }
      }),
    [],
  );
  const active = hasFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter tickets">
      <div className="relative w-full sm:w-64">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <label htmlFor="board-search" className="sr-only">
          Search tickets by title
        </label>
        <input
          ref={searchRef}
          id="board-search"
          type="search"
          value={filters.q ?? ''}
          onChange={(e) => onChange({ ...filters, q: e.target.value || undefined })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onChange({ ...filters, q: undefined });
              e.currentTarget.blur();
            }
          }}
          placeholder="Search titles"
          className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-8 text-sm placeholder:text-muted/80 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
        {!filters.q && <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>}
      </div>
      <div className="w-[8.5rem]">
        <label htmlFor="filter-type" className="sr-only">
          Type
        </label>
        <Select id="filter-type" className="h-8" value={filters.type ?? ''} onChange={(e) => onChange({ ...filters, type: (e.target.value || undefined) as BoardFilters['type'] })}>
          <option value="">All types</option>
          {TICKET_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[11rem]">
        <label htmlFor="filter-epic" className="sr-only">
          Epic
        </label>
        <Select id="filter-epic" className="h-8" value={filters.epic ?? ''} onChange={(e) => onChange({ ...filters, epic: e.target.value || undefined })}>
          <option value="">All epics</option>
          <option value="none">No epic</option>
          {epics.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
      </div>
      {active && (
        <>
          <button type="button" onClick={() => onChange({})} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-ink-2 hover:bg-ink/5">
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
          </button>
          <span className="text-xs text-muted" role="status">
            Showing {shown} of {total}
          </span>
        </>
      )}
    </div>
  );
}
