import { FLAME_PATH_D } from './budget';
import { cssVar } from './palette';

export interface BurnSnapshot {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pxW: number;
  pxH: number;
  cssW: number;
  cssH: number;
  pad: number;
  radius: number;
  origPixels: Uint8ClampedArray;
}

/** @deprecated Prefer BurnSnapshot — kept for existing call sites. */
export type ButtonSnapshot = BurnSnapshot;

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function paintCssBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cs: CSSStyleDeclaration
): void {
  if (w < 1 || h < 1) return;
  const radiusRaw = cs.borderRadius.split(' ')[0] ?? '0';
  const radius = Math.min(parseFloat(radiusRaw) || 0, w / 2, h / 2);
  const bg = cs.backgroundColor;
  const hasBg =
    bg &&
    bg !== 'rgba(0, 0, 0, 0)' &&
    bg !== 'transparent' &&
    !bg.includes('0, 0, 0, 0)');
  if (hasBg) {
    roundedRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = bg;
    ctx.fill();
  }
  const bw = parseFloat(cs.borderTopWidth) || 0;
  if (bw > 0.4) {
    const bc = cs.borderTopColor;
    if (bc && bc !== 'transparent') {
      roundedRectPath(ctx, x, y, w, h, radius);
      ctx.strokeStyle = bc;
      ctx.lineWidth = Math.min(bw, 2);
      ctx.stroke();
    }
  }
}

/** Paint a danger/fire burn-control lookalike for pixel incineration. */
export function createBurnButtonSnapshot(
  rect: DOMRect,
  dpr: number,
  labelText?: string | null
): BurnSnapshot | null {
  const pad = 4;
  const cssW = rect.width + pad * 2;
  const cssH = rect.height + pad * 2;
  if (cssW < 8 || cssH < 8) return null;

  const pxW = Math.max(1, Math.round(cssW * dpr));
  const pxH = Math.max(1, Math.round(cssH * dpr));
  const off = document.createElement('canvas');
  off.width = pxW;
  off.height = pxH;
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bx = pad;
  const by = pad;
  const bw = rect.width;
  const bh = rect.height;
  const radius = 10; // --radius-ctrl

  const dangerBg = cssVar('--color-danger-bg', '#c93c3c');
  const dangerBorder = cssVar('--color-danger-border', '#c93c3c');
  const fireMid = cssVar('--fire-mid', '#c9780a');
  const fireEdge = cssVar('--fire-edge', '#9a4f0a');
  const fireCore = cssVar('--fire-core', '#e8b84a');
  const dangerInk = cssVar('--color-danger-ink', '#8f1f1f');

  const grad = octx.createLinearGradient(bx, by, bx + bw, by + bh);
  grad.addColorStop(0, dangerBg);
  grad.addColorStop(0.45, fireEdge);
  grad.addColorStop(1, fireMid);

  roundedRectPath(octx, bx, by, bw, bh, radius);
  octx.fillStyle = grad;
  octx.fill();

  octx.lineWidth = 1.25;
  octx.strokeStyle = dangerBorder;
  roundedRectPath(octx, bx, by, bw, bh, radius);
  octx.stroke();

  const iconSize = 16;
  const hasLabel = Boolean(labelText && labelText.trim() && bw > 56);
  const iconX = hasLabel ? bx + 12 : bx + (bw - iconSize) / 2;
  const iconY = by + (bh - iconSize) / 2;
  if (typeof Path2D !== 'undefined') {
    const path = new Path2D(FLAME_PATH_D);
    octx.save();
    octx.translate(iconX, iconY);
    octx.scale(iconSize / 24, iconSize / 24);
    octx.fillStyle = fireCore;
    octx.fill(path);
    octx.restore();
  }

  if (hasLabel) {
    octx.fillStyle = dangerInk;
    octx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
    octx.textAlign = 'left';
    octx.textBaseline = 'middle';
    octx.fillText(labelText!.trim(), iconX + iconSize + 8, by + bh / 2 + 0.5);
  }

  const imageData = octx.getImageData(0, 0, pxW, pxH);
  return {
    canvas: off,
    ctx: octx,
    pxW,
    pxH,
    cssW,
    cssH,
    pad,
    radius,
    origPixels: new Uint8ClampedArray(imageData.data),
  };
}

