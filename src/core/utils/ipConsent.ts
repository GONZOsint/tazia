const IP_CONSENT_KEY = 'tazia-ip-consent';

export function hasIpConsent(): boolean {
  try {
    return localStorage.getItem(IP_CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function acceptIpConsent(): void {
  try {
    localStorage.setItem(IP_CONSENT_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Solo si el usuario pide «olvidar este dispositivo». No al salir de la sala. */
export function clearIpConsent(): void {
  try {
    localStorage.removeItem(IP_CONSENT_KEY);
  } catch {
    /* ignore */
  }
}
