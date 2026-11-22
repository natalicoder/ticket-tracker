import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onCommand, sendCommand } from '../../lib/events';
import { useCurrentTeamId } from '../../lib/useCurrentTeam';
import { CommandPalette } from './CommandPalette';
import { HotkeysHelp } from './HotkeysHelp';
import { useHotkeys } from './useHotkeys';

/** Global keyboard layer for signed-in pages: palette, shortcuts help and navigation hotkeys. */
export function AppOverlays() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const teamId = useCurrentTeamId();

  const newTicket = useCallback(() => {
    if (!teamId) return navigate('/');
    const background = location.pathname.startsWith('/board/') ? location : { pathname: `/board/${teamId}`, search: '' };
    navigate(`/tickets/new?teamId=${teamId}`, { state: { background } });
  }, [navigate, location, teamId]);

  useEffect(
    () =>
      onCommand((c) => {
        if (c === 'palette') setPaletteOpen(true);
        if (c === 'shortcuts') setHelpOpen(true);
      }),
    [],
  );

  useHotkeys({
    'mod+k': () => setPaletteOpen((o) => !o),
    c: newTicket,
    '/': () => {
      if (location.pathname.startsWith('/board/')) sendCommand('focus-search');
      else setPaletteOpen(true);
    },
    '?': () => setHelpOpen(true),
    'g b': () => navigate(teamId ? `/board/${teamId}` : '/'),
    'g e': () => navigate('/epics'),
    'g t': () => navigate('/teams'),
  });

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNewTicket={newTicket} onShortcuts={() => setHelpOpen(true)} />
      <HotkeysHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
