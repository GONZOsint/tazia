import { motion } from 'motion/react';
import { useT } from '../../i18n';
import { MOBILE_NAV_ITEMS, type ActiveTab } from './navItems';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  forumUnread?: number;
  dmUnread?: number;
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-raised/95 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] backdrop-blur-sm md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-[1280px] items-stretch justify-around px-1">
        {MOBILE_NAV_ITEMS.map(({ id, labelKey, Icon }) => {
          const active = activeTab === id;
          const badge =
            id === 'forum' ? forumUnread : id === 'dms' ? dmUnread : 0;
          return (
            <li key={id} className="flex-1">
              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12 }}
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={
                  badge > 0
                    ? `${t(labelKey)} — ${t('navUnreadAria', { n: badge })}`
                    : undefined
                }
                onClick={() => onSelectTab(id)}
                className={`relative flex w-full min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  active ? 'text-ink' : 'text-muted'
                }`}
              >
                <span className="relative">
                  <motion.span
                    animate={{ scale: active ? 1.08 : 1 }}
                    transition={{ duration: 0.12 }}
                    className="inline-flex"
                  >
                    <Icon
                      className={`h-5 w-5 ${active ? 'text-accent' : 'text-faint'}`}
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                  </motion.span>
                  <AnimateBadge count={badge} />
                </span>
                <span>{t(labelKey)}</span>
                {active && (
                  <motion.span
                    layoutId="bottomnav-active-dot"
                    className="absolute bottom-1 h-0.5 w-4 rounded-full bg-accent"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
  if (count <= 0) return null;
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-on-accent"
    >
      {count > 9 ? '9+' : count}
    </motion.span>
  );
}
