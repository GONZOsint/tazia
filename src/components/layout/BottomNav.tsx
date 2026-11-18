import { useT } from '../../i18n';
import { MOBILE_NAV_ITEMS, type ActiveTab } from './navItems';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
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
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelectTab(id)}
                className={`flex w-full min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium ${
                  active ? 'text-ink' : 'text-muted'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? 'text-accent' : 'text-faint'}`}
                  aria-hidden="true"
                />
                <span>{t(labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
