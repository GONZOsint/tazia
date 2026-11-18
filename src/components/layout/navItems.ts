import { DoorOpen, HelpCircle, MessageSquare, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { MessageKey } from '../../i18n';

export type ActiveTab = 'forum' | 'rooms' | 'presence' | 'how';

export type NavItem = {
  id: ActiveTab;
  labelKey: Extract<MessageKey, 'navForum' | 'navRooms' | 'navPresence' | 'navHelp'>;
  Icon: ComponentType<{ className?: string }>;
};

const FORUM: NavItem = { id: 'forum', labelKey: 'navForum', Icon: MessageSquare };
const ROOMS: NavItem = { id: 'rooms', labelKey: 'navRooms', Icon: DoorOpen };
const PRESENCE: NavItem = { id: 'presence', labelKey: 'navPresence', Icon: Users };
const HOW: NavItem = { id: 'how', labelKey: 'navHelp', Icon: HelpCircle };

/** Desktop order: chat first. */
export const DESKTOP_NAV_ITEMS: NavItem[] = [FORUM, ROOMS, PRESENCE, HOW];

/** Mobile order: rooms first for entry. */
export const MOBILE_NAV_ITEMS: NavItem[] = [ROOMS, FORUM, PRESENCE, HOW];
