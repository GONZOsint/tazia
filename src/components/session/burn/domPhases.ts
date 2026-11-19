/** Region / talk ash DOM class phases (ghost → collapse → clear). */
export type RegionAshPhase = 'collapse' | 'clear' | 'ghost';

export function setRegionAshPhase(els: HTMLElement[], phase: RegionAshPhase): void {
  for (const el of els) {
    if (phase === 'clear') {
      el.classList.remove('region-ash-collapse', 'region-ash--ghost', 'plaza-ash--ghost');
    } else if (phase === 'ghost') {
      el.classList.add('region-ash--ghost');
      el.classList.add('plaza-ash--ghost');
    } else {
      el.classList.add('region-ash-collapse');
    }
  }
}

/** Session “apagar llama” DOM class phases on `.session-burn-target`. */
export type SessionBurnPhase = 'front' | 'collapse' | 'clear';

export function setSessionBurnPhase(phase: SessionBurnPhase): void {
  const nodes = document.querySelectorAll('.session-burn-target');
  for (const el of nodes) {
    if (phase === 'clear') {
      el.classList.remove('burning-front', 'incinerated-collapse', 'burn-heat--ghost');
    } else if (phase === 'front') {
      if (!el.classList.contains('burn-heat')) {
        el.classList.add('burning-front');
      }
    } else if (!el.classList.contains('burn-heat')) {
      el.classList.add('incinerated-collapse');
    }
  }
}

export function ghostBurnButton(on: boolean): void {
  const btn = document.querySelector('.burn-heat.session-burn-target');
  if (!btn) return;
  btn.classList.toggle('burn-heat--ghost', on);
}

export function collectOtherTargetRects(burnEl: Element | null): DOMRect[] {
  const targets = document.querySelectorAll('.session-burn-target');
  const rects: DOMRect[] = [];
  for (const el of targets) {
    if (burnEl && el === burnEl) continue;
    if (el.classList.contains('burn-heat')) continue;
    rects.push(el.getBoundingClientRect());
  }
  return rects;
}
