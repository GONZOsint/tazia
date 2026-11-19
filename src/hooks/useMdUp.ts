import { useEffect, useState } from 'react';

/** Tailwind `md` breakpoint — side-by-side room entry layouts. */
const MD_UP = '(min-width: 768px)';

export function useMdUp(): boolean {
  const [mdUp, setMdUp] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MD_UP).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(MD_UP);
    const sync = () => setMdUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mdUp;
}
