/**
 * Flame avatar engine — ported from ai_studio_code(6).html mock.
 * Seeded geometry + shared rAF ticker (breathe, blink CSS, embers).
 */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  decodeAvatarSeed,
  encodeAvatarSeed,
  type AvatarSeedParts,
} from './avatarSeed';

const NS = 'http://www.w3.org/2000/svg';

import type { FlameThemeMode } from './themeWatch';
export type { FlameThemeMode };

let rngState = 0x9e3779b9;

function rng(): number {
  // xorshift32
  let x = rngState | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rngState = x | 0;
  return ((x >>> 0) % 1_000_000) / 1_000_000;
}

function setRngSeed(seed: number): void {
  rngState = (seed >>> 0) || 0xA5A5A5A5;
}


  const THEME_BGS = {
    light: { bg1: '#f1eee8', bg2: '#e4e1da', rim: '#a8a195', cream: '#f0eee6' },
    dark:  { bg1: '#1b1e16', bg2: '#12140f', rim: '#2e3128', cream: '#f0eee6' }
  };

  const PALETTES = [
    {
      id: 'lima_marca', name: 'Lima Marca',
      outline: '#121f0e', faceInk: '#0d170a',
      outerBase: '#33ad52', outerTip: '#1f7a4c',
      midBase: '#8de034', midTip: '#56c238',
      coreBase: '#ccff66', coreTip: '#e2ff99',
      bright: '#f7ffe0', glow: '#ccff66',
      orange: '#8de034', red: '#289648', yellow: '#ccff66',
      mouthDeep: '#6b1d24', tongue: '#e05c5c', blush: '#f07a7a'
    },
    {
      id: 'lima_neon', name: 'Lima Neón',
      outline: '#101a0a', faceInk: '#0a0d06',
      outerBase: '#5cc425', outerTip: '#2e8f24',
      midBase: '#b5e84f', midTip: '#84d428',
      coreBase: '#d9ff88', coreTip: '#ecffb8',
      bright: '#f7ffe8', glow: '#d9ff88',
      orange: '#b5e84f', red: '#4eb324', yellow: '#d9ff88',
      mouthDeep: '#5c1921', tongue: '#f07a7a', blush: '#f07a7a'
    },
    {
      id: 'lima_menta', name: 'Lima Menta',
      outline: '#0d1f18', faceInk: '#091711',
      outerBase: '#279e72', outerTip: '#15664b',
      midBase: '#4ecf9a', midTip: '#32b380',
      coreBase: '#ccff66', coreTip: '#b5fa8c',
      bright: '#f0eee6', glow: '#4ecf9a',
      orange: '#4ecf9a', red: '#1f7a5c', yellow: '#ccff66',
      mouthDeep: '#11382a', tongue: '#4ecf9a', blush: '#4ecf9a'
    },
    {
      id: 'lima_cian', name: 'Lima Eléctrica',
      outline: '#0b1d1b', faceInk: '#081413',
      outerBase: '#18968a', outerTip: '#0d6963',
      midBase: '#3ecfc4', midTip: '#22b3a4',
      coreBase: '#ccff66', coreTip: '#a6f79c',
      bright: '#f0eee6', glow: '#3ecfc4',
      orange: '#3ecfc4', red: '#0f7f78', yellow: '#ccff66',
      mouthDeep: '#0e3633', tongue: '#3ecfc4', blush: '#f07a7a'
    },
    {
      id: 'lima_bosque', name: 'Lima Bosque',
      outline: '#141a0d', faceInk: '#10140a',
      outerBase: '#438729', outerTip: '#255c1d',
      midBase: '#99d636', midTip: '#6eb528',
      coreBase: '#ccff66', coreTip: '#d9ff88',
      bright: '#f0eee6', glow: '#b5e84f',
      orange: '#99d636', red: '#387a24', yellow: '#ccff66',
      mouthDeep: '#5e1e20', tongue: '#c93c3c', blush: '#f07a7a'
    },
    {
      id: 'lima_citrica', name: 'Lima Cítrica',
      outline: '#161c0b', faceInk: '#0f1407',
      outerBase: '#72b51d', outerTip: '#468216',
      midBase: '#b5e84f', midTip: '#99d926',
      coreBase: '#e3ff80', coreTip: '#f2ffb0',
      bright: '#f7ffe6', glow: '#ccff66',
      orange: '#b5e84f', red: '#619e1a', yellow: '#e3ff80',
      mouthDeep: '#6b2220', tongue: '#f07a7a', blush: '#f0c14d'
    },
    {
      id: 'lima_crema', name: 'Lima Crema',
      outline: '#131d10', faceInk: '#0e170c',
      outerBase: '#47a64b', outerTip: '#27753a',
      midBase: '#a3e35b', midTip: '#74c445',
      coreBase: '#d9ff88', coreTip: '#ebffbf',
      bright: '#f0eee6', glow: '#d9ff88',
      orange: '#a3e35b', red: '#3b8f42', yellow: '#d9ff88',
      mouthDeep: '#591e23', tongue: '#e36464', blush: '#e36464'
    }
  ];

  const FLAME_STYLES = [
    'calcifer_classic', 'calcifer_spiky', 'calcifer_wild',
    'calcifer_tall', 'calcifer_tuft', 'calcifer_cozy', 'calcifer_twin'
  ];
  const STYLE_LABELS = {
    calcifer_classic: 'Lima clásica',
    calcifer_spiky: 'Corona danzante',
    calcifer_wild: 'Llamarada viva',
    calcifer_tall: 'Llama altiva',
    calcifer_tuft: 'Mechón al viento',
    calcifer_cozy: 'Brasa alegre',
    calcifer_twin: 'Puntas gemelas'
  };

  const EYE_STYLES = [
    'calcifer_angry_up', 'calcifer_half_up', 'calcifer_chewing_lids',
    'calcifer_wide_ring', 'calcifer_puppy_up', 'calcifer_fierce_white',
    'calcifer_blank_dot', 'calcifer_happy_arcs', 'calcifer_squint_laugh', 'calcifer_star'
  ];
  const MOUTH_STYLES = [
    'calcifer_bell_frown', 'calcifer_bean_laugh', 'calcifer_wavy_open',
    'calcifer_wide_gasp', 'calcifer_tiny_smile', 'calcifer_wide_evil_grin',
    'calcifer_tiny_dash', 'calcifer_open_happy', 'calcifer_fang_smile'
  ];
  const DETAIL_STYLES = ['highlights', 'blush_dots', 'embers', 'clean'];

  const EYE_LABELS = {
    calcifer_angry_up: 'gruñón',
    calcifer_half_up: 'encantado',
    calcifer_chewing_lids: 'astuto',
    calcifer_wide_ring: 'sobresalto',
    calcifer_puppy_up: 'ilusionado',
    calcifer_fierce_white: 'travieso',
    calcifer_blank_dot: 'impasible',
    calcifer_happy_arcs: 'feliz',
    calcifer_squint_laugh: 'risueño',
    calcifer_star: 'estelar'
  };

  const RING_N = 112;
  const RING_ANGLES = new Float32Array(RING_N);
  const RING_SIN = new Float32Array(RING_N);
  const RING_COS = new Float32Array(RING_N);
  for (let i = 0; i < RING_N; i++) {
    const phi = -Math.PI + (i / RING_N) * Math.PI * 2;
    RING_ANGLES[i] = phi;
    RING_SIN[i] = Math.sin(phi);
    RING_COS[i] = Math.cos(phi);
  }

  let uidCounter = 0;
  let themeMode: 'light' | 'dark' = 'light';

  const pick = a => a[Math.floor(rng() * a.length)];
  const rand = (a, b) => a + rng() * (b - a);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const round1 = n => ((n * 10 + (n >= 0 ? 0.5 : -0.5)) | 0) / 10;
  const shuffle = arr => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const fireHarmonic = p => 0.72 * Math.sin(p) + 0.24 * Math.sin(p * 2 - 0.55) + 0.08 * Math.sin(p * 3 + 0.3);

  function el(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function computeTangents(ptsX, ptsY, n, tBuf) {
    for (let i = 0; i < n; i++) {
      const iPrev = i === 0 ? n - 1 : i - 1;
      const iNext = i + 1 < n ? i + 1 : 0;
      const ax = ptsX[i] - ptsX[iPrev];
      const ay = ptsY[i] - ptsY[iPrev];
      const bx = ptsX[iNext] - ptsX[i];
      const by = ptsY[iNext] - ptsY[i];
      const la = Math.hypot(ax, ay) || 1;
      const lb = Math.hypot(bx, by) || 1;
      const dot = (ax * bx + ay * by) / (la * lb);
      tBuf[i] = 0.045 + (1 / 6 - 0.045) * smoothstep(-0.05, 0.72, dot);
    }
  }

  function ringToSmoothPathD(ptsX, ptsY, n, partsBuf, tBuf) {
    computeTangents(ptsX, ptsY, n, tBuf);
    let idx = 0;
    partsBuf[idx++] = 'M';
    partsBuf[idx++] = round1(ptsX[0]);
    partsBuf[idx++] = round1(ptsY[0]);

    for (let i = 0; i < n; i++) {
      const iPrev = i === 0 ? n - 1 : i - 1;
      const iNext = i + 1 < n ? i + 1 : 0;
      const iNext2 = i + 2 < n ? i + 2 : (i + 2) - n;
      const x0 = ptsX[i], y0 = ptsY[i];
      const x1 = ptsX[iNext], y1 = ptsY[iNext];
      const k0 = tBuf[i], k1 = tBuf[iNext];

      partsBuf[idx++] = 'C';
      partsBuf[idx++] = round1(x0 + (x1 - ptsX[iPrev]) * k0);
      partsBuf[idx++] = round1(y0 + (y1 - ptsY[iPrev]) * k0);
      partsBuf[idx++] = round1(x1 - (ptsX[iNext2] - x0) * k1);
      partsBuf[idx++] = round1(y1 - (ptsY[iNext2] - y0) * k1);
      partsBuf[idx++] = round1(x1);
      partsBuf[idx++] = round1(y1);
    }
    partsBuf[idx++] = 'Z';
    return partsBuf.join(' ');
  }

  function ringToBrokenStrokeD(ptsX, ptsY, n, partsBuf, tBuf, skipMask, startIdx, inkBreakSlots) {
    computeTangents(ptsX, ptsY, n, tBuf);
    let idx = 0;
    let drawing = false;

    for (let step = 0; step < n; step++) {
      const i = (startIdx + step) % n;
      if (skipMask[i]) { drawing = false; continue; }
      const iPrev = i === 0 ? n - 1 : i - 1;
      const iNext = i + 1 < n ? i + 1 : 0;
      const iNext2 = i + 2 < n ? i + 2 : (i + 2) - n;
      const x0 = ptsX[i], y0 = ptsY[i];
      const x1 = ptsX[iNext], y1 = ptsY[iNext];
      const k0 = tBuf[i], k1 = tBuf[iNext];

      if (!drawing) {
        partsBuf[idx++] = 'M';
        partsBuf[idx++] = round1(x0);
        partsBuf[idx++] = round1(y0);
        drawing = true;
      }
      partsBuf[idx++] = 'C';
      partsBuf[idx++] = round1(x0 + (x1 - ptsX[iPrev]) * k0);
      partsBuf[idx++] = round1(y0 + (y1 - ptsY[iPrev]) * k0);
      partsBuf[idx++] = round1(x1 - (ptsX[iNext2] - x0) * k1);
      partsBuf[idx++] = round1(y1 - (ptsY[iNext2] - y0) * k1);
      partsBuf[idx++] = round1(x1);
      partsBuf[idx++] = round1(y1);
    }

    for (let b = 0; b < inkBreakSlots.length; b++) {
      const slot = inkBreakSlots[b];
      for (let d = 0; d < slot.dotIndices.length; d++) {
        const vi = slot.dotIndices[d] % n;
        slot.dots[d].setAttribute('cx', String(round1(ptsX[vi])));
        slot.dots[d].setAttribute('cy', String(round1(ptsY[vi])));
      }
    }

    return partsBuf.slice(0, idx).join(' ');
  }

  function buildFlameModel(styleName, moodTempo) {
    const dir = rng() < 0.5 ? -1 : 1;
    let rx = rand(242, 260);
    let ry = rand(206, 222);
    let lean = dir * rand(12, 22);
    const cy = 612;
    let speedMult = moodTempo;
    let tongues = [];

    switch (styleName) {
      case 'calcifer_classic':
        rx = rand(246, 262); ry = rand(208, 222); lean = dir * rand(14, 24);
        tongues = [
          { phi: dir * -0.10, h: rand(168, 194), w: 0.42, curl: dir * 42,  sway: 0.11, freq: 1.65, phase: 0.2, upBias: 0.92 },
          { phi: dir * 0.44,  h: rand(112, 136), w: 0.34, curl: dir * 32,  sway: 0.09, freq: 2.10, phase: 1.6, upBias: 0.88 },
          { phi: dir * -0.68, h: rand(90, 114),  w: 0.32, curl: dir * 24,  sway: 0.08, freq: 2.00, phase: 3.1, upBias: 0.86 },
          { phi: dir * 1.04,  h: rand(62, 84),   w: 0.28, curl: -dir * 18, sway: 0.07, freq: 2.45, phase: 4.4, upBias: 0.95 }
        ];
        break;
      case 'calcifer_spiky':
        rx = rand(240, 256); ry = rand(204, 218); lean = dir * rand(10, 20);
        tongues = [
          { phi: dir * 0.06,  h: rand(164, 188), w: 0.38, curl: -dir * 34, sway: 0.11, freq: 1.75, phase: 0.3, upBias: 0.92 },
          { phi: -0.48,       h: rand(118, 142), w: 0.32, curl: -30,       sway: 0.09, freq: 2.15, phase: 1.5, upBias: 0.88 },
          { phi: 0.52,        h: rand(102, 126), w: 0.30, curl: 28,        sway: 0.09, freq: 2.05, phase: 2.8, upBias: 0.88 },
          { phi: -1.04,       h: rand(68, 88),   w: 0.26, curl: 20,        sway: 0.07, freq: 2.50, phase: 4.1, upBias: 0.95 }
        ];
        break;
      case 'calcifer_wild':
        rx = rand(254, 272); ry = rand(198, 214); speedMult *= 1.10; lean = dir * rand(12, 22);
        tongues = [
          { phi: -0.20, h: rand(162, 186), w: 0.36, curl: -34, sway: 0.11, freq: 1.90, phase: 0.1, upBias: 0.92 },
          { phi: 0.26,  h: rand(138, 162), w: 0.34, curl: 34,  sway: 0.10, freq: 2.10, phase: 1.7, upBias: 0.90 },
          { phi: -0.74, h: rand(102, 126), w: 0.30, curl: -26, sway: 0.08, freq: 2.35, phase: 3.0, upBias: 0.88 },
          { phi: 0.78,  h: rand(96, 120),  w: 0.30, curl: 26,  sway: 0.08, freq: 2.25, phase: 4.3, upBias: 0.88 },
          { phi: -1.20, h: rand(66, 86),   w: 0.26, curl: 22,  sway: 0.07, freq: 2.60, phase: 5.3, upBias: 0.98 }
        ];
        break;
      case 'calcifer_tall':
        rx = rand(224, 240); ry = rand(222, 236); lean = dir * rand(16, 26);
        tongues = [
          { phi: dir * 0.04,  h: rand(182, 210), w: 0.44, curl: -dir * 46, sway: 0.12, freq: 1.55, phase: 0.4, upBias: 0.95 },
          { phi: -dir * 0.56, h: rand(98, 122),  w: 0.32, curl: -dir * 24, sway: 0.08, freq: 2.05, phase: 1.9, upBias: 0.90 },
          { phi: dir * 0.64,  h: rand(86, 110),  w: 0.30, curl: dir * 22,  sway: 0.08, freq: 2.20, phase: 3.3, upBias: 0.90 }
        ];
        break;
      case 'calcifer_tuft':
        rx = rand(240, 258); ry = rand(210, 224); lean = dir * rand(28, 42);
        tongues = [
          { phi: dir * -0.08, h: rand(166, 192), w: 0.44, curl: dir * 56, sway: 0.12, freq: 1.65, phase: 0.5, upBias: 0.92 },
          { phi: dir * 0.48,  h: rand(108, 132), w: 0.34, curl: dir * 38, sway: 0.09, freq: 2.05, phase: 2.1, upBias: 0.90 },
          { phi: dir * -0.66, h: rand(82, 106),  w: 0.30, curl: dir * 28, sway: 0.08, freq: 2.30, phase: 3.7, upBias: 0.88 }
        ];
        break;
      case 'calcifer_cozy':
        rx = rand(256, 274); ry = rand(202, 216); speedMult *= 0.94; lean = dir * rand(8, 16);
        tongues = [
          { phi: -0.16 * dir, h: rand(132, 156), w: 0.40, curl: dir * 28,  sway: 0.10, freq: 1.60, phase: 0.0, upBias: 0.92 },
          { phi: 0.32 * dir,  h: rand(108, 130), w: 0.34, curl: dir * 24,  sway: 0.09, freq: 1.90, phase: 1.7, upBias: 0.90 },
          { phi: -0.74 * dir, h: rand(74, 94),   w: 0.30, curl: -dir * 18, sway: 0.07, freq: 2.20, phase: 3.2, upBias: 0.90 }
        ];
        break;
      case 'calcifer_twin':
        rx = rand(244, 262); ry = rand(206, 220); lean = dir * rand(10, 18);
        tongues = [
          { phi: -0.34, h: rand(162, 188), w: 0.38, curl: -38, sway: 0.11, freq: 1.75, phase: 0.3, upBias: 0.94 },
          { phi: 0.38,  h: rand(144, 170), w: 0.36, curl: 36,  sway: 0.10, freq: 1.90, phase: 2.1, upBias: 0.94 },
          { phi: -0.92, h: rand(78, 100),  w: 0.28, curl: -22, sway: 0.08, freq: 2.30, phase: 3.7, upBias: 0.92 },
          { phi: 0.96,  h: rand(70, 92),   w: 0.28, curl: 22,  sway: 0.08, freq: 2.25, phase: 5.0, upBias: 0.92 }
        ];
        break;
    }

    const thermalWaves = [
      { side: -1, dur: rand(1.85, 2.4) / speedMult, phase: 0.0, amp: rand(13, 18) },
      { side: 1,  dur: rand(1.90, 2.5) / speedMult, phase: 0.5, amp: rand(13, 18) },
      { side: -1, dur: rand(2.05, 2.6) / speedMult, phase: 0.35, amp: rand(9, 14) },
      { side: 1,  dur: rand(2.00, 2.5) / speedMult, phase: 0.85, amp: rand(9, 14) }
    ];

    const tipCoords = tongues.map(() => ({ x: 512, y: 360, prevPulse: 0 }));
    const ptsBuf = () => new Float32Array(RING_N);
    const partsBuf = () => new Array(3 + RING_N * 7 + 1);

    return {
      styleName, cx: 512, cy, rx, ry, dir, lean, speedMult,
      tongues, tipCoords, thermalWaves,
      tBuf: new Float32Array(RING_N),
      outerX: ptsBuf(), outerY: ptsBuf(), outerParts: partsBuf(),
      strokeParts: new Array(RING_N * 8),
      midX: ptsBuf(),   midY: ptsBuf(),   midParts: partsBuf(),
      coreX: ptsBuf(),  coreY: ptsBuf(),  coreParts: partsBuf(),
      heartX: ptsBuf(), heartY: ptsBuf(), heartParts: partsBuf()
    };
  }

  function evaluateFlameContour(model, t, cfg, outX, outY, pinchQueue = null) {
    const { cx, cy, rx, ry, lean, speedMult, tongues, thermalWaves, tipCoords } = model;
    const {
      scaleRx, scaleRy, yOffset, floatY, tongueMult, squashX, stretchY,
      timeLag, curlMult, tipBoost, innerFlutter
    } = cfg;

    const tt = (t - timeLag) * speedMult;
    const effRx = rx * scaleRx * squashX;
    const effRy = ry * scaleRy * stretchY;
    const effCy = cy + yOffset + floatY;

    for (let i = 0; i < RING_N; i++) {
      const sinP = RING_SIN[i];
      const cosP = RING_COS[i];
      const bottomCushion = 1.0 - 0.06 * smoothstep(-0.2, 0.5, -cosP);
      const upWeight = smoothstep(-0.25, 0.75, cosP);
      const upFlow = cosP > -0.15 ? Math.sin(Math.abs(RING_ANGLES[i]) * 4.0 + tt * 3.4) * 4.0 * smoothstep(-0.15, 0.45, cosP) : 0;

      outX[i] = cx + effRx * sinP + lean * upWeight * scaleRx + upFlow;
      outY[i] = effCy - effRy * cosP * bottomCushion;
    }

    for (let tw = 0; tw < thermalWaves.length; tw++) {
      const wv = thermalWaves[tw];
      const life = (((t - timeLag) / wv.dur + wv.phase) % 1 + 1) % 1;
      const phiPos = wv.side * (1.58 - life * 1.18);
      const env = Math.sin(life * Math.PI) * wv.amp * scaleRx;
      for (let i = 0; i < RING_N; i++) {
        const d = Math.atan2(Math.sin(RING_ANGLES[i] - phiPos), Math.cos(RING_ANGLES[i] - phiPos));
        const g = Math.exp(-(d * d) / (0.30 * 0.30));
        if (g > 0.02) {
          outX[i] += g * env * wv.side * 0.65;
          outY[i] -= g * env * 0.92;
        }
      }
    }

    for (let k = 0; k < tongues.length; k++) {
      const tg = tongues[k];
      const tPhi = tg.phi + fireHarmonic(tt * tg.freq + tg.phase) * tg.sway;
      const pulseWave = fireHarmonic(tt * (tg.freq * 1.24) + tg.phase);
      const pulse = 0.84 + 0.18 * pulseWave + (innerFlutter ? 0.03 * Math.sin(tt * 4.8 + k * 1.7) : 0);
      const tH = tg.h * tongueMult * pulse * tipBoost;
      const baseCurl = tg.curl * curlMult;
      const invW = 1 / tg.w;
      const upWeight = tg.upBias || 0.90;

      let bestI = 0, bestU = 9;
      for (let i = 0; i < RING_N; i++) {
        const dPhi = Math.atan2(Math.sin(RING_ANGLES[i] - tPhi), Math.cos(RING_ANGLES[i] - tPhi));
        const u = Math.abs(dPhi) * invW;
        if (u < 1.0) {
          const w = Math.pow(1 - Math.pow(u, 1.30), 1.85);
          const whip = fireHarmonic(tt * (tg.freq * 1.50) - w * 2.8 + tg.phase) * 18 * curlMult;
          const localCurl = baseCurl * (0.86 + 0.22 * Math.cos(tt * tg.freq + tg.phase)) + whip;

          outY[i] -= w * tH * (upWeight + (1 - upWeight) * Math.cos(tPhi));
          outX[i] += w * (tH * 0.25 * Math.sin(tPhi) + localCurl * Math.pow(w, 0.72));
          if (u < bestU) { bestU = u; bestI = i; }
        }
      }

      if (pinchQueue) {
        const tc = tipCoords[k];
        tc.x = outX[bestI];
        tc.y = outY[bestI];
        if (tc.prevPulse < 0.72 && pulseWave >= 0.72 && k < 3) {
          pinchQueue.push({ x: tc.x, y: tc.y, curlDir: Math.sign(tg.curl) || 1 });
        }
        tc.prevPulse = pulseWave;
      }
    }

    for (let i = 0; i < RING_N; i++) {
      if (outY[i] < 146) outY[i] = 146 - 30 * Math.tanh((146 - outY[i]) / 30);
      if (outY[i] > 845) outY[i] = 845 + 14 * Math.tanh((outY[i] - 845) / 14);
    }
  }

  function pickHarmoniousFace(forcedEyes, forcedMouth) {
    const eyeStyle = forcedEyes || pick(EYE_STYLES);
    let mouthPool = MOUTH_STYLES;

    if (!forcedMouth) {
      if (eyeStyle === 'calcifer_angry_up') mouthPool = ['calcifer_bell_frown', 'calcifer_wide_gasp'];
      else if (eyeStyle === 'calcifer_half_up') mouthPool = ['calcifer_bean_laugh', 'calcifer_open_happy'];
      else if (eyeStyle === 'calcifer_chewing_lids') mouthPool = ['calcifer_wavy_open', 'calcifer_wide_gasp', 'calcifer_fang_smile'];
      else if (eyeStyle === 'calcifer_happy_arcs' || eyeStyle === 'calcifer_squint_laugh') mouthPool = ['calcifer_open_happy', 'calcifer_bean_laugh', 'calcifer_tiny_smile'];
      else if (eyeStyle === 'calcifer_wide_ring') mouthPool = ['calcifer_wide_gasp', 'calcifer_open_happy', 'calcifer_tiny_smile'];
      else if (eyeStyle === 'calcifer_puppy_up' || eyeStyle === 'calcifer_star') mouthPool = ['calcifer_bean_laugh', 'calcifer_open_happy', 'calcifer_fang_smile'];
      else if (eyeStyle === 'calcifer_fierce_white') mouthPool = ['calcifer_wide_evil_grin', 'calcifer_fang_smile', 'calcifer_open_happy'];
      else if (eyeStyle === 'calcifer_blank_dot') mouthPool = ['calcifer_tiny_dash', 'calcifer_wide_gasp'];
    }
    return { eyeStyle, mouthStyle: forcedMouth || pick(mouthPool) };
  }

  // Ojos simétricos y pupilas limpias SIN brillos blancos
  function buildEyePair(styleName) {
    const leftGroup = el('g', { class: 'eye-group eye-left' });
    const rightGroup = el('g', { class: 'eye-group eye-right' });
    const pupils = [];

    const makeBlinkable = g => {
      g.classList.add('eye-blink');
      const openWrap = el('g', { class: 'eye-open' });
      while (g.firstChild) openWrap.appendChild(g.firstChild);
      g.appendChild(openWrap);
    };
    const trackPupil = node => { pupils.push(node); return node; };

    switch (styleName) {
      case 'calcifer_angry_up':
        leftGroup.appendChild(el('path', {
          class: 'eye-white', 'stroke-width': '15',
          d: 'M 366 550 L 478 588 C 474 624, 444 640, 408 634 C 370 628, 356 592, 366 550 Z'
        }));
        leftGroup.appendChild(trackPupil(el('path', {
          class: 's1',
          d: 'M 412 566 L 468 585 C 466 606, 450 616, 434 614 C 414 610, 406 588, 412 566 Z'
        })));
        rightGroup.appendChild(el('path', {
          class: 'eye-white', 'stroke-width': '15',
          d: 'M 626 588 L 738 548 C 748 590, 734 626, 696 632 C 660 638, 630 622, 626 588 Z'
        }));
        rightGroup.appendChild(trackPupil(el('path', {
          class: 's1',
          d: 'M 636 584 L 692 564 C 698 586, 690 608, 670 612 C 654 614, 638 604, 636 584 Z'
        })));
        makeBlinkable(leftGroup);
        makeBlinkable(rightGroup);
        break;

      case 'calcifer_half_up':
        leftGroup.appendChild(el('path', {
          class: 'eye-white', 'stroke-width': '14.5',
          d: 'M 364 602 C 364 560, 402 544, 438 552 C 470 558, 482 582, 478 604 Q 422 612 364 602 Z'
        }));
        leftGroup.appendChild(trackPupil(el('ellipse', { class: 's1', cx: '426', cy: '578', rx: '13.5', ry: '22' })));
        rightGroup.appendChild(el('path', {
          class: 'eye-white', 'stroke-width': '14.5',
          d: 'M 626 604 C 622 582, 634 558, 666 552 C 702 544, 740 560, 740 602 Q 682 612 626 604 Z'
        }));
        rightGroup.appendChild(trackPupil(el('ellipse', { class: 's1', cx: '678', cy: '578', rx: '13.5', ry: '22' })));
        makeBlinkable(leftGroup);
        makeBlinkable(rightGroup);
        break;

      case 'calcifer_chewing_lids':
        leftGroup.appendChild(el('path', {
          class: 'eye-white', 'stroke-width': '14.5',
          d: 'M 364 556 Q 396 544 422 558 Q 448 570 472 560 C 482 596, 456 626, 418 626 C 378 626, 354 596, 364 556 Z'
        }));
        leftGroup.appendChild(trackPupil(el('circle', { class: 's1', cx: '412', cy: '584', r: '18.5' })));
        rightGroup.appendChild(el('path', {
          class: 'eye-white', 'stroke-width': '14.5',
          d: 'M 632 560 Q 656 570 682 558 Q 708 544 740 556 C 750 596, 726 626, 686 626 C 648 626, 622 596, 632 560 Z'
        }));
        rightGroup.appendChild(trackPupil(el('circle', { class: 's1', cx: '680', cy: '584', r: '18.5' })));
        makeBlinkable(leftGroup);
        makeBlinkable(rightGroup);
        break;

      case 'calcifer_happy_arcs':
        leftGroup.appendChild(el('path', { class: 's1-stroke', 'stroke-width': '15.5', d: 'M 364 606 Q 412 558 460 602' }));
        rightGroup.appendChild(el('path', { class: 's1-stroke', 'stroke-width': '15.5', d: 'M 644 600 Q 692 556 740 602' }));
        break;

      case 'calcifer_squint_laugh':
        leftGroup.appendChild(el('path', { class: 's1-stroke', 'stroke-width': '15', d: 'M 364 568 L 456 592 L 366 616' }));
        rightGroup.appendChild(el('path', { class: 's1-stroke', 'stroke-width': '15', d: 'M 740 568 L 648 592 L 738 616' }));
        break;

      case 'calcifer_wide_ring':
        leftGroup.appendChild(el('circle', { class: 'eye-white', 'stroke-width': '14.5', cx: '402', cy: '592', r: '46' }));
        leftGroup.appendChild(trackPupil(el('circle', { class: 's1', cx: '402', cy: '592', r: '18.5' })));
        rightGroup.appendChild(el('circle', { class: 'eye-white', 'stroke-width': '14.5', cx: '702', cy: '590', r: '45' }));
        rightGroup.appendChild(trackPupil(el('circle', { class: 's1', cx: '702', cy: '590', r: '18' })));
        makeBlinkable(leftGroup);
        makeBlinkable(rightGroup);
        break;

      case 'calcifer_puppy_up':
        leftGroup.appendChild(el('circle', { class: 'eye-white', 'stroke-width': '14.5', cx: '412', cy: '586', r: '45' }));
        leftGroup.appendChild(trackPupil(el('circle', { class: 's1', cx: '414', cy: '570', r: '24' })));
        rightGroup.appendChild(el('circle', { class: 'eye-white', 'stroke-width': '14.5', cx: '692', cy: '584', r: '44' }));
        rightGroup.appendChild(trackPupil(el('circle', { class: 's1', cx: '690', cy: '568', r: '23.5' })));
        makeBlinkable(leftGroup);
        makeBlinkable(rightGroup);
        break;

      case 'calcifer_fierce_white':
        leftGroup.appendChild(el('path', {
          class: 'eye-white', 'stroke-width': '15',
          d: 'M 360 546 L 478 588 C 468 624, 434 636, 396 626 C 362 616, 352 582, 360 546 Z'
        }));
        rightGroup.appendChild(el('path', {
          class: 'eye-white', 'stroke-width': '15',
          d: 'M 626 588 L 744 544 C 752 580, 742 614, 708 624 C 670 634, 636 622, 626 588 Z'
        }));
        makeBlinkable(leftGroup);
        makeBlinkable(rightGroup);
        break;

      case 'calcifer_blank_dot':
        leftGroup.appendChild(el('circle', { class: 'eye-white', 'stroke-width': '14.5', cx: '408', cy: '590', r: '44' }));
        leftGroup.appendChild(trackPupil(el('circle', { class: 's1', cx: '408', cy: '590', r: '13.5' })));
        rightGroup.appendChild(el('circle', { class: 'eye-white', 'stroke-width': '14.5', cx: '696', cy: '586', r: '42' }));
        rightGroup.appendChild(trackPupil(el('circle', { class: 's1', cx: '696', cy: '586', r: '13' })));
        makeBlinkable(leftGroup);
        makeBlinkable(rightGroup);
        break;

      case 'calcifer_star':
        leftGroup.appendChild(el('circle', { class: 'eye-white', 'stroke-width': '14.5', cx: '412', cy: '588', r: '46' }));
        leftGroup.appendChild(trackPupil(el('path', {
          class: 's1',
          d: 'M 412 560 Q 418 582 438 588 Q 418 594 412 616 Q 406 594 386 588 Q 406 582 412 560 Z'
        })));
        rightGroup.appendChild(el('circle', { class: 'eye-white', 'stroke-width': '14.5', cx: '692', cy: '586', r: '44' }));
        rightGroup.appendChild(trackPupil(el('path', {
          class: 's1',
          d: 'M 692 560 Q 698 580 716 586 Q 698 592 692 612 Q 686 592 668 586 Q 686 580 692 560 Z'
        })));
        makeBlinkable(leftGroup);
        makeBlinkable(rightGroup);
        break;
    }

    return { leftGroup, rightGroup, pupils };
  }

  function buildMouth(styleName) {
    const g = el('g', { class: 'mouth-group' });
    switch (styleName) {
      case 'calcifer_bell_frown':
        g.appendChild(el('path', {
          class: 'mouth-deep', 'stroke-width': '14',
          d: 'M 552 648 C 594 648, 638 692, 634 726 C 630 748, 474 748, 470 726 C 466 692, 510 648, 552 648 Z'
        }));
        g.appendChild(el('path', { class: 'tongue-pink', d: 'M 498 726 Q 552 696 606 726 Q 586 742 552 742 Q 518 742 498 726 Z' }));
        break;

      case 'calcifer_tiny_smile':
        g.appendChild(el('path', { class: 's1-stroke', 'stroke-width': '15', d: 'M 476 664 Q 552 714 628 662' }));
        break;

      case 'calcifer_wide_gasp':
        g.appendChild(el('path', {
          class: 'mouth-deep', 'stroke-width': '14',
          d: 'M 464 696 C 466 664, 510 652, 552 652 C 594 652, 638 664, 640 696 C 640 718, 614 726, 552 726 C 490 726, 464 718, 464 696 Z'
        }));
        g.appendChild(el('path', { class: 'tongue-pink', d: 'M 492 708 Q 552 686 612 708 Q 588 720 552 720 Q 516 720 492 708 Z' }));
        break;

      case 'calcifer_bean_laugh':
        g.appendChild(el('path', {
          class: 'mouth-deep', 'stroke-width': '14',
          d: 'M 452 664 C 484 646, 524 662, 552 662 C 580 662, 620 646, 652 664 C 658 712, 616 748, 552 748 C 488 748, 446 712, 452 664 Z'
        }));
        g.appendChild(el('path', { class: 'tongue-pink', d: 'M 492 720 Q 552 690 612 720 Q 586 742 552 742 Q 518 742 492 720 Z' }));
        break;

      case 'calcifer_wide_evil_grin':
        g.appendChild(el('path', {
          class: 'mouth-deep', 'stroke-width': '14',
          d: 'M 432 654 Q 552 684 672 652 C 656 714, 608 744, 552 744 C 496 744, 448 714, 432 654 Z'
        }));
        g.appendChild(el('path', { class: 'tongue-pink', d: 'M 502 722 Q 552 694 602 722 Q 580 738 552 738 Q 524 738 502 722 Z' }));
        break;

      case 'calcifer_tiny_dash':
        g.appendChild(el('path', { class: 's1-stroke', 'stroke-width': '15', d: 'M 520 676 L 584 666' }));
        break;

      case 'calcifer_open_happy':
        g.appendChild(el('path', {
          class: 'mouth-deep', 'stroke-width': '14',
          d: 'M 466 660 Q 552 648 638 660 C 640 722, 600 752, 552 752 C 504 752, 464 722, 466 660 Z'
        }));
        g.appendChild(el('path', { class: 'tongue-pink', d: 'M 494 720 Q 552 690 610 720 Q 586 746 552 746 Q 518 746 494 720 Z' }));
        break;

      case 'calcifer_wavy_open':
        g.appendChild(el('path', {
          class: 'mouth-deep', 'stroke-width': '14',
          d: 'M 444 686 C 470 660, 518 678, 552 676 C 586 674, 634 658, 660 686 C 660 720, 624 748, 552 748 C 480 748, 444 720, 444 686 Z'
        }));
        g.appendChild(el('path', { class: 'tongue-pink', d: 'M 490 720 Q 552 690 614 720 Q 588 742 552 742 Q 516 742 490 720 Z' }));
        break;

      case 'calcifer_fang_smile':
        g.appendChild(el('path', { class: 's1-stroke', 'stroke-width': '15', d: 'M 468 672 Q 552 718 636 666' }));
        g.appendChild(el('path', { class: 'tooth-white', 'stroke-width': '8.5', d: 'M 588 684 L 604 716 L 620 678 Z' }));
        break;
    }
    return g;
  }

  // Sistema de fuego real desde 0:
  // 1) Lengüetas desprendidas (vortex pinch-off) SIN contorno negro, que se deforman y consumen de abajo a arriba
  // 2) Brasas convectivas estiradas por su vector de velocidad con turbulencia y parpadeo térmico
  function createRealFireEmbers(parentGroup, model, speedScale, uid) {
    const flamelets = [];
    const embers = [];
    const FLAMELET_POOL = 3;
    const EMBER_COUNT = 7;

    for (let i = 0; i < FLAMELET_POOL; i++) {
      const g = el('g', { opacity: '0' });
      const aura = el('circle', { cx: '0', cy: '0', r: '18', fill: `url(#grad-ember-halo-${uid})`, opacity: '0.55' });
      const outer = el('path', { fill: `url(#grad-flamelet-${uid})` });
      const core = el('path', { class: 's4', opacity: '0.92' });
      g.append(aura, outer, core);
      parentGroup.appendChild(g);
      flamelets.push({
        g, aura, outer, core,
        active: false, age: 0, dur: 0.55,
        x: 0, y: 0, vx: 0, vy: 110,
        baseH: 22, baseW: 8, curlDir: 1, phase: 0
      });
    }

    const spawnFlamelet = (x, y, curlDir = 1, initialAge = 0) => {
      let slot = flamelets.find(f => !f.active);
      if (!slot) slot = flamelets.reduce((a, b) => (a.age > b.age ? a : b));
      slot.active = true;
      slot.age = initialAge;
      slot.dur = rand(0.46, 0.68) / speedScale;
      slot.x = x + rand(-4, 4);
      slot.y = Math.max(150, y - 2);
      slot.vx = curlDir * rand(14, 34) + (x - model.cx) * 0.10;
      slot.vy = rand(105, 148) * speedScale;
      slot.baseH = rand(20, 27);
      slot.baseW = rand(7.5, 10.5);
      slot.curlDir = curlDir;
      slot.phase = rand(0, Math.PI * 2);
    };

    const renderFlamelet = f => {
      if (!f.active) { f.g.setAttribute('opacity', '0'); return; }
      const a = f.age;
      // Al desprenderse se estira, luego se consume de abajo hacia arriba hasta quedar en una brasa
      const burnDown = Math.max(0.18, 1 - Math.pow(a, 1.25) * 0.82);
      const h = f.baseH * burnDown;
      const w = f.baseW * (1 - a * 0.52);
      const curl = f.curlDir * Math.sin(a * 6.5 + f.phase) * (8 * (1 - a * 0.4));
      const op = a < 0.15 ? 0.94 : 0.94 * (1 - Math.pow((a - 0.15) / 0.85, 1.5));

      const outerD = `M ${round1(curl)} ${round1(-h)} C ${round1(w + curl * 0.45)} ${round1(-h * 0.25)} ${round1(w * 0.85)} ${round1(h * 0.35)} 0 ${round1(h * 0.52)} C ${round1(-w * 0.85)} ${round1(h * 0.35)} ${round1(-w + curl * 0.45)} ${round1(-h * 0.25)} ${round1(curl)} ${round1(-h)} Z`;
      const ih = h * 0.56, iw = w * 0.54, ic = curl * 0.5;
      const coreD = `M ${round1(ic)} ${round1(-ih + 2)} C ${round1(iw + ic * 0.3)} ${round1(-ih * 0.1)} ${round1(iw * 0.85)} ${round1(ih * 0.4)} 0 ${round1(ih * 0.55)} C ${round1(-iw * 0.85)} ${round1(ih * 0.4)} ${round1(-iw + ic * 0.3)} ${round1(-ih * 0.1)} ${round1(ic)} ${round1(-ih + 2)} Z`;

      const angle = clamp(Math.atan2(f.vx, f.vy) * (180 / Math.PI) * 0.55, -22, 22);
      f.outer.setAttribute('d', outerD);
      f.core.setAttribute('d', coreD);
      f.aura.setAttribute('r', String(round1(14 * (1 - a * 0.45))));
      f.g.setAttribute('transform', `translate(${round1(f.x)} ${round1(f.y)}) rotate(${round1(angle)})`);
      f.g.setAttribute('opacity', clamp(op * clamp((f.y - 80) / 80, 0, 1), 0, 1).toFixed(2));
    };

    const resetEmber = (em, initialAge) => {
      const tip = pick(model.tipCoords);
      em.x = tip.x + rand(-28, 28);
      em.y = Math.max(145, tip.y + rand(-10, 18));
      em.age = initialAge;
      em.dur = rand(0.95, 1.65) / speedScale;
      em.baseVx = (em.x - model.cx) * 0.15 + rand(-22, 22);
      em.baseVy = rand(95, 155) * speedScale;
      em.vx = em.baseVx;
      em.vy = em.baseVy;
      em.r = rand(2.8, 4.8);
      em.curlFreq = rand(3.5, 6.2);
      em.curlAmp = rand(22, 46);
      em.twinkleSpeed = rand(14, 24);
      em.phase = rand(0, Math.PI * 2);

      if (initialAge > 0) {
        const elap = initialAge * em.dur;
        em.x += em.baseVx * elap * 0.8;
        em.y -= em.baseVy * elap * 0.78;
      }
    };

    const renderEmber = em => {
      const a = em.age;
      const fade = a < 0.12 ? a / 0.12 : 1 - Math.pow((a - 0.12) / 0.88, 1.4);
      const crackle = 0.68 + 0.32 * Math.sin(a * em.twinkleSpeed + em.phase);
      const op = clamp(fade * crackle * clamp((em.y - 78) / 78, 0, 1), 0, 1);

      const speed = Math.hypot(em.vx, em.vy);
      // Estiramiento real proporcional a la velocidad (motion streak de brasa caliente)
      const stretch = clamp(1 + (speed / 120) * 1.15 * (1 - a * 0.45), 1, 2.35);
      const shrink = 1 - a * 0.58;
      const ang = Math.atan2(em.vx, Math.max(10, em.vy)) * (180 / Math.PI);

      em.g.setAttribute(
        'transform',
        `translate(${round1(em.x)} ${round1(em.y)}) rotate(${round1(ang)}) scale(${round1(shrink)} ${round1(shrink * stretch)})`
      );
      em.g.setAttribute('opacity', op.toFixed(2));
    };

    for (let i = 0; i < EMBER_COUNT; i++) {
      const g = el('g');
      const r = rand(2.8, 4.6);
      // Halo suave verde esmeralda/lima para visibilidad en fondo claro y brillo en fondo oscuro
      g.appendChild(el('circle', { cx: '0', cy: '0', r: String(round1(r * 2.4)), fill: `url(#grad-ember-halo-${uid})`, opacity: '0.68' }));
      g.appendChild(el('circle', { class: 's3', cx: '0', cy: '0', r: String(round1(r * 1.15)), opacity: '0.85' }));
      g.appendChild(el('circle', { class: 's4', cx: '0', cy: '0', r: String(round1(r * 0.72)) }));
      parentGroup.appendChild(g);
      const em = { g, r };
      resetEmber(em, i / EMBER_COUNT);
      renderEmber(em);
      embers.push(em);
    }

    spawnFlamelet(model.tipCoords[0].x, model.tipCoords[0].y, model.dir, 0.20);
    flamelets.forEach(renderFlamelet);

    return {
      spawnFlamelet,
      step(dt, boost = 1) {
        const sDt = dt * boost;
        for (let i = 0; i < flamelets.length; i++) {
          const f = flamelets[i];
          if (!f.active) continue;
          f.age += sDt / f.dur;
          if (f.age >= 1) { f.active = false; f.g.setAttribute('opacity', '0'); continue; }
          // Curva convectiva ascendente con desaceleración por arrastre del aire
          const drag = 1 - f.age * 0.35;
          const eddy = Math.sin(f.age * 7.0 + f.phase) * 26;
          f.x += (f.vx * drag + eddy) * sDt;
          f.y -= f.vy * drag * sDt;
          renderFlamelet(f);
        }

        for (let i = 0; i < embers.length; i++) {
          const em = embers[i];
          em.age += sDt / em.dur;
          if (em.age >= 1) {
            resetEmber(em, 0);
          } else {
            // Turbulencia en remolino (curl swirl) + empuje térmico que frena suavemente
            const swirl = Math.cos(em.age * em.curlFreq + em.phase + em.y * 0.012) * em.curlAmp;
            const drag = 1 - em.age * 0.42;
            em.vx = em.baseVx * drag + swirl;
            em.vy = em.baseVy * (1.05 - em.age * 0.38);
            em.x += em.vx * sDt;
            em.y -= em.vy * sDt;
          }
          renderEmber(em);
        }
      }
    };
  }

  const activeAvatars = new Set();
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  let isTabHidden = document.hidden;
  let rafId = 0;
  let lastNow = 0;

  function stepAvatar(av, t, dt) {
    const {
      model, outerEl, outerStrokeEl, skipMask, strokeStartIdx, inkBreakSlots,
      midEl, coreEl, heartEl, rimHighlightsEl,
      faceMotionEl, mouthEl, pupils, faceBaseCenter,
      groundShadowEl, groundShadowCenter, groundGlowEl,
      glowEl, particles
    } = av;

    const stiffness = 68, damping = 11;
    const force = (av.targetEnergy - av.energy) * stiffness - av.energyVel * damping;
    av.energyVel += force * dt;
    av.energy = clamp(av.energy + av.energyVel * dt, 0.85, 1.45);
    const e = av.energy;

    const breathe = fireHarmonic(t * 1.85 + av.phaseSeed);
    const floatY = -Math.sin(t * 1.85 + av.phaseSeed) * 6.5;
    const stretchY = 1 + breathe * 0.025 * e;
    const squashX = 1 - breathe * 0.020 * e;

    const pinchQueue = [];
    evaluateFlameContour(model, t, {
      scaleRx: 1.0, scaleRy: 1.0, yOffset: 0, floatY, tongueMult: 1.0 * e,
      squashX, stretchY, timeLag: 0, curlMult: 1.0, tipBoost: 1.0, innerFlutter: false
    }, model.outerX, model.outerY, pinchQueue);

    const dOuter = ringToSmoothPathD(model.outerX, model.outerY, RING_N, model.outerParts, model.tBuf);
    outerEl.setAttribute('d', dOuter);

    const dStroke = ringToBrokenStrokeD(model.outerX, model.outerY, RING_N, model.strokeParts, model.tBuf, skipMask, strokeStartIdx, inkBreakSlots);
    outerStrokeEl.setAttribute('d', dStroke);

    evaluateFlameContour(model, t, {
      scaleRx: 0.94, scaleRy: 0.92, yOffset: 5, floatY, tongueMult: 0.74 * e,
      squashX, stretchY, timeLag: 0.06, curlMult: 0.84, tipBoost: 0.95, innerFlutter: true
    }, model.midX, model.midY, null);
    midEl.setAttribute('d', ringToSmoothPathD(model.midX, model.midY, RING_N, model.midParts, model.tBuf));

    evaluateFlameContour(model, t, {
      scaleRx: 0.85, scaleRy: 0.84, yOffset: 12, floatY, tongueMult: 0.50 * e,
      squashX, stretchY, timeLag: 0.11, curlMult: 0.65, tipBoost: 0.88, innerFlutter: true
    }, model.coreX, model.coreY, null);
    coreEl.setAttribute('d', ringToSmoothPathD(model.coreX, model.coreY, RING_N, model.coreParts, model.tBuf));

    evaluateFlameContour(model, t, {
      scaleRx: 0.58, scaleRy: 0.54, yOffset: 24, floatY, tongueMult: 0.18 * e,
      squashX, stretchY, timeLag: 0.15, curlMult: 0.25, tipBoost: 0.75, innerFlutter: false
    }, model.heartX, model.heartY, null);
    heartEl.setAttribute('d', ringToSmoothPathD(model.heartX, model.heartY, RING_N, model.heartParts, model.tBuf));

    if (particles && pinchQueue.length) {
      for (let i = 0; i < pinchQueue.length; i++) {
        particles.spawnFlamelet(pinchQueue[i].x, pinchQueue[i].y, pinchQueue[i].curlDir);
      }
    }

    const isDark = (av.themeMode || themeMode) === 'dark';
    const shimmer = 0.55 * Math.sin(2.1 * t + av.phaseSeed) + 0.30 * Math.sin(3.8 * t + av.phaseSeed * 1.4);
    if (glowEl) {
      const baseGlow = isDark ? 0.56 : 0.34;
      const glowOp = clamp(baseGlow + shimmer * 0.08 + (e - 1) * 0.20, 0.22, 0.78);
      const glowSc = 1 + shimmer * 0.035 + (e - 1) * 0.06;
      glowEl.setAttribute('opacity', glowOp.toFixed(2));
      glowEl.setAttribute('transform', `translate(512 ${round1(585 + floatY)}) scale(${glowSc.toFixed(3)}) translate(-512 -585)`);
    }
    if (groundGlowEl) groundGlowEl.setAttribute('opacity', clamp((isDark ? 0.42 : 0.28) + shimmer * 0.06, 0.18, 0.54).toFixed(2));

    if (rimHighlightsEl) {
      rimHighlightsEl.setAttribute(
        'transform',
        `translate(0 ${round1(floatY)}) translate(512 ${round1(model.cy)}) scale(${squashX.toFixed(3)} ${stretchY.toFixed(3)}) translate(-512 ${round1(-model.cy)})`
      );
      rimHighlightsEl.setAttribute('opacity', clamp(0.56 + shimmer * 0.10, 0.40, 0.70).toFixed(2));
    }

    if (groundShadowEl) {
      const heightFactor = 1 + floatY * 0.012;
      const gx = round1(groundShadowCenter.x);
      const gy = round1(groundShadowCenter.y);
      groundShadowEl.setAttribute(
        'transform',
        `translate(${round1(Math.sin(t * 1.2) * 2.5)} 0) translate(${gx} ${gy}) scale(${(squashX * heightFactor).toFixed(3)} ${((2 - stretchY) * heightFactor).toFixed(3)}) translate(${-gx} ${-gy})`
      );
      groundShadowEl.setAttribute('opacity', clamp(0.95 + floatY * 0.025, 0.72, 1.0).toFixed(2));
    }

    const lagBreathe = fireHarmonic((t - 0.12) * 1.85 + av.phaseSeed);
    const fWaveX = clamp(Math.sin(t * 1.45 + av.phaseSeed) * 3.4 * e + model.lean * 0.20, -12, 12);
    const fWaveY = floatY - lagBreathe * 3.8 * e;
    const fRot = clamp(model.lean * 0.10 + Math.sin(t * 1.45 + av.phaseSeed) * 0.6, -4.5, 4.5);
    const fx = round1(faceBaseCenter.x);
    const fy = round1(faceBaseCenter.y);

    faceMotionEl.setAttribute(
      'transform',
      `translate(${round1(fWaveX)} ${round1(fWaveY)}) translate(${fx} ${fy}) rotate(${round1(fRot)}) scale(${squashX.toFixed(3)} ${(1 + (stretchY - 1) * 0.45).toFixed(3)}) translate(${-fx} ${-fy})`
    );

    if (mouthEl) {
      const mScale = 1 + lagBreathe * 0.024 * e;
      mouthEl.setAttribute('transform', `translate(552 695) scale(${(2 - mScale).toFixed(3)} ${mScale.toFixed(3)}) translate(-552 -695)`);
    }

    if (pupils.length) {
      av.saccadeTimer -= dt;
      if (av.saccadeTimer <= 0) {
        av.saccadeTimer = rand(2.2, 4.2);
        const dir = rng();
        if (dir < 0.45) { av.gazeTargetX = 0; av.gazeTargetY = 0; }
        else if (dir < 0.72) { av.gazeTargetX = -5.5; av.gazeTargetY = rand(-1.5, 1.5); }
        else { av.gazeTargetX = 5.5; av.gazeTargetY = rand(-1.5, 1.5); }
      }
      const snap = Math.min(1, dt * 18);
      av.gazeX += (av.gazeTargetX - av.gazeX) * snap;
      av.gazeY += (av.gazeTargetY - av.gazeY) * snap;
      const gx = round1(av.gazeX), gy = round1(av.gazeY);
      for (let i = 0; i < pupils.length; i++) pupils[i].setAttribute('transform', `translate(${gx} ${gy})`);
    }

    if (particles) particles.step(dt, e);
  }

  function shouldRunLoop() {
    if (reducedMotion || isTabHidden) return false;
    for (const av of activeAvatars) {
      if (av.animate !== false && av.inView !== false) return true;
    }
    return false;
  }

  function tick(now) {
    if (!shouldRunLoop()) { rafId = 0; return; }
    const dt = lastNow ? Math.max(0, Math.min(0.05, (now - lastNow) / 1000)) : 0.016;
    lastNow = now;
    const t = now * 0.001;
    activeAvatars.forEach((av) => {
      if (av.animate === false || av.inView === false) return;
      stepAvatar(av, t, dt);
    });
    rafId = requestAnimationFrame(tick);
  }

  function syncLoop() {
    if (shouldRunLoop()) {
      if (!rafId) { lastNow = performance.now(); rafId = requestAnimationFrame(tick); }
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  document.addEventListener('visibilitychange', () => { isTabHidden = document.hidden; syncLoop(); });

  const onMotionChange = e => { reducedMotion = e.matches; syncLoop(); };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
  else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);

  function buildFixedInkBreaks(model, flameBody) {
    const skipMask = new Uint8Array(RING_N);
    const chinSide = rng() < 0.5 ? 9 : 99;
    const cheekSide = chinSide < 50 ? 86 : 22;

    const rawSlots = [
      { idx: chinSide + Math.floor(rand(0, 3)), span: 5, dotIndices: [chinSide + 2, chinSide + 3], r: 6.0 },
      { idx: cheekSide + Math.floor(rand(0, 3)), span: 4, dotIndices: [cheekSide + 2], r: 6.5 }
    ];

    for (let cand = 32; cand <= 44; cand++) {
      const phi = RING_ANGLES[cand];
      const nearTip = model.tongues.some(tg => Math.abs(phi - tg.phi) < 0.25);
      if (!nearTip) {
        rawSlots.push({ idx: cand, span: 4, dotIndices: [cand + 2], r: 6.2 });
        break;
      }
    }

    const inkBreakSlots = rawSlots.map(s => {
      for (let k = 0; k < s.span; k++) skipMask[(s.idx + k) % RING_N] = 1;
      const dots = s.dotIndices.map(() => {
        const dotEl = el('circle', { class: 'ink-dot', cx: '0', cy: '0', r: String(s.r) });
        flameBody.appendChild(dotEl);
        return dotEl;
      });
      return { idx: s.idx, dotIndices: s.dotIndices, dots };
    });

    let strokeStartIdx = 0;
    for (let i = 0; i < RING_N; i++) {
      if (!skipMask[i] && skipMask[(i - 1 + RING_N) % RING_N]) { strokeStartIdx = i; break; }
    }
    return { skipMask, strokeStartIdx, inkBreakSlots };
  }

  function makeAvatar(i, opts = {}) {
    const uid = ++uidCounter;
    const svg = el('svg', {
      version: '1.2',
      viewBox: '0 0 1024 1024',
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      class: 'flame-avatar-svg'
    });

    const palette = opts.palette || pick(PALETTES);
    const flameStyle = opts.flameStyle || pick(FLAME_STYLES);
    const detailStyle = opts.detailStyle || pick(DETAIL_STYLES);
    const { eyeStyle, mouthStyle } = pickHarmoniousFace(opts.eyeStyle, opts.mouthStyle);

    const isLivelyMood = eyeStyle === 'calcifer_angry_up' || eyeStyle === 'calcifer_fierce_white' || eyeStyle === 'calcifer_wide_ring' || eyeStyle === 'calcifer_star';
    const moodTempo = isLivelyMood ? 1.10 : 1.0;

    const model = buildFlameModel(flameStyle, moodTempo);

    svg.setAttribute('aria-label', `Avatar llamita ${palette.name}, ${STYLE_LABELS[flameStyle] || ''}, expresión ${EYE_LABELS[eyeStyle] || 'Lima'}`);

    svg.style.setProperty('--c-ink', palette.outline);
    svg.style.setProperty('--c-face', palette.faceInk);
    svg.style.setProperty('--c-mid', palette.orange);
    svg.style.setProperty('--c-inner', palette.red);
    svg.style.setProperty('--c-core', palette.yellow);
    svg.style.setProperty('--c-bright', palette.bright);
    svg.style.setProperty('--c-mouth-deep', palette.mouthDeep);
    svg.style.setProperty('--c-tongue', palette.tongue);
    svg.style.setProperty('--c-blush', palette.blush);

    const defs = el('defs');
    const bg = THEME_BGS[themeMode];

    const grad = el('radialGradient', { id: `flame-glow-${uid}`, cx: '50%', cy: '56%', r: '50%' });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': palette.glow, 'stop-opacity': '0.84' }));
    grad.appendChild(el('stop', { offset: '56%', 'stop-color': palette.outerBase, 'stop-opacity': '0.24' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': palette.outerTip, 'stop-opacity': '0' }));
    defs.appendChild(grad);

    const bgGrad = el('linearGradient', { id: `avatar-bg-${uid}`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
    const bgStop1 = el('stop', { offset: '0%', 'stop-color': bg.bg1 });
    const bgStop2 = el('stop', { offset: '100%', 'stop-color': bg.bg2 });
    bgGrad.append(bgStop1, bgStop2);
    defs.appendChild(bgGrad);

    const bgGlow = el('radialGradient', { id: `bg-glow-${uid}`, cx: '50%', cy: '56%', r: '50%' });
    const bgGlowStop1 = el('stop', { offset: '0%', 'stop-color': palette.glow, 'stop-opacity': themeMode === 'dark' ? '0.32' : '0.24' });
    bgGlow.appendChild(bgGlowStop1);
    bgGlow.appendChild(el('stop', { offset: '62%', 'stop-color': palette.outerBase, 'stop-opacity': '0.08' }));
    bgGlow.appendChild(el('stop', { offset: '100%', 'stop-color': palette.outerBase, 'stop-opacity': '0' }));
    defs.appendChild(bgGlow);

    const groundGrad = el('radialGradient', { id: `ground-glow-${uid}`, cx: '50%', cy: '50%', r: '50%' });
    groundGrad.appendChild(el('stop', { offset: '0%', 'stop-color': palette.glow, 'stop-opacity': '0.68' }));
    groundGrad.appendChild(el('stop', { offset: '58%', 'stop-color': palette.outerBase, 'stop-opacity': '0.20' }));
    groundGrad.appendChild(el('stop', { offset: '100%', 'stop-color': palette.outerBase, 'stop-opacity': '0' }));
    defs.appendChild(groundGrad);

    const outerGrad = el('linearGradient', { id: `grad-outer-${uid}`, x1: '0%', y1: '100%', x2: '0%', y2: '0%' });
    outerGrad.appendChild(el('stop', { offset: '0%', 'stop-color': palette.outerBase }));
    outerGrad.appendChild(el('stop', { offset: '55%', 'stop-color': palette.red }));
    outerGrad.appendChild(el('stop', { offset: '100%', 'stop-color': palette.outerTip }));
    defs.appendChild(outerGrad);

    const midGrad = el('linearGradient', { id: `grad-mid-${uid}`, x1: '0%', y1: '100%', x2: '0%', y2: '0%' });
    midGrad.appendChild(el('stop', { offset: '0%', 'stop-color': palette.midBase }));
    midGrad.appendChild(el('stop', { offset: '78%', 'stop-color': palette.midTip }));
    midGrad.appendChild(el('stop', { offset: '100%', 'stop-color': palette.midTip, 'stop-opacity': '0.35' }));
    defs.appendChild(midGrad);

    const coreGrad = el('linearGradient', { id: `grad-core-${uid}`, x1: '0%', y1: '100%', x2: '0%', y2: '0%' });
    coreGrad.appendChild(el('stop', { offset: '0%', 'stop-color': palette.coreBase }));
    coreGrad.appendChild(el('stop', { offset: '75%', 'stop-color': palette.coreTip }));
    coreGrad.appendChild(el('stop', { offset: '100%', 'stop-color': palette.coreTip, 'stop-opacity': '0.55' }));
    defs.appendChild(coreGrad);

    const heartGrad = el('radialGradient', { id: `grad-heart-${uid}`, cx: '50%', cy: '58%', r: '55%' });
    heartGrad.appendChild(el('stop', { offset: '0%', 'stop-color': palette.bright, 'stop-opacity': '0.78' }));
    heartGrad.appendChild(el('stop', { offset: '66%', 'stop-color': palette.coreBase, 'stop-opacity': '0.24' }));
    heartGrad.appendChild(el('stop', { offset: '100%', 'stop-color': palette.coreTip, 'stop-opacity': '0' }));
    defs.appendChild(heartGrad);

    const flameletGrad = el('linearGradient', { id: `grad-flamelet-${uid}`, x1: '0%', y1: '100%', x2: '0%', y2: '0%' });
    flameletGrad.appendChild(el('stop', { offset: '0%', 'stop-color': palette.midBase }));
    flameletGrad.appendChild(el('stop', { offset: '55%', 'stop-color': palette.red }));
    flameletGrad.appendChild(el('stop', { offset: '100%', 'stop-color': palette.outerTip }));
    defs.appendChild(flameletGrad);

    const emberHaloGrad = el('radialGradient', { id: `grad-ember-halo-${uid}`, cx: '50%', cy: '50%', r: '50%' });
    emberHaloGrad.appendChild(el('stop', { offset: '0%', 'stop-color': palette.glow, 'stop-opacity': '0.90' }));
    emberHaloGrad.appendChild(el('stop', { offset: '50%', 'stop-color': palette.midBase, 'stop-opacity': '0.45' }));
    emberHaloGrad.appendChild(el('stop', { offset: '100%', 'stop-color': palette.outerTip, 'stop-opacity': '0' }));
    defs.appendChild(emberHaloGrad);

    svg.appendChild(defs);

    // Host CSS provides the plate; skip full-bleed mock backgrounds in dense UI.
    const contentLayer = el('g', { class: 'avatar-content' });
    svg.appendChild(contentLayer);

    const glowEl = el('circle', { class: 'flame-glow', cx: '512', cy: '585', r: '345', fill: `url(#flame-glow-${uid})` });
    contentLayer.appendChild(glowEl);

    const groundShadowCenter = { x: 512, y: model.cy + model.ry * 0.94 + 10 };
    const groundShadowEl = el('g', { class: 'flame-ground-shadow' });
    const groundGlowEl = el('ellipse', {
      class: 'flame-ground-glow', cx: '512', cy: String(round1(groundShadowCenter.y + 4)),
      rx: String(round1(model.rx * 1.12)), ry: '34', fill: `url(#ground-glow-${uid})`, opacity: '0.28'
    });
    groundShadowEl.appendChild(groundGlowEl);
    groundShadowEl.appendChild(el('ellipse', {
      class: 's1', cx: '512', cy: String(round1(groundShadowCenter.y + 4)),
      rx: String(round1(model.rx * 0.68)), ry: '13', opacity: '0.09'
    }));
    contentLayer.appendChild(groundShadowEl);

    const flameBody = el('g', { class: 'flame-body' });
    const outerEl = el('path', {
      class: 'f-outer',
      fill: `url(#grad-outer-${uid})`,
      stroke: `url(#grad-outer-${uid})`,
      'stroke-width': '16.5',
      'stroke-linejoin': 'round'
    });
    const midEl = el('path', { class: 'f-mid', fill: `url(#grad-mid-${uid})`, opacity: '0.90' });
    const coreEl = el('path', { class: 'f-core', fill: `url(#grad-core-${uid})` });
    const heartEl = el('path', { class: 'f-heart', fill: `url(#grad-heart-${uid})` });

    let rimHighlightsEl = null;
    if (detailStyle === 'highlights') {
      rimHighlightsEl = el('g', { class: 'rim-highlights', opacity: '0.58' });
      const hSide = model.dir;
      const hx1 = round1(512 + hSide * model.rx * 0.80);
      const hy1 = round1(model.cy - 6);
      const hx2 = round1(512 + hSide * model.rx * 0.77);
      const hy2 = round1(model.cy + 34);
      rimHighlightsEl.appendChild(el('ellipse', {
        class: 's5', cx: String(hx1), cy: String(hy1), rx: '10', ry: '19',
        transform: `rotate(${hSide * 14} ${hx1} ${hy1})`
      }));
      rimHighlightsEl.appendChild(el('ellipse', {
        class: 's5', cx: String(hx2), cy: String(hy2), rx: '8.5', ry: '15',
        transform: `rotate(${hSide * 18} ${hx2} ${hy2})`
      }));
    }

    const outerStrokeEl = el('path', {
      class: 'f-outer-ink',
      fill: 'none',
      stroke: palette.outline,
      'stroke-width': '18.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    });

    flameBody.append(outerEl, midEl, coreEl, heartEl);
    if (rimHighlightsEl) flameBody.appendChild(rimHighlightsEl);
    flameBody.appendChild(outerStrokeEl);
    const { skipMask, strokeStartIdx, inkBreakSlots } = buildFixedInkBreaks(model, flameBody);

    const faceBaseCenter = { x: 512, y: model.cy + 20 };
    const faceScale = round1(clamp((model.rx * 0.73) / 250, 0.68, 0.78));

    const faceMotionEl = el('g', { class: 'flame-face-motion' });
    const facePoseEl = el('g', {
      class: 'flame-face',
      transform: `translate(${round1(faceBaseCenter.x)} ${round1(faceBaseCenter.y)}) scale(${faceScale}) translate(-552 -640)`
    });

    const { leftGroup, rightGroup, pupils } = buildEyePair(eyeStyle);
    const mouthEl = buildMouth(mouthStyle);
    facePoseEl.append(leftGroup, rightGroup);

    if (detailStyle === 'blush_dots') {
      facePoseEl.appendChild(el('ellipse', { class: 'cheek-blush', cx: '378', cy: '656', rx: '24', ry: '11' }));
      facePoseEl.appendChild(el('ellipse', { class: 'cheek-blush', cx: '726', cy: '654', rx: '24', ry: '11' }));
    }

    facePoseEl.appendChild(mouthEl);
    faceMotionEl.appendChild(facePoseEl);
    flameBody.appendChild(faceMotionEl);
    contentLayer.appendChild(flameBody);

    const frontParticles = el('g', { class: 'particles-layer' });
    contentLayer.appendChild(frontParticles);

    const avatarCtrl = {
      uid, svg, palette, eyeStyle, mouthStyle, flameStyle, detailStyle, model,
      bgStop1, bgStop2, bgGlowStop1,
      outerEl, outerStrokeEl, skipMask, strokeStartIdx, inkBreakSlots,
      midEl, coreEl, heartEl, rimHighlightsEl,
      faceMotionEl, mouthEl, pupils, faceBaseCenter,
      groundShadowEl, groundShadowCenter, groundGlowEl, glowEl,
      phaseSeed: rand(0, Math.PI * 2),
      saccadeTimer: rand(1.0, 3.4), gazeX: 0, gazeY: 0, gazeTargetX: 0, gazeTargetY: 0,
      energy: 1, energyVel: 0, targetEnergy: 1, particles: null
    };

    evaluateFlameContour(model, performance.now() * 0.001, {
      scaleRx: 1.0, scaleRy: 1.0, yOffset: 0, floatY: 0, tongueMult: 1.0,
      squashX: 1, stretchY: 1, timeLag: 0, curlMult: 1.0, tipBoost: 1.0, innerFlutter: false
    }, model.outerX, model.outerY, []);

    const enableParticles = opts.enableParticles !== false;
    avatarCtrl.particles = enableParticles
      ? createRealFireEmbers(frontParticles, model, moodTempo, uid)
      : null;
    if (!enableParticles) frontParticles.remove();

    avatarCtrl.themeMode = themeMode;
    avatarCtrl.animate = opts.animate !== false;
    avatarCtrl.inView = true;

    if (avatarCtrl.animate) {
      svg.style.setProperty('--blink-speed', `${rand(6.2, 8.6).toFixed(2)}s`);
      svg.style.setProperty('--blink-delay', `${rand(-8.0, 0).toFixed(2)}s`);
    } else {
      svg.querySelectorAll('.eye-open').forEach((n) => {
        (n as SVGElement).style.animation = 'none';
      });
    }

    stepAvatar(avatarCtrl, performance.now() * 0.001, 0.016);
    if (avatarCtrl.animate) {
      activeAvatars.add(avatarCtrl);
      syncLoop();
    }

    return avatarCtrl;
  }

  

export interface FlameAvatarHandle {
  svg: SVGSVGElement;
  seed: string;
  setTheme: (mode: FlameThemeMode) => void;
  destroy: () => void;
}

function makeAvatarFromParts(
  parts: AvatarSeedParts,
  label?: string,
  mountOpts?: { theme?: FlameThemeMode; size?: number; animated?: boolean }
): any {
  setRngSeed(parts.entropy);
  // Avatars always render on the light cream plate (app chrome may be dark).
  const resolvedTheme: FlameThemeMode = mountOpts?.theme ?? 'light';
  themeMode = resolvedTheme;
  const palette = PALETTES[parts.paletteIndex % PALETTES.length];
  const flameStyle = FLAME_STYLES[parts.flameIndex % FLAME_STYLES.length];
  const eyeStyle = EYE_STYLES[parts.eyeIndex % EYE_STYLES.length];
  const mouthStyle = MOUTH_STYLES[parts.mouthIndex % MOUTH_STYLES.length];
  const detailStyle = DETAIL_STYLES[parts.detailIndex % DETAIL_STYLES.length];
  const size = mountOpts?.size ?? 40;
  const ctrl = makeAvatar(0, {
    palette,
    flameStyle,
    eyeStyle,
    mouthStyle,
    detailStyle,
    enableParticles: size >= 36,
    animate: mountOpts?.animated !== false,
  });
  ctrl.themeMode = resolvedTheme;
  if (label) {
    ctrl.svg.setAttribute('aria-label', label);
  }
  return ctrl;
}

export function mountFlameAvatar(
  host: HTMLElement,
  seed: string,
  opts?: { label?: string; theme?: FlameThemeMode; size?: number; animated?: boolean }
): FlameAvatarHandle | null {
  const parts = decodeAvatarSeed(seed);
  if (!parts) return null;
  const ctrl = makeAvatarFromParts(parts, opts?.label, opts);
  host.replaceChildren(ctrl.svg);
  ctrl.svg.style.width = '100%';
  ctrl.svg.style.height = '100%';
  ctrl.svg.style.display = 'block';
  // Decorative SVG — host carries the accessible name when present.
  ctrl.svg.setAttribute('aria-hidden', 'true');
  ctrl.svg.removeAttribute('role');

  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== 'undefined' && ctrl.animate) {
    io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        ctrl.inView = Boolean(entry?.isIntersecting);
        syncLoop();
      },
      { threshold: 0.05, rootMargin: '32px' }
    );
    io.observe(host);
  }

  const handle: FlameAvatarHandle = {
    svg: ctrl.svg,
    seed,
    setTheme(_mode) {
      // Keep the light plate even if a caller requests dark.
      const mode: FlameThemeMode = 'light';
      ctrl.themeMode = mode;
      const bg = THEME_BGS[mode];
      if (ctrl.bgStop1) ctrl.bgStop1.setAttribute('stop-color', bg.bg1);
      if (ctrl.bgStop2) ctrl.bgStop2.setAttribute('stop-color', bg.bg2);
      if (ctrl.bgGlowStop1) {
        ctrl.bgGlowStop1.setAttribute('stop-opacity', '0.24');
      }
    },
    destroy() {
      io?.disconnect();
      activeAvatars.delete(ctrl);
      syncLoop();
      if (ctrl.svg.parentElement === host) host.replaceChildren();
    },
  };
  return handle;
}

export { setRngSeed, decodeAvatarSeed };
