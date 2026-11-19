import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { DUR, EASE, TAP, TAP_TRANSITION } from '../../motion/tokens';
import { MOBILE_NAV_ITEMS, type ActiveTab } from './navItems';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  forumUnread?: number;
  dmUnread?: number;
  /** Open zone count — reserved for callers; multi-zone signal lives on TopBar chip. */
  roomsCount?: number;
}

export function BottomNav({
  activeTab,
  onSelectTab,
  forumUnread = 0,
  dmUnread = 0,
}: BottomNavProps) {
  const t = useT();

  return (
    <nav
      aria-label={t('navAria')}
      className="chrome-elev fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-raised/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-[1280px] items-stretch justify-around px-1">
        {MOBILE_NAV_ITEMS.map(({ id, labelKey, Icon }) => {
          const active = activeTab === id;
          const badge = id === 'forum' ? forumUnread : id === 'dms' ? dmUnread : 0;
          return (
            <li key={id} className="flex-1">
              <motion.button
                whileTap={TAP}
                transition={TAP_TRANSITION}
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={
                  badge > 0
                    ? `${t(labelKey)} — ${t('navUnreadAria', { n: badge })}`
                    : t(labelKey)
                }
                onClick={() => onSelectTab(id)}
                className={`relative flex w-full min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  active ? 'text-ink' : 'text-muted'
                }`}
              >
                <span className="relative inline-flex h-7 w-7 items-center justify-center">
                  <Icon
                    className={`h-5 w-5 ${active ? 'text-ink' : 'text-faint'}`}
                    aria-hidden="true"
                    strokeWidth={1.75}
                  />
                  <AnimateBadge count={badge} />
                </span>
                <span className="max-w-full truncate px-0.5 leading-tight">{t(labelKey)}</span>
                {active && (
                  <motion.span
                    layoutId="bottomnav-active-dot"
                    className="absolute bottom-0.5 h-0.5 w-4 rounded-full bg-accent"
                    transition={{ duration: DUR.tab, ease: EASE.outExpo }}
                  />
                )}
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AnimateBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key="badge"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: DUR.micro }}
          className="absolute -right-1 -top-0.5 z-[2] flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-on-accent"
        >
          {count > 9 ? '9+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
