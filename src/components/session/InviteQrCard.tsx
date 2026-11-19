import type { RefObject, AnimationEvent } from 'react';
import { QrCode, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { contentSwitch } from '../../motion/tokens';
import { QR_SECRET_FIRE, type QrSecretFireGeom } from '../../motion/qrSecretFire';

/** Matches `--radius-ctrl` on `.qr-surface-3d`. Face padding (`p-2.5`) × 2. */
export const QR_CARD_RADIUS = 10;
export const QR_PAD = 20;

export type InviteQrCardProps = {
  size: number;
  dataUrl: string;
  includesSecret: boolean;
  scanning: boolean;
  scanEpoch: number;
  fireGeom: QrSecretFireGeom;
  stageRef: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  fireCanvasRef: RefObject<HTMLCanvasElement | null>;
  onLaserAnimationEnd: (e: AnimationEvent<HTMLDivElement>) => void;
  qrAlt: string;
  qrLocal: string;
  roomsQrHasSecret: string;
};

export function InviteQrCard({
  size,
  dataUrl,
  includesSecret,
  scanning,
  scanEpoch,
  fireGeom,
  stageRef,
  surfaceRef,
  fireCanvasRef,
  onLaserAnimationEnd,
  qrAlt,
  qrLocal,
  roomsQrHasSecret,
}: InviteQrCardProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div ref={stageRef} className="qr-perspective mx-auto">
        <div
          className={`qr-ambient-glow ${includesSecret ? 'qr-ambient-glow--fire' : ''}`}
          aria-hidden="true"
        />
        <div
          ref={surfaceRef}
          className={`qr-surface-3d rounded-[var(--radius-ctrl)] p-2.5 ${
            scanning ? 'scanning' : ''
          } ${includesSecret ? 'qr-has-secret' : ''}`}
        >
          <canvas
            ref={fireCanvasRef}
            className="qr-secret-fire"
            style={{
              width: fireGeom.canvasSize,
              height: fireGeom.canvasSize,
              top: -QR_SECRET_FIRE.pad,
              left: -QR_SECRET_FIRE.pad,
            }}
            aria-hidden="true"
          />
          <div className="qr-surface-face rounded-[calc(var(--radius-ctrl)-4px)]">
            <div
              key={scanEpoch}
              className="qr-laser-line"
              aria-hidden="true"
              onAnimationEnd={onLaserAnimationEnd}
            />
            <img
              src={dataUrl}
              alt={qrAlt}
              width={size}
              height={size}
              className="block max-w-full rounded-[calc(var(--radius-ctrl)-4px)]"
              draggable={false}
            />
          </div>
        </div>
      </div>
      <p className="flex max-w-[16rem] items-center justify-center gap-1.5 text-center text-[11px] leading-snug text-muted">
        <QrCode className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
        {qrLocal}
      </p>
      <div className="flex min-h-[1.35rem] max-w-[16rem] items-center justify-center">
        <AnimatePresence initial={false}>
          {includesSecret && (
            <motion.p
              key="secret-warn"
              initial={contentSwitch.initial}
              animate={contentSwitch.animate}
              exit={contentSwitch.exit}
              transition={contentSwitch.transition}
              className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-warn"
              role="status"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {roomsQrHasSecret}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
