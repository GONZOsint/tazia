import { useEffect, useId, useState } from 'react';
import { Flame } from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { KeyChangeAlert } from '../../components/session/KeyChangeAlert';
import { EmojiVerifyModal } from '../../components/session/EmojiVerifyModal';
import { IpConsentModal } from '../../features/rooms/IpConsentModal';
import {
  clearTurnConfig,
  hasPersistedTurnConfig,
} from '../../features/rooms/TurnRelaySettings';
import {
  clearNostrRelayConfig,
  hasPersistedNostrRelayConfig,
} from '../../features/rooms/nostrRelayConfig';
import { clearIpConsent, hasIpConsent } from '../../core/utils/ipConsent';
import type { RoomState } from '../../hooks/useRoomManager';
import type { TrustLevel } from '../../core/trust/trustStore';
import { applyTrustSasConfirm } from '../../core/trust/trustResolve';
import {
  peerVerifyKeysMatch,
  pickPeerVerifyKeys,
} from '../../core/trust/pickPeerVerifyKeys';
import { useT } from '../../i18n';

type AppOverlaysProps = {
  ipConsentNeeded: boolean;
  onAcceptIpConsent: () => void;
  onCancelIpConsent: () => void;
  /** Ensure Zones tab is active so Fix can mount. */
  onOpenFix: () => void;
  burnConfirmOpen: boolean;
  onCancelBurnConfirm: () => void;
  onConfirmBurn: () => void;
  activeRoom: RoomState | null;
  activeRoomId: string | null;
  keyChangeAlerts: Array<{ userId: string; level: TrustLevel }>;
  presence: RoomState['presence'];
  dismissKeyChange: (roomId: string, userId: string) => void;
};

type VerifyPeer = {
  userId: string;
  alias: string;
  keyB64: string;
  encB64: string;
};

