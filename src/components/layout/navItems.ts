import { HelpCircle, MessageCircle, MessageSquare, Radio, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { MessageKey } from '../../i18n';

export type ActiveTab = 'forum' | 'rooms' | 'presence' | 'dms' | 'how';

export type NavItem = {
  id: ActiveTab;
  labelKey: Extract<MessageKey, 'navForum' | 'navRooms' | 'navPresence' | 'navDms' | 'navHelp'>;
  Icon: ComponentType<{ className?: string }>;
};

const FORUM: NavItem = { id: 'forum', labelKey: 'navForum', Icon: MessageSquare };
const ROOMS: NavItem = { id: 'rooms', labelKey: 'navRooms', Icon: Radio };
const PRESENCE: NavItem = { id: 'presence', labelKey: 'navPresence', Icon: Users };
const DMS: NavItem = { id: 'dms', labelKey: 'navDms', Icon: MessageCircle };
const HOW: NavItem = { id: 'how', labelKey: 'navHelp', Icon: HelpCircle };

/** Same order on desktop and mobile: Zones → Chat → Who → Directs → Help. */
export const DESKTOP_NAV_ITEMS: NavItem[] = [ROOMS, FORUM, PRESENCE, DMS, HOW];
export const MOBILE_NAV_ITEMS: NavItem[] = [ROOMS, FORUM, PRESENCE, DMS, HOW];
