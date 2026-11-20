import { FIRE_MATH_GLSL } from '../fireButton/mathGlsl';

export const IGNITE_BURN_VS = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

/** Full-screen intro burn — pill SDF + curl fluid (mockup 7). */
export const IGNITE_BURN_FS = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uBurnProgress;
  uniform float uFront;
  uniform vec2 uOrigin;
  uniform vec2 uBtnHalf;
  uniform float uBtnRadius;
  uniform vec3 uColor;

  ${FIRE_MATH_GLSL}

  float pillDist(vec2 uv) {
    float dx = (uv.x - uOrigin.x) * uAspect;
    float dy = uv.y - uOrigin.y;
    float dyWeighted = dy > 0.0 ? dy * 0.62 : dy * 1.24;
    vec2 q = abs(vec2(dx, dyWeighted)) - (uBtnHalf - uBtnRadius);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uBtnRadius;
  }

  void main() {
    vec3 blackColor = vec3(0.022, 0.025, 0.018);

    if (uBurnProgress <= 0.001) {
      gl_FragColor = vec4(blackColor, 1.0);
      return;
    }

    vec2 uv = vUv;
    float dist = pillDist(uv);
    float dy = uv.y - uOrigin.y;

    float yBuoy = uv.y - 0.14 * uv.y * uv.y;
    vec2 curlV = curlFluid(
      vec2(uv.x * uAspect * 1.5, yBuoy * 1.6 - uTime * 0.72),
      max(0.0, dist + 0.08),
      0.22
    );
    vec2 p = vec2((uv.x + curlV.x * 0.017) * uAspect, yBuoy + curlV.y * 0.013);

    float v1 = voronoi(vec2(p.x * 3.6, p.y * 1.4 - uTime * 0.90), uTime * 0.45);
    float v2 = voronoi(vec2(p.x * 7.4 + 3.1, p.y * 2.8 - uTime * 1.35), uTime * 0.75);
    float ridge = 0.64 * v1 + 0.36 * v2;

    float upBias = smoothstep(-0.08, 0.25, dy);
    float tongueAmp = (0.10 + 0.15 * upBias) * smoothstep(0.0, 0.16, uBurnProgress);
    float blackField = dist - (1.0 - ridge) * tongueAmp * 0.72;

    float widthGrow = smoothstep(0.0, 0.22, uBurnProgress);
    float fireWidth = (0.065 + 0.085 * upBias + (1.0 - v1) * 0.048 * upBias) * widthGrow;
    float fireFadeIn = smoothstep(0.0, 0.10, uBurnProgress);

    float blackMask  = smoothstep(uFront - 0.005, uFront + 0.005, blackField);
    float outerFlame = 1.0 - smoothstep(uFront - 0.004, uFront + 0.004, blackField);
    float innerHole  = smoothstep(uFront - fireWidth - 0.005, uFront - fireWidth + 0.005, blackField);
    float flameMask  = outerFlame * innerHole * fireFadeIn;

    float glowBand = smoothstep(uFront - fireWidth - 0.13, uFront - fireWidth, blackField) * (1.0 - innerHole);
    float glowAlpha = glowBand * 0.12 * fireFadeIn;

    vec3 subColor  = uColor * vec3(0.75, 0.79, 0.58);
    vec3 charColor = uColor * vec3(0.55, 0.60, 0.36);
    vec3 coreColor = mix(uColor, vec3(0.97, 1.0, 0.85), 0.58);

    float fwSafe = max(fireWidth, 0.001);
    float coreBand = smoothstep(uFront - fwSafe * 0.74, uFront - fwSafe * 0.66, blackField)
                   * (1.0 - smoothstep(uFront - fwSafe * 0.24, uFront - fwSafe * 0.18, blackField));
    float outerRim = smoothstep(uFront - 0.016, uFront - 0.005, blackField);

    vec3 flameColor = mix(uColor, coreColor, coreBand);
    flameColor = mix(flameColor, charColor, outerRim * 0.82);

    float sparkAlpha = 0.0;
    vec3 sparkPremul = vec3(0.0);
    float sparkEndFade = 1.0 - smoothstep(0.84, 1.0, uBurnProgress);

    for (int k = 0; k < 16; k++) {
      float seed = float(k) * 2.37 + 0.9;
      float sx0 = 0.07 + 0.86 * hash1(seed);
      float sy0 = 0.16 + 0.62 * hash1(seed + 4.2);

      float birthFront = max(0.0, pillDist(vec2(sx0, sy0)));
      float pLife = clamp((uFront - birthFront) / 0.28, 0.0, 1.0);
      if (pLife <= 0.001 || pLife >= 0.999) continue;

      float drift = (hash1(seed + 8.1) - 0.5) * 0.08;
      float sx = sx0 + drift * pLife + sin(pLife * 5.2 + seed) * 0.022;
      float sy = sy0 + (0.14 + 0.16 * hash1(seed + 11.4)) * pow(pLife, 0.82);

      vec2 d = vec2((uv.x - sx) * uAspect, uv.y - sy);
      d.x -= d.y * (drift * 2.0 + cos(pLife * 5.2 + seed) * 0.26);

      float sz = (0.010 + 0.008 * hash1(seed + 15.2)) * (1.0 - 0.64 * pLife);
      float stretch = 1.2 + 0.9 * hash1(seed + 19.7);
      float taper = d.y > 0.0 ? (1.0 - 0.62 * clamp(d.y / (sz * stretch), 0.0, 1.0)) : 1.0;

      float r = length(vec2(d.x / max(sz * max(taper, 0.28), 0.001), d.y / max(sz * stretch, 0.001)));
      float fade = smoothstep(0.0, 0.14, pLife) * (1.0 - smoothstep(0.45, 1.0, pLife));
      float sa = (1.0 - smoothstep(0.74, 0.96, r)) * fade * 0.92 * sparkEndFade;

      sa *= (1.0 - blackMask) * (1.0 - flameMask);

      vec3 sc = mix(uColor, subColor, pLife * 0.65);
      sparkPremul = sc * sa + sparkPremul * (1.0 - sa);
      sparkAlpha = sa + sparkAlpha * (1.0 - sa);
    }

    vec3 premul = uColor * glowAlpha;
    float alpha = glowAlpha;

    premul = blackColor * blackMask + premul * (1.0 - blackMask);
    alpha = blackMask + alpha * (1.0 - blackMask);

    premul = flameColor * flameMask + premul * (1.0 - flameMask);
    alpha = flameMask + alpha * (1.0 - flameMask);

    premul = sparkPremul + premul * (1.0 - sparkAlpha);
    alpha = sparkAlpha + alpha * (1.0 - sparkAlpha);

    gl_FragColor = vec4(premul, alpha);
  }
`;
