const IP_CONSENT_KEY = 'tazia-ip-consent';
const LEGACY_CONSENT_KEY = 'agora-ip-consent';

export function hasIpConsent(): boolean {
  try {
    if (localStorage.getItem(IP_CONSENT_KEY) === '1') return true;
    if (localStorage.getItem(LEGACY_CONSENT_KEY) === '1') {
      localStorage.setItem(IP_CONSENT_KEY, '1');
      localStorage.removeItem(LEGACY_CONSENT_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function acceptIpConsent(): void {
  try {
    localStorage.setItem(IP_CONSENT_KEY, '1');
    localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* private mode */
  }
}

/** Solo si el usuario pide «olvidar este dispositivo». No al salir de la sala. */
export function clearIpConsent(): void {
  try {
    localStorage.removeItem(IP_CONSENT_KEY);
    localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* ignore */
  }
}
