/**
 * Subtle perimeter fire line for the invite QR when the phrase is in the link.
 * Implementation lives under `./qrFire/*`; this file is the stable barrel for InviteQr.
 */

export { QR_SECRET_FIRE } from './qrFire/budget';
export {
  getPerimeterPoint,
  geomForQrSurface,
  type PerimeterPoint,
  type QrSecretFireGeom,
} from './qrFire/perimeter';
export { QrSecretFireController } from './qrFire/controller';
