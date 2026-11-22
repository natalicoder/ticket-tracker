import { CopyCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useSimilar } from '../../api/queries';
import { StateDot } from '../../components/ui/Badge';

/** "Possibly duplicates" hint under the title while creating a ticket (pg_trgm similarity on the server). */
export function SimilarTickets({ teamId, title, excludeId }: { teamId: string; title: string; excludeId?: number }) {
  const similar = useSimilar(teamId, title, excludeId);
  const location = useLocation();
  const hits = (title.trim().length >= 3 ? similar.data : undefined)?.slice(0, 3) ?? [];
  if (hits.length === 0) return null;
  return (
    <div className="mt-2 rounded-md border border-warn/30 bg-warn-soft/60 px-3 py-2" role="status" aria-live="polite">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <CopyCheck className="h-3.5 w-3.5 text-warn" aria-hidden /> Possibly duplicates:
      </p>
      <ul className="mt-1.5 space-y-1">
        {hits.map((h) => (
          <li key={h.id} className="flex items-center gap-2 text-sm">
            <StateDot state={h.state} />
            <Link to={`/tickets/${h.id}`} state={location.state} className="min-w-0 truncate text-ink hover:text-accent hover:underline">
              <span className="text-muted">#{h.id}</span> {h.title}
            </Link>
            <span className="ml-auto shrink-0 rounded-sm bg-surface px-1.5 text-2xs font-semibold tabular-nums text-ink-2">{Math.round(h.score * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
