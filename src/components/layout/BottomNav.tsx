import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { DUR, EASE, NAV_INDICATOR, NAV_TAP, TAP_TRANSITION, badgeMelt } from '../../motion/tokens';
import { MOBILE_NAV_ITEMS, type ActiveTab } from './navItems';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  forumUnread?: number;
  dmUnread?: number;
  /** Open zone count — reserved for callers; multi-zone signal lives on TopBar chip. */
  roomsCount?: number;
}

/**
 * Mobile destination bar (M3 navigation bar / iOS tab bar).
 * Active state = pill indicator behind icon (layoutId spring) + weight/color.
 */
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
      className="bottom-nav chrome-elev fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="bottom-nav__list mx-auto flex max-w-[1280px] items-stretch justify-around px-1.5">
        {MOBILE_NAV_ITEMS.map(({ id, labelKey, Icon }) => {
          const active = activeTab === id;
          const badge = id === 'forum' ? forumUnread : id === 'dms' ? dmUnread : 0;
          return (
            <li key={id} className="min-w-0 flex-1">
              <motion.button
                whileTap={NAV_TAP}
                transition={TAP_TRANSITION}
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={
                  badge > 0
                    ? `${t(labelKey)} — ${t('navUnreadAria', { n: badge })}`
                    : undefined
                }
                onClick={() => onSelectTab(id)}
                className={`bottom-nav__item type-label relative flex w-full cursor-pointer select-none touch-manipulation flex-col items-center justify-center gap-0.5 px-0.5 transition-colors duration-[var(--dur-micro)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <span className="bottom-nav__icon-slot relative inline-flex items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="bottomnav-active-pill"
                      className="bottom-nav__indicator"
                      transition={NAV_INDICATOR}
                      aria-hidden="true"
                    />
                  )}
                  <motion.span
                    initial={false}
                    className="relative z-[1] inline-flex"
                    animate={{ scale: active ? 1 : 0.96 }}
                    transition={{ duration: DUR.micro, ease: EASE.outExpo }}
                  >
                    <Icon
                      className={`h-5 w-5 transition-colors duration-[var(--dur-micro)] ${
                        active ? 'text-ink' : 'text-faint'
                      }`}
                      aria-hidden="true"
                      strokeWidth={active ? 2.25 : 1.75}
                    />
                  </motion.span>
                  <AnimateBadge count={badge} />
                </span>
                <span
                  className={`bottom-nav__label max-w-full truncate px-0.5 leading-tight ${
                    active ? 'font-semibold text-ink' : 'font-medium text-muted'
                  }`}
                >
                  {t(labelKey)}
                </span>
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
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key="badge"
          aria-hidden="true"
          initial={badgeMelt.initial}
          animate={badgeMelt.animate}
          exit={badgeMelt.exit}
          transition={badgeMelt.transition}
          className="type-badge bottom-nav__badge pointer-events-none absolute z-[2] flex h-4 min-w-4 select-none items-center justify-center rounded-full bg-accent px-1 text-on-accent"
        >
          {count > 9 ? '9+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}