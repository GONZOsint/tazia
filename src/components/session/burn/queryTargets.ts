/** Deduped HTMLElement list for CSS selectors (primary first). */
export function queryBurnTargets(selectors: string[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const sel of selectors) {
    if (!sel) continue;
    for (const node of document.querySelectorAll(sel)) {
      if (!(node instanceof HTMLElement) || seen.has(node)) continue;
      seen.add(node);
      out.push(node);
    }
  }
  return out;
}

/**
 * Query now; if empty, retry next animation frame (classes may land same commit as play).
 * Calls `onFound` with elements, or `onEmpty` if still none after retry.
 * Returns a cancel handle for the pending rAF.
 */
export function queryBurnTargetsWithRetry(
  selectors: string[],
  opts: {
    onFound: (els: HTMLElement[]) => void;
    onEmpty: () => void;
    isCancelled: () => boolean;
  }
): { cancel: () => void } {
  const first = queryBurnTargets(selectors);
  if (first.length) {
    opts.onFound(first);
    return { cancel: () => undefined };
  }

  let retryRaf: number | null = window.requestAnimationFrame(() => {
    retryRaf = null;
    if (opts.isCancelled()) return;
    const second = queryBurnTargets(selectors);
    if (second.length) opts.onFound(second);
    else opts.onEmpty();
  });

  return {
    cancel: () => {
      if (retryRaf !== null) {
        cancelAnimationFrame(retryRaf);
        retryRaf = null;
      }
    },
  };
}
