import type { ActiveTab } from '../../components/layout/TopBar';

export const ALL_TABS = [
  'rooms',
  'forum',
  'presence',
  'dms',
  'how',
] as const satisfies readonly ActiveTab[];
