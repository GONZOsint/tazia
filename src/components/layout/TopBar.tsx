import { Eraser } from 'lucide-react';
import { motion } from 'motion/react';
import { useT } from '../../i18n';
import { TaziaLogo } from '../brand/TaziaLogo';
import { LangToggle } from '../ui/LangToggle';
import { ThemeToggle } from '../ui/ThemeToggle';
import { DESKTOP_NAV_ITEMS, type ActiveTab } from './navItems';

export type { ActiveTab } from './navItems';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  hasActiveRoom: boolean;
  onBurnSession: () => void;
  forumUnread?: number;
  dmUnread?: number;
}

export function TopBar({
  activeTab,
  onSelectTab,
  hasActiveRoom,
  onBurnSession,
  forumUnread = 0,
  dmUnread = 0,
}: TopBarProps) {
  const t = useT();

  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-surface-raised/95 backdrop-blur-sm"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:h-16 sm:gap-6 sm:px-8">
        <button
          type="button"
          onClick={() => onSelectTab(hasActiveRoom ? 'forum' : 'rooms')}
          className="flex shrink-0 items-center gap-2 rounded-md py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <TaziaLogo size={44} />
          <span className="min-w-0">
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              {t('brand')}
            </span>
            <span className="mt-0.5 hidden text-[10px] font-medium text-muted sm:block">
              {t('tagline')}
            </span>
          </span>
        </button>

        <nav
          aria-label={t('navAria')}
          className="no-scrollbar hidden h-full min-w-0 items-stretch gap-5 overflow-x-auto text-sm font-medium md:flex sm:gap-7"
        >
          {DESKTOP_NAV_ITEMS.map(({ id, labelKey, Icon }) => {
            const isActive = activeTab === id;
            const badge =
              id === 'forum' ? forumUnread : id === 'dms' ? dmUnread : 0;
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  badge > 0
                    ? `${t(labelKey)} — ${t('navUnreadAria', { n: badge })}`
                    : undefined
                }
                onClick={() => onSelectTab(id)}
                className={`relative inline-flex h-full items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  isActive ? 'font-semibold text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-ink' : 'text-faint'}`}
                  aria-hidden="true"
                />
                <span>{t(labelKey)}</span>
                {badge > 0 && (
                  <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-on-accent">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="topbar-active-underline"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-accent"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <LangToggle />
          {hasActiveRoom ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onBurnSession}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs font-semibold text-danger-ink whitespace-nowrap"
            >
              <Eraser className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t('leaveTab')}</span>
            </motion.button>
          ) : (
            <span className="hidden lg:inline text-xs text-faint">{t('liveHint')}</span>
          )}
        </div>
      </div>
    </header>
  );
}
