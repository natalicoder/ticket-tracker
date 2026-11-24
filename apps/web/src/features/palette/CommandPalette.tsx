import { parseQuickAdd } from '@ticketing/shared';
import { Command } from 'cmdk';
import { FileText, Keyboard, Layers, LayoutGrid, LogOut, Palette, Plus, Users, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBoard, useEpics, useLogout, useTeams } from '../../api/queries';
import { StateDot } from '../../components/ui/Badge';
import { Kbd } from '../../components/ui/misc';
import { useTheme } from '../../lib/prefs';
import { useCurrentTeamId } from '../../lib/useCurrentTeam';
import { quickAddUrl } from '../ticket/QuickAdd';

function Item({ onSelect, icon, children, shortcut, value, forceMount }: { onSelect: () => void; icon: ReactNode; children: ReactNode; shortcut?: string; value?: string; forceMount?: boolean }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      forceMount={forceMount}
      className="flex cursor-default items-center gap-2.5 rounded-full px-3.5 py-2 text-sm text-ink aria-selected:bg-accent-soft aria-selected:text-ink"
    >
      <span className="text-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </Command.Item>
  );
}

const group = 'px-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted';

export function CommandPalette({ open, onOpenChange, onNewTicket, onShortcuts }: { open: boolean; onOpenChange: (o: boolean) => void; onNewTicket: () => void; onShortcuts: () => void }) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const teams = useTeams();
  const teamId = useCurrentTeamId();
  const board = useBoard(teamId);
  const epics = useEpics(teamId);
  const logout = useLogout();
  const [theme, setTheme] = useTheme();

  const run = (fn: () => void) => {
    onOpenChange(false);
    setSearch('');
    fn();
  };
  const quick = search.trim() && teamId ? parseQuickAdd(search, epics.data ?? []) : null;
  const background = location.pathname.startsWith('/board/') ? location : { pathname: teamId ? `/board/${teamId}` : '/', search: '', hash: '', state: null, key: 'palette' };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setSearch('');
      }}
      label="Command palette"
      loop
      overlayClassName="fixed inset-0 z-40 bg-ink/25 animate-fade-in dark:bg-black/60"
      contentClassName="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg bg-surface shadow-pop animate-pop-in"
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="Search tickets, jump to a team, or type a command…"
        className="h-12 w-full border-b border-line bg-transparent px-4 text-[15px] placeholder:text-muted focus:outline-none"
      />
      <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5">
        <Command.Empty className="px-4 py-6 text-center text-sm text-muted">Nothing matches “{search}”.</Command.Empty>


        <Command.Group heading="Actions" className={group}>
          <Item icon={<Plus className="h-4 w-4" />} shortcut="C" onSelect={() => run(onNewTicket)}>
            New ticket
          </Item>
          <Item icon={<Palette className="h-4 w-4" />} onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>
            Switch to {theme === 'dark' ? 'light' : 'dark'} theme
          </Item>
          <Item icon={<Keyboard className="h-4 w-4" />} shortcut="?" onSelect={() => run(onShortcuts)}>
            Keyboard shortcuts
          </Item>
          <Item
            icon={<LogOut className="h-4 w-4" />}
            onSelect={() =>
              run(() => {
                void logout.mutateAsync().finally(() => navigate('/login', { replace: true }));
              })
            }
          >
            Log out
          </Item>
        </Command.Group>

        <Command.Group heading="Go to" className={group}>
          <Item icon={<LayoutGrid className="h-4 w-4" />} onSelect={() => run(() => navigate(teamId ? `/board/${teamId}` : '/'))}>
            Board
          </Item>
          <Item icon={<Layers className="h-4 w-4" />} onSelect={() => run(() => navigate('/epics'))}>
            Epics
          </Item>
          <Item icon={<Users className="h-4 w-4" />} onSelect={() => run(() => navigate('/teams'))}>
            Teams
          </Item>
        </Command.Group>

        {(teams.data?.length ?? 0) > 1 && (
          <Command.Group heading="Switch team" className={group}>
            {teams.data!.map((t) => (
              <Item key={t.id} value={`team ${t.name} ${t.id}`} icon={<Users className="h-4 w-4" />} onSelect={() => run(() => navigate(`/board/${t.id}`))}>
                {t.name}
              </Item>
            ))}
          </Command.Group>
        )}

        {(board.data?.length ?? 0) > 0 && (
          <Command.Group heading="Tickets on this board" className={group}>
            {board.data!.map((c) => (
              <Item
                key={c.id}
                value={`#${c.id} ${c.title}`}
                icon={<FileText className="h-4 w-4" />}
                onSelect={() => run(() => navigate(`/tickets/${c.id}`, { state: { background } }))}
              >
                <span className="inline-flex items-center gap-2">
                  <StateDot state={c.state} />
                  <span className="tabular-nums text-muted">#{c.id}</span> {c.title}
                </span>
              </Item>
            ))}
          </Command.Group>
        )}
        {quick?.title && (
          <Command.Group heading="Quick add" className={group} forceMount>
            <Item
              forceMount
              value="~quick-add"
              icon={<Zap className="h-4 w-4" />}
              onSelect={() => run(() => navigate(quickAddUrl(teamId!, 'new', search, epics.data ?? [])!, { state: { background } }))}
            >
              Create “{quick.title}”{quick.type ? ` as ${quick.type}` : ''}
            </Item>
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
