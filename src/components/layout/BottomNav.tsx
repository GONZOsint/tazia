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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-raised/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-[1280px] items-stretch justify-around px-1">
        {MOBILE_NAV_ITEMS.map(({ id, labelKey, Icon }) => {
          const active = activeTab === id;
          const badge =
            id === 'forum' ? forumUnread : id === 'dms' ? dmUnread : 0;
          return (
            <li key={id} className="flex-1">
              <button
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
                  <Icon
                    className={`h-5 w-5 ${active ? 'text-accent' : 'text-faint'}`}
                    aria-hidden="true"
                  />
                  {badge > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-on-accent">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span>{t(labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
