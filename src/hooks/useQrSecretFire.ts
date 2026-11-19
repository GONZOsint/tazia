import { useEffect, useRef, type RefObject } from 'react';
import {
  QrSecretFireController,
  type QrSecretFireGeom,
} from '../motion/qrSecretFire';

export function useQrSecretFire(opts: {
  enabled: boolean;
  geom: QrSecretFireGeom;
  includesSecret: boolean;
}): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fireCtrlRef = useRef<QrSecretFireController | null>(null);
  const includesSecretRef = useRef(opts.includesSecret);
  includesSecretRef.current = opts.includesSecret;

  useEffect(() => {
    if (!opts.enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctrl: QrSecretFireController;
    try {
      ctrl = new QrSecretFireController(canvas, opts.geom);
    } catch {
      return;
    }
    fireCtrlRef.current = ctrl;
    ctrl.setFireOn(includesSecretRef.current);

    return () => {
      ctrl.dispose();
      if (fireCtrlRef.current === ctrl) fireCtrlRef.current = null;
    };
    // geom fields — avoid re-creating when only the object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled, opts.geom.canvasSize, opts.geom.lineSize, opts.geom.lineRadius]);

  useEffect(() => {
    fireCtrlRef.current?.setFireOn(opts.includesSecret);
  }, [opts.includesSecret]);

  return canvasRef;
}
