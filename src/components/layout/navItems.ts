import { HelpCircle, MessageCircle, MessagesSquare, Radio, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { MessageKey } from '../../i18n';

export type ActiveTab = 'forum' | 'rooms' | 'presence' | 'dms' | 'how';

export type NavItem = {
  readonly id: ActiveTab;
  readonly labelKey: Extract<
    MessageKey,
    'navForum' | 'navRooms' | 'navPresence' | 'navDms' | 'navHelp'
  >;
  readonly Icon: ComponentType<{
    className?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
    strokeWidth?: number;
  }>;
};

/** Zones → Plaza → Tribe → Whispers → Help. */
const NAV_ITEMS: readonly NavItem[] = [
  { id: 'rooms', labelKey: 'navRooms', Icon: Radio },
  { id: 'forum', labelKey: 'navForum', Icon: MessagesSquare },
  { id: 'presence', labelKey: 'navPresence', Icon: Users },
  { id: 'dms', labelKey: 'navDms', Icon: MessageCircle },
  { id: 'how', labelKey: 'navHelp', Icon: HelpCircle },
];

export const DESKTOP_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS;
export const MOBILE_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS;