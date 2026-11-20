import { Flame } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { KeyChangeAlert } from '../../components/session/KeyChangeAlert';
import { IpConsentModal } from '../../features/rooms/IpConsentModal';
import type { RoomState } from '../../hooks/useRoomManager';
import type { TrustLevel } from '../../core/trust/trustStore';
import { bannerEnter } from '../../motion/tokens';
import { useT } from '../../i18n';

type AppOverlaysProps = {
  burnNotice: boolean;
  ipConsentNeeded: boolean;
  onAcceptIpConsent: () => void;
  onCancelIpConsent: () => void;
  burnConfirmOpen: boolean;
  onCancelBurnConfirm: () => void;
  onConfirmBurn: () => void;
  activeRoom: RoomState | null;
  activeRoomId: string | null;
  keyChangeAlerts: Array<{ userId: string; level: TrustLevel }>;
  presence: RoomState['presence'];
  dismissKeyChange: (roomId: string, userId: string) => void;
  leaveRoom: (roomId: string) => Promise<void>;
};

export function AppOverlays({
  burnNotice,
  ipConsentNeeded,
  onAcceptIpConsent,
  onCancelIpConsent,
  burnConfirmOpen,
  onCancelBurnConfirm,
  onConfirmBurn,
  activeRoom,
  activeRoomId,
  keyChangeAlerts,
  presence,
  dismissKeyChange,
  leaveRoom,
}: AppOverlaysProps) {
  const t = useT();
  const trustStore = activeRoom?.trustStore ?? null;

  return (
    <>
      <AnimatePresence initial={false}>
        {burnNotice && (
          <motion.div
            initial={bannerEnter.initial}
            animate={bannerEnter.animate}
            exit={bannerEnter.exit}
            transition={bannerEnter.transition}
            className="mx-auto mt-4 flex max-w-[1280px] items-center px-4 sm:px-8"
          >
            <AlertBanner tone="success" role="status" className="w-full">
              {t('burnNotice')}
            </AlertBanner>
          </motion.div>
        )}
      </AnimatePresence>

      <IpConsentModal
        open={ipConsentNeeded}
        onAccept={onAcceptIpConsent}
        onCancel={onCancelIpConsent}
      />

      <ConfirmModal
        open={burnConfirmOpen}
        title={t('burnConfirmTitle')}
        body={t('burnConfirmBody')}
        confirmLabel={t('burnConfirmAction')}
        danger
        icon={Flame}
        onCancel={onCancelBurnConfirm}
        onConfirm={onConfirmBurn}
      />

      {keyChangeAlerts.length > 0 && activeRoomId && (
        <div className="mx-auto mt-4 max-w-[1280px] space-y-2 px-4 sm:px-8">
          {keyChangeAlerts.map((alert) => (
            <KeyChangeAlert
              key={alert.userId}
              peerAlias={presence[alert.userId]?.alias || alert.userId}
              onRepin={() => {
                trustStore?.repin(alert.userId);
                void activeRoom?.session.invalidatePeerKey(alert.userId);
                dismissKeyChange(activeRoomId, alert.userId);
              }}
              onDisconnect={() => {
                dismissKeyChange(activeRoomId, alert.userId);
                void leaveRoom(activeRoomId);
              }}
              onDismiss={() => dismissKeyChange(activeRoomId, alert.userId)}
            />
          ))}
        </div>
      )}
    </>
  );
}
