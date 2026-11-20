import { useEffect, useMemo, useRef, useState } from 'react';
import type { RoomState } from '../../../hooks/useRoomManager';
import { haptic, HAPTIC_RITUAL } from '../../../motion/haptic';

type LeaveOpts = {
  joinedRooms: RoomState[];
  onLeaveRoom?: (roomId: string) => Promise<void>;
};

/** Zone leave pipeline — Motion exit + network leave. */
export function useZoneLeave({ joinedRooms, onLeaveRoom }: LeaveOpts) {
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  /** Optimistic leave — filtered from the list so exit + sibling layout overlap. */
  const [leavingId, setLeavingId] = useState<string | null>(null);
  /** Prevents double commit from rapid confirm taps. */
  const leaveCommitRef = useRef<string | null>(null);
  /** Gate: clear leavingId only after network leave + Motion exit both finish. */
  const leaveNetDoneRef = useRef<string | null>(null);
  const leaveExitDoneRef = useRef(false);
  const coldExitTimerRef = useRef<number | null>(null);

  const listRooms = useMemo(() => {
    if (!leavingId) return joinedRooms;
    return joinedRooms.filter((room) => room.roomId !== leavingId);
  }, [joinedRooms, leavingId]);

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

  /** Filter card + Motion exit while network leave runs. */
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
    setLeavingId(id);
    commitLeaveCold(id);
  };

  return {
    leaveTarget,
    setLeaveTarget,
    leavingId,
    listRooms,
    leaveCommitRef,
    onExitComplete,
    confirmLeave,
  };
}
