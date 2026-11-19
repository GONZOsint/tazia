import { useEffect, useRef } from 'react';
import type { SessionError } from '../../hooks/sessionErrors';
import type { useToast } from '../../components/ui/ToastHost';
import type { useT } from '../../i18n';

type ToastApi = ReturnType<typeof useToast>;
type TFn = ReturnType<typeof useT>;

export function useTransportToasts(opts: {
  activeRoomId: string | null;
  transportNotice: SessionError;
  dismissTransportNotice: () => void;
  toast: ToastApi;
  t: TFn;
}) {
  const { activeRoomId, transportNotice, dismissTransportNotice, toast, t } = opts;
  const relayToastShownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRoomId) {
      relayToastShownRef.current = null;
      return;
    }
    if (!transportNotice) return;
    const stamp = `${activeRoomId}:${transportNotice.key}`;
    if (relayToastShownRef.current === stamp) {
      dismissTransportNotice();
      return;
    }
    relayToastShownRef.current = stamp;
    toast.push({
      message: t(transportNotice.key, transportNotice.vars),
      tone: 'warning',
      dedupeKey: stamp,
    });
    dismissTransportNotice();
  }, [transportNotice, activeRoomId, dismissTransportNotice, t, toast]);
}
