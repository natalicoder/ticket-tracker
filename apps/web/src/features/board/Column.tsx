import { useDraggable, useDroppable } from '@dnd-kit/core';
import { STATE_LABELS, type TicketCardDto, type TicketState } from '@ticketing/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { memo, useRef, type ReactNode } from 'react';
import { STATE_COLOR } from '../../components/ui/Badge';
import { cn } from '../../lib/cn';
import { TicketCard } from './TicketCard';

export const VIRTUALIZE_AFTER = 30;

interface ColumnProps {
  state: TicketState;
  cards: TicketCardDto[];
  epicTitles: Map<string, string>;
  onOpen: (id: number) => void;
  onNew: (state: TicketState) => void;
  focusedId?: number | null;
  onFocusCard?: (id: number) => void;
  footer?: ReactNode;
  filtered?: boolean;
}

const DraggableCard = memo(function DraggableCard({
  card,
  epicTitle,
  onOpen,
  focused,
  onFocusCard,
}: {
  card: TicketCardDto;
  epicTitle?: string;
  onOpen: (id: number) => void;
  focused: boolean;
  onFocusCard?: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, data: { state: card.state } });
  return (
    <TicketCard
      ref={setNodeRef}
      card={card}
      epicTitle={epicTitle}
      dragging={isDragging}
      focused={focused}
      {...attributes}
      {...listeners}
      role="button"
      aria-roledescription="Draggable ticket"
      tabIndex={0}
      onClick={() => onOpen(card.id)}
      onFocus={() => onFocusCard?.(card.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.defaultPrevented) {
          e.preventDefault();
          onOpen(card.id);
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
    />
  );
});

function CardList({ cards, epicTitles, onOpen, focusedId, onFocusCard }: Pick<ColumnProps, 'cards' | 'epicTitles' | 'onOpen' | 'focusedId' | 'onFocusCard'>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = cards.length > VIRTUALIZE_AFTER;
  const virtualizer = useVirtualizer({
    count: virtual ? cards.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 104,
    overscan: 8,
    getItemKey: (i) => cards[i]!.id,
  });

  if (!virtual) {
    return (
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {cards.map((c) => (
          <motion.div key={c.id} layout="position" transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.6 }}>
            <DraggableCard card={c} epicTitle={c.epicId ? epicTitles.get(c.epicId) : undefined} onOpen={onOpen} focused={focusedId === c.id} onFocusCard={onFocusCard} />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" data-virtualized>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const c = cards[item.index]!;
          return (
            <div key={item.key} data-index={item.index} ref={virtualizer.measureElement} className="absolute left-0 top-0 w-full pb-2" style={{ transform: `translateY(${item.start}px)` }}>
              <DraggableCard card={c} epicTitle={c.epicId ? epicTitles.get(c.epicId) : undefined} onOpen={onOpen} focused={focusedId === c.id} onFocusCard={onFocusCard} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const Column = memo(function Column({ state, cards, epicTitles, onOpen, onNew, focusedId, onFocusCard, footer, filtered }: ColumnProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id: state });
  const fromHere = active?.data.current?.state === state;
  const headingId = `col-${state}`;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-state={state}
      className={cn(
        'flex h-full min-w-[248px] max-w-[380px] flex-1 basis-0 snap-start flex-col rounded-lg border bg-sunken/70 transition-colors',
        isOver && !fromHere ? 'border-accent bg-accent-soft/60' : 'border-transparent',
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', STATE_COLOR[state])} />
        <h2 id={headingId} className="text-[13px] font-semibold text-ink">
          {STATE_LABELS[state]}
        </h2>
        <span className="text-xs tabular-nums text-muted" aria-label={`${cards.length} tickets`}>
          {cards.length}
        </span>
        <button
          type="button"
          onClick={() => onNew(state)}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-ink/5 hover:text-ink"
          aria-label={`New ticket in ${STATE_LABELS[state]}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </header>
      {cards.length === 0 ? (
        <div className={cn('mx-2 mb-2 flex flex-1 items-start justify-center rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted', isOver ? 'border-accent' : 'border-line-strong/70')}>
          {filtered ? 'No matching tickets' : 'Drop tickets here'}
        </div>
      ) : (
        <CardList cards={cards} epicTitles={epicTitles} onOpen={onOpen} focusedId={focusedId} onFocusCard={onFocusCard} />
      )}
      {footer && <div className="px-2 pb-2">{footer}</div>}
    </section>
  );
});
