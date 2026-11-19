import { lazy, Suspense } from 'react';
import { TabSkeleton } from '../TabSkeleton';

const HowItWorksView = lazy(() => import('../../../features/how/HowItWorksView'));

export function HowTabPanel(props: { active: boolean }) {
  return (
    <div
      className="tab-panel"
      data-active={props.active ? 'true' : 'false'}
      aria-hidden={!props.active}
      inert={!props.active ? true : undefined}
    >
      <Suspense fallback={<TabSkeleton />}>
        <HowItWorksView />
      </Suspense>
    </div>
  );
}
