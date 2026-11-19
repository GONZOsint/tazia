import { ZONE_BOOT } from '../../../motion/tokens';

export function readBootSeen(): boolean {
  try {
    return sessionStorage.getItem(ZONE_BOOT.storageKey) === '1';
  } catch {
    return false;
  }
}

export function markBootSeen(): void {
  try {
    sessionStorage.setItem(ZONE_BOOT.storageKey, '1');
  } catch {
    /* ignore */
  }
}
