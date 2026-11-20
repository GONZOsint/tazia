import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { RoomState } from '../../../hooks/useRoomManager';
import { haptic, HAPTIC_RITUAL } from '../../../motion/haptic';

type LeaveOpts = {
  joinedRooms: RoomState[];
  onLeaveRoom?: (roomId: string) => Promise<void>;
};

/**
 * Zone leave / ash pipeline.
 * Always set `leavingId` (even on full-motion ash) so the live room stays
 * filtered after `ashRoom` clears if network leave is still in flight.
 */
export function useZoneLeave({ joinedRooms, onLeaveRoom }: LeaveOpts) {
  const reduceMotion = useReducedMotion();
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  /** Optimistic leave — filtered from the list so exit + sibling layout overlap. */
  const [leavingId, setLeavingId] = useState<string | null>(null);
  /** Full-motion ash snapshot — keeps the card mounted while RegionAshOverlay burns. */
  const [ashRoom, setAshRoom] = useState<RoomState | null>(null);
  const ashIndexRef = useRef(0);
  /** Prevents double commit from rapid confirm taps. */
  const leaveCommitRef = useRef<string | null>(null);
  /** Gate: clear leavingId only after network leave + Motion exit both finish. */
  const leaveNetDoneRef = useRef<string | null>(null);
  const leaveExitDoneRef = useRef(false);
  const coldExitTimerRef = useRef<number | null>(null);
  const ashRoomIdRef = useRef<string | null>(null);
  ashRoomIdRef.current = ashRoom?.roomId ?? null;

  const listRooms = useMemo(() => {
    // Always filter leavingId so the live room cannot flash back after ash clears
    // while network leave is still in flight.
    const base = leavingId
      ? joinedRooms.filter((room) => room.roomId !== leavingId)
      : joinedRooms;
    if (!ashRoom) return base;
    if (base.some((room) => room.roomId === ashRoom.roomId)) return base;
    const next = [...base];
    const idx = Math.min(Math.max(ashIndexRef.current, 0), next.length);
    next.splice(idx, 0, ashRoom);
    return next;
  }, [joinedRooms, leavingId, ashRoom]);

  const clearColdExitTimer = () => {
    if (coldExitTimerRef.current !== null) {
      window.clearTimeout(coldExitTimerRef.current);
      coldExitTimerRef.current = null;
    }
  };

  const clearLeavingIfReady = (roomId: string) => {
    if (leaveNetDoneRef.current !== roomId || !leaveExitDoneRef.current) return;
    leaveNetDoneRef.current = null;
    leaveExitDoneRef.current = false;
    clearColdExitTimer();
    setLeavingId((cur) => (cur === roomId ? null : cur));
    if (leaveCommitRef.current === roomId) leaveCommitRef.current = null;
  };

  const commitLeaveNetwork = (roomId: string) => {
    if (!onLeaveRoom || leaveCommitRef.current === roomId) return;
    leaveCommitRef.current = roomId;
    leaveNetDoneRef.current = null;
    leaveExitDoneRef.current = false;
    void onLeaveRoom(roomId).finally(() => {
      leaveNetDoneRef.current = roomId;
      clearLeavingIfReady(roomId);
    });
  };

  /** Reduced-motion / cold path: filter card + Motion exit while network leave runs. */
  const commitLeaveCold = (roomId: string) => {
    if (!onLeaveRoom || leaveCommitRef.current === roomId) return;
    leaveCommitRef.current = roomId;
    leaveNetDoneRef.current = null;
    leaveExitDoneRef.current = false;
    clearColdExitTimer();
    coldExitTimerRef.current = window.setTimeout(() => {
      coldExitTimerRef.current = null;
      if (
        leaveCommitRef.current !== roomId &&
        leaveNetDoneRef.current !== roomId
      ) {
        return;
      }
      leaveExitDoneRef.current = true;
      clearLeavingIfReady(roomId);
    }, 900);
    void onLeaveRoom(roomId).finally(() => {
      leaveNetDoneRef.current = roomId;
      clearLeavingIfReady(roomId);
    });
  };

  const clearZoneAsh = useCallback(() => {
    const id = ashRoomIdRef.current;
    ashRoomIdRef.current = null;
    setAshRoom(null);
    if (!id) return;
    leaveExitDoneRef.current = true;
    clearLeavingIfReady(id);
  }, []);

  useEffect(() => () => clearColdExitTimer(), []);

  const onExitComplete = () => {
    const id = leaveCommitRef.current ?? leavingId;
    if (!id) return;
    leaveExitDoneRef.current = true;
    clearLeavingIfReady(id);
  };

  const confirmLeave = () => {
    const id = leaveTarget;
    setLeaveTarget(null);
    if (!id || !onLeaveRoom) return;
    haptic(HAPTIC_RITUAL);
    leaveCommitRef.current = null;
    // Pixel RegionAshOverlay disabled — keep QR fire; zone leave uses Motion exit only.
    setLeavingId(id);
    commitLeaveCold(id);
  };

  return {
    leaveTarget,
    setLeaveTarget,
    leavingId,
    ashRoom,
    listRooms,
    leaveCommitRef,
    clearZoneAsh,
    clearLeavingIfReady,
    onExitComplete,
    confirmLeave,
  };
}
