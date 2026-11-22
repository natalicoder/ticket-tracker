import { useMatch } from 'react-router-dom';
import { useTeams } from '../api/queries';
import { lastTeam } from './prefs';

/** The team in the URL (/board/:teamId), else the last one visited, else the first team. */
export function useCurrentTeamId(): string | undefined {
  const match = useMatch('/board/:teamId');
  const teams = useTeams();
  const fromUrl = match?.params.teamId;
  if (fromUrl) return fromUrl;
  const list = teams.data ?? [];
  const remembered = lastTeam();
  if (remembered && list.some((t) => t.id === remembered)) return remembered;
  return list[0]?.id;
}