export function AppOverlays({
  ipConsentNeeded,
  onAcceptIpConsent,
  onCancelIpConsent,
  onOpenFix,
  burnConfirmOpen,
  onCancelBurnConfirm,
  onConfirmBurn,
  activeRoom,
  activeRoomId,
  keyChangeAlerts,
  presence,
  dismissKeyChange,
}: AppOverlaysProps) {
  const t = useT();
  const trustStore = activeRoom?.trustStore ?? null;
  const forgetPrefsId = useId();
  const [showForgetPrefs, setShowForgetPrefs] = useState(false);
  const [forgetPrefs, setForgetPrefs] = useState(false);
  const [verifyPeer, setVerifyPeer] = useState<VerifyPeer | null>(null);
  /** Trust committed; finish invalidate/dismiss on modal close after celebration. */
  const [sasCommittedUserId, setSasCommittedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!burnConfirmOpen) {
      setForgetPrefs(false);
      setShowForgetPrefs(false);
      return;
    }
    setForgetPrefs(false);
    setShowForgetPrefs(
      hasPersistedTurnConfig() || hasPersistedNostrRelayConfig() || hasIpConsent()
    );
  }, [burnConfirmOpen]);

  useEffect(() => {
    if (!verifyPeer) return;
    // Keep modal open after successful commit until celebration calls onClose.
    if (sasCommittedUserId === verifyPeer.userId) return;
    if (!keyChangeAlerts.some((a) => a.userId === verifyPeer.userId)) {
      setVerifyPeer(null);
    }
  }, [keyChangeAlerts, verifyPeer, sasCommittedUserId]);

  // Keep SAS snapshot in sync with live keys (or close if keys disappear).
  useEffect(() => {
    if (!verifyPeer) return;
    const syncKeys = () => {
      const live = pickPeerVerifyKeys(trustStore, presence, verifyPeer.userId);
      if (!live) {
        setVerifyPeer(null);
        return;
      }
      if (!peerVerifyKeysMatch(verifyPeer, live)) {
        setVerifyPeer((prev) =>
          prev && prev.userId === verifyPeer.userId
            ? { ...prev, keyB64: live.keyB64, encB64: live.encB64 }
            : prev
        );
      }
    };
    syncKeys();
    if (!trustStore) return;
    return trustStore.onChange(syncKeys);
  }, [verifyPeer, trustStore, presence]);

  const handleConfirmBurn = () => {
    if (forgetPrefs) {
      clearTurnConfig({ emitCleared: false });
      clearNostrRelayConfig();
      clearIpConsent();
    }
    onConfirmBurn();
  };

  const handleOpenFixFromConsent = () => {
    onCancelIpConsent();
    onOpenFix();
  };

  /** Apply SAS commit; refresh snapshot on drift. Does not close the modal. */
  const resolveAfterSas = (snapshot: VerifyPeer): boolean => {
    if (!trustStore || !activeRoomId) return false;
    const live = pickPeerVerifyKeys(trustStore, presence, snapshot.userId);
    if (!peerVerifyKeysMatch(snapshot, live)) {
      if (live) {
        setVerifyPeer({ ...snapshot, keyB64: live.keyB64, encB64: live.encB64 });
      } else {
        setVerifyPeer(null);
      }
      return false;
    }
    const result = applyTrustSasConfirm(trustStore, snapshot.userId);
    if (result === 'noop') return false;
    // Defer invalidate/dismiss until onClose so the alert-drop effect cannot unmount mid-celebration.
    setSasCommittedUserId(snapshot.userId);
    return true;
  };

  const handleCloseVerify = () => {
    if (sasCommittedUserId && activeRoomId) {
      void activeRoom?.session.invalidatePeerKey(sasCommittedUserId);
      dismissKeyChange(activeRoomId, sasCommittedUserId);
      setSasCommittedUserId(null);
    }
    setVerifyPeer(null);
  };

  const selfUserId = activeRoom?.selfUserId ?? null;
  const selfSign = activeRoom?.selfSignPubKeyB64 ?? null;
  const selfEnc =
    (selfUserId &&
      (trustStore?.getPinnedEnc(selfUserId) ??
        presence[selfUserId]?.encPubKeyRawB64)) ||
    '';

  return (
    <>
      <IpConsentModal
        open={ipConsentNeeded}
        onAccept={onAcceptIpConsent}
        onCancel={onCancelIpConsent}
        onOpenFix={handleOpenFixFromConsent}
      />

      <ConfirmModal
        open={burnConfirmOpen}
        title={t('burnConfirmTitle')}
        body={t('burnConfirmBody')}
        confirmLabel={t('burnConfirmAction')}
        danger
        icon={Flame}
        onCancel={onCancelBurnConfirm}
        onConfirm={handleConfirmBurn}
        extra={
          showForgetPrefs ? (
            <label
              htmlFor={forgetPrefsId}
              className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-ctrl)] border border-border bg-surface px-3 py-2.5"
            >
              <input
                id={forgetPrefsId}
                type="checkbox"
                checked={forgetPrefs}
                onChange={(e) => setForgetPrefs(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="type-caption text-muted">{t('burnConfirmForgetTurn')}</span>
            </label>
          ) : null
        }
      />

      {keyChangeAlerts.length > 0 && activeRoomId && (
        <div className="mx-auto mt-4 max-w-[1280px] space-y-2 px-4 sm:px-8">
          {keyChangeAlerts.map((alert) => (
            <KeyChangeAlert
              key={alert.userId}
              peerAlias={presence[alert.userId]?.alias || alert.userId}
              onRepin={() => {
                const keys = pickPeerVerifyKeys(trustStore, presence, alert.userId);
                if (!keys) return;
                setVerifyPeer({
                  userId: alert.userId,
                  alias: presence[alert.userId]?.alias || alert.userId,
                  keyB64: keys.keyB64,
                  encB64: keys.encB64,
                });
              }}
              onDisconnect={() => {
                void activeRoom?.session.invalidatePeerKey(alert.userId);
                dismissKeyChange(activeRoomId, alert.userId);
              }}
              onDismiss={() => dismissKeyChange(activeRoomId, alert.userId)}
            />
          ))}
        </div>
      )}

      {verifyPeer && selfSign && activeRoomId && (
        <EmojiVerifyModal
          open={!!verifyPeer}
          peerAlias={verifyPeer.alias}
          selfKeyB64={selfSign}
          peerKeyB64={verifyPeer.keyB64}
          selfEncB64={selfEnc}
          peerEncB64={verifyPeer.encB64}
          roomId={activeRoomId}
          onVerify={() => resolveAfterSas(verifyPeer)}
          onClose={handleCloseVerify}
        />
      )}
    </>
  );
}
