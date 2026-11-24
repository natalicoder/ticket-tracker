import { useDraggable, useDroppable } from '@dnd-kit/core';
import { STATE_LABELS, type TicketCardDto, type TicketState } from '@ticketing/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { memo, useRef, type ReactNode } from 'react';
import { STATE_COLOR, STATE_TINT } from '../../components/ui/Badge';
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
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-2.5">
        {cards.map((c) => (
          <motion.div key={c.id} layout="position" transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.6 }}>
            <DraggableCard card={c} epicTitle={c.epicId ? epicTitles.get(c.epicId) : undefined} onOpen={onOpen} focused={focusedId === c.id} onFocusCard={onFocusCard} />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5" data-virtualized>
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
        'flex h-full min-w-[232px] max-w-[380px] flex-1 basis-0 snap-start flex-col rounded-xl border-2 transition-colors',
        STATE_TINT[state],
        isOver && !fromHere ? 'border-ink/40' : 'border-transparent',
      )}
    >
      <header className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
        <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', STATE_COLOR[state])} />
        <h2 id={headingId} className="text-sm font-bold text-ink">
          {STATE_LABELS[state]}
        </h2>
        <span className="rounded-full bg-surface/70 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-2" aria-label={`${cards.length} tickets`}>
          {cards.length}
        </span>
        <button
          type="button"
          onClick={() => onNew(state)}
          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/70 text-ink-2 hover:bg-surface hover:text-ink"
          aria-label={`New ticket in ${STATE_LABELS[state]}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </header>
      {cards.length === 0 ? (
        <div className={cn('mx-2.5 mb-2.5 flex flex-1 items-start justify-center rounded-lg border-2 border-dashed px-3 py-6 text-center text-xs font-medium text-ink-2', isOver ? 'border-ink/40' : 'border-ink/15')}>
          {filtered ? 'No matching tickets' : 'Drop tickets here'}
        </div>
      ) : (
        <CardList cards={cards} epicTitles={epicTitles} onOpen={onOpen} focusedId={focusedId} onFocusCard={onFocusCard} />
      )}
      {footer && <div className="px-2.5 pb-2.5">{footer}</div>}
    </section>
  );
});