/**
 * Sync structural snapshot of a DOM region for fractal incineration
 * (talk ash / topic chip). Paints backgrounds + leaf text so large panels
 * stay cheap vs foreignObject HTML capture.
 */
export function createRegionBurnSnapshot(
  el: HTMLElement,
  dpr: number,
  opts?: { pad?: number; maxEdgePx?: number; maxNodes?: number }
): BurnSnapshot | null {
  const pad = opts?.pad ?? 4;
  const maxEdgePx = opts?.maxEdgePx ?? 420;
  const maxNodes = opts?.maxNodes ?? 72;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return null;

  const cssW = rect.width + pad * 2;
  const cssH = rect.height + pad * 2;
  const edge = Math.max(cssW, cssH) * dpr;
  const scale = edge > maxEdgePx ? maxEdgePx / edge : 1;
  const snapDpr = Math.max(0.5, dpr * scale);

  const pxW = Math.max(1, Math.round(cssW * snapDpr));
  const pxH = Math.max(1, Math.round(cssH * snapDpr));
  const off = document.createElement('canvas');
  off.width = pxW;
  off.height = pxH;
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.setTransform(snapDpr, 0, 0, snapDpr, 0, 0);

  const rootCs = getComputedStyle(el);
  const radius = Math.min(
    parseFloat(rootCs.borderRadius.split(' ')[0] ?? '0') || 10,
    rect.width / 2,
    rect.height / 2
  );
  // Opaque substrate so transparent panels still have pixels for the burn front.
  roundedRectPath(octx, pad, pad, rect.width, rect.height, radius);
  octx.fillStyle = cssVar('--color-surface', cssVar('--color-bg', '#12140f'));
  octx.fill();
  paintCssBox(octx, pad, pad, rect.width, rect.height, rootCs);

  const nodes = el.querySelectorAll('*');
  let painted = 0;
  for (const node of nodes) {
    if (painted >= maxNodes) break;
    if (!(node instanceof HTMLElement)) continue;
    const cs = getComputedStyle(node);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity || '1') < 0.05) continue;
    const r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (
      r.bottom < rect.top ||
      r.top > rect.bottom ||
      r.right < rect.left ||
      r.left > rect.right
    ) {
      continue;
    }
    const x = pad + (r.left - rect.left);
    const y = pad + (r.top - rect.top);
    paintCssBox(octx, x, y, r.width, r.height, cs);

    const text =
      node.childNodes.length === 1 && node.childNodes[0]?.nodeType === Node.TEXT_NODE
        ? (node.textContent ?? '').trim()
        : '';
    if (text && r.height >= 10 && r.width >= 20) {
      const fontSize = Math.max(9, Math.min(16, parseFloat(cs.fontSize) || 12));
      octx.fillStyle = cs.color || cssVar('--color-ink', '#1a1a1a');
      octx.font = `${cs.fontWeight || 500} ${fontSize}px ${cs.fontFamily || '"IBM Plex Sans", system-ui, sans-serif'}`;
      octx.textAlign = 'left';
      octx.textBaseline = 'middle';
      const maxChars = Math.max(4, Math.floor((r.width - 8) / (fontSize * 0.52)));
      const label = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
      octx.fillText(label, x + 6, y + r.height / 2 + 0.5, Math.max(8, r.width - 12));
    }
    painted++;
  }

  const imageData = octx.getImageData(0, 0, pxW, pxH);
  return {
    canvas: off,
    ctx: octx,
    pxW,
    pxH,
    cssW,
    cssH,
    pad,
    radius,
    origPixels: new Uint8ClampedArray(imageData.data),
  };
}
