import * as DM from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, Keyboard, LogOut, Monitor, Moon, PartyPopper, Search, Sun } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLogout, useMe, useTeams } from '../api/queries';
import { cn } from '../lib/cn';
import { sendCommand } from '../lib/events';
import { useCelebrate, useTheme, type ThemePref } from '../lib/prefs';
import { useCurrentTeamId } from '../lib/useCurrentTeam';
import { Kbd, modKey } from './ui/misc';

function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2 rounded-md pr-1 font-semibold tracking-tight text-ink" aria-label="Ticketing home">
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-ink" />
        <rect x="6" y="9" width="4" height="14" rx="1.5" className="fill-st-new" />
        <rect x="12" y="9" width="4" height="10" rx="1.5" className="fill-st-ready" />
        <rect x="18" y="9" width="4" height="7" rx="1.5" className="fill-st-progress" />
        <rect x="24" y="9" width="2.5" height="4" rx="1.25" className="fill-st-done" />
      </svg>
      <span className="hidden sm:inline">Ticketing</span>
    </NavLink>
  );
}

export function TeamSelector() {
  const teams = useTeams();
  const current = useCurrentTeamId();
  const navigate = useNavigate();
  const list = teams.data ?? [];
  if (list.length === 0) return null;
  return (
    <div className="relative">
      <label htmlFor="team-selector" className="sr-only">
        Team
      </label>
      <select
        id="team-selector"
        value={current ?? ''}
        onChange={(e) => navigate(`/board/${e.target.value}`)}
        className="h-8 max-w-[11rem] appearance-none truncate rounded-md border border-transparent bg-transparent pl-2 pr-7 text-sm font-semibold text-ink hover:border-line hover:bg-surface focus:border-accent focus:outline-none sm:max-w-[16rem]"
      >
        {list.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn('rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors', isActive ? 'bg-ink/[0.07] text-ink' : 'text-muted hover:text-ink')
      }
    >
      {children}
    </NavLink>
  );
}

const THEMES: Array<{ value: ThemePref; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next = THEMES[(THEMES.findIndex((t) => t.value === theme) + 1) % THEMES.length]!;
  const Current = THEMES.find((t) => t.value === theme)!.icon;
  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-ink/5 hover:text-ink"
      aria-label={`Theme: ${theme}. Switch to ${next.label.toLowerCase()}`}
      title={`Theme: ${theme}`}
    >
      <Current className="h-4 w-4" />
    </button>
  );
}

const menuItem = 'flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-ink/[0.06]';

export function UserMenu() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [celebrate, setCelebrate] = useCelebrate();
  const email = me.data?.email ?? '';
  const initials = email.slice(0, 2).toUpperCase();

  const doLogout = async () => {
    try {
      await logout.mutateAsync();
    } finally {
      navigate('/login', { replace: true });
      toast.success('Logged out');
    }
  };

  return (
    <DM.Root>
      <DM.Trigger className="flex h-8 items-center gap-1.5 rounded-md pl-1 pr-1.5 hover:bg-ink/5" aria-label={`Account menu for ${email}`}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-2xs font-semibold text-accent">{initials}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 text-muted" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="z-50 min-w-[14rem] rounded-md bg-surface p-1 shadow-pop animate-pop-in">
          <div className="px-2 pb-2 pt-1.5">
            <div className="text-xs text-muted">Signed in as</div>
            <div className="truncate text-sm font-medium">{email}</div>
          </div>
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Item className={menuItem} onSelect={() => sendCommand('shortcuts')}>
            <Keyboard className="h-4 w-4 text-muted" /> Keyboard shortcuts <Kbd className="ml-auto">?</Kbd>
          </DM.Item>
          <DM.CheckboxItem className={menuItem} checked={celebrate} onCheckedChange={(v) => setCelebrate(!!v)} onSelect={(e) => e.preventDefault()}>
            <PartyPopper className="h-4 w-4 text-muted" /> Celebrate on Done
            <DM.ItemIndicator className="ml-auto">
              <Check className="h-4 w-4 text-accent" />
            </DM.ItemIndicator>
          </DM.CheckboxItem>
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Item className={menuItem} onSelect={() => void doLogout()}>
            <LogOut className="h-4 w-4 text-muted" /> Log out
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function AppShell() {
  const current = useCurrentTeamId();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
        <div className="flex h-12 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Logo />
          <span aria-hidden className="h-5 w-px bg-line" />
          <TeamSelector />
          <nav aria-label="Main" className="ml-1 flex items-center gap-0.5">
            <NavItem to={current ? `/board/${current}` : '/'}>Board</NavItem>
            <NavItem to="/epics">Epics</NavItem>
            <NavItem to="/teams">Teams</NavItem>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => sendCommand('palette')}
              className="hidden h-8 items-center gap-2 rounded-md border border-line bg-surface pl-2.5 pr-1.5 text-sm text-muted shadow-card hover:border-line-strong hover:text-ink md:flex"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span className="pr-6">Search or jump to…</span>
              <Kbd>{modKey}</Kbd>
              <Kbd>K</Kbd>
            </button>
            <button type="button" onClick={() => sendCommand('palette')} className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-ink/5 hover:text-ink md:hidden" aria-label="Search">
              <Search className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
