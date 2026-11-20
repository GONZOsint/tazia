import { FIRE_MATH_GLSL } from '../fireButton/mathGlsl';

export const QR_FIRE_VS = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

/**
 * Living fire line outside the QR card frame —
 * outward-normal plumes with FireBurnButton DNA (curl + dual Voronoi + wisps).
 * Interior of the rounded rect is hard-cleared.
 */
export const QR_FIRE_FS = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uIntensity;
  uniform float uSweep;
  uniform vec2 uRectMin;
  uniform vec2 uRectMax;
  uniform float uRadius;
  uniform vec3 uColor;

  ${FIRE_MATH_GLSL}

  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    float inst = clamp(uIntensity, 0.0, 1.05);
    if (inst <= 0.001) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec2 uv = vUv;
    vec2 center = 0.5 * (uRectMin + uRectMax);
    vec2 halfSize = 0.5 * (uRectMax - uRectMin);
    vec2 p = uv - center;

    float dist = sdRoundRect(p, halfSize, uRadius);
    if (dist < -0.001) {
      gl_FragColor = vec4(0.0);
      return;
    }
    float outside = max(dist, 0.0);

    float ang = atan(p.x, -p.y);
    float peri = max(halfSize.x + halfSize.y, 0.001);
    float arcU = ang * peri;

    // Tongue height varies along the rim (living crown, not a uniform halo).
    float hNoise = snoiseGrad(vec2(arcU * 3.4 - uTime * 0.22, 1.7)).x;
    float hNoise2 = snoiseGrad(vec2(arcU * 1.55 + uTime * 0.11, 4.2)).x;
    float heightVar = 0.72 + 0.28 * hNoise + 0.12 * hNoise2;

    float lineW = mix(0.011, 0.022, smoothstep(0.0, 1.0, inst));
    float reach = lineW * mix(2.6, 4.4, heightVar) * (0.55 + 0.45 * smoothstep(0.0, 1.0, inst));
    if (outside > reach * 1.15) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float yLocal = clamp(outside / max(reach, 0.001), 0.0, 1.0);
    float yBuoy = yLocal - 0.18 * yLocal * yLocal;

    // Subtle curl advection (FireBurnButton scale) — keeps tongues sharp.
    vec2 curlA = curlFluid(
      vec2(arcU * 2.55, yLocal * 1.18 - uTime * 0.72),
      yLocal,
      0.45
    );
    float windA = 0.04 * sin(uTime * 0.55 + arcU * 1.8);
    float advX = (curlA.x * 0.020 - windA * pow(yLocal, 1.2)) * 0.85;
    float advY = curlA.y * 0.014;
    vec2 pA = vec2(arcU * 2.35 + advX, yBuoy + advY);

    float v1 = voronoi(vec2(pA.x * 2.20, pA.y * 0.54 - uTime * 0.68), uTime * 0.44);
    float v2 = voronoi(vec2(pA.x * 4.25 + 3.1, pA.y * 1.00 - uTime * 1.05), uTime * 0.72);
    float ridgeA = 0.62 * v1 + 0.38 * v2;
    float erodeA = smoothstep(0.0, 0.22, yLocal);
    float fieldA = 0.80 - 1.18 * (yLocal / max(heightVar, 0.001))
                 + erodeA * (ridgeA - 0.45) * 1.48;

    // Back layer — slower / offset for depth.
    vec2 curlB = curlFluid(
      vec2(arcU * 2.35 + 3.4, yLocal * 1.08 - uTime * 0.58),
      yLocal,
      0.45
    );
    float advBX = (curlB.x * 0.017 - windA * 0.7 * pow(yLocal, 1.2)) * 0.8;
    float advBY = curlB.y * 0.012;
    vec2 pB = vec2(arcU * 2.15 + advBX, yBuoy + advBY);

    float vb1 = voronoi(vec2(pB.x * 2.05 + 4.7, pB.y * 0.52 - uTime * 0.56 + 2.1), uTime * 0.38 + 1.5);
    float vb2 = voronoi(vec2(pB.x * 3.85 + 8.3, pB.y * 0.94 - uTime * 0.90), uTime * 0.64);
    float ridgeB = 0.64 * vb1 + 0.36 * vb2;
    float erodeB = smoothstep(0.0, 0.22, yLocal);
    float fieldB = 0.76 - 1.10 * (yLocal / max(heightVar * 0.96, 0.001))
                 + erodeB * (ridgeB - 0.45) * 1.38;

    float tongue = pow(max(1.0 - ridgeA, 0.0), 1.2);
    float coreW = lineW * (0.42 + 0.38 * tongue);
    float tongueW = lineW * (1.15 + 1.55 * tongue * heightVar);

    // Rim shape: bright core at the frame, tapering plume outward.
    float shapeCore = 1.0 - smoothstep(0.0, coreW, outside);
    float shapePlume = 1.0 - smoothstep(coreW * 0.35, tongueW, outside);
    float plumeLift = (0.35 + 0.65 * tongue) * (1.0 - smoothstep(0.55, 1.0, yLocal));
    float shape = max(shapeCore, shapePlume * plumeLift);

    // Tight thresholds → distinct tongues (match FireBurnButton).
    float mainAlpha = smoothstep(0.172, 0.208, fieldA) * shape;
    float backAlpha = smoothstep(0.168, 0.205, fieldB) * shape * 0.74;
    float heatGlow = smoothstep(0.02, 0.175, fieldA) * (1.0 - mainAlpha) * shape * 0.14;

    // Soft ember band hugging the frame (extra presence without wash).
    float emberPulse = 0.55 + 0.45 * sin(uTime * 3.4 + arcU * 9.0);
    float ember = (1.0 - smoothstep(0.0, lineW * 0.85, outside))
                * (0.10 + 0.10 * emberPulse)
                * (0.55 + 0.45 * ridgeA)
                * smoothstep(0.0, 0.55, inst);

    float arc = abs(ang / 6.28318530718);
    float sweepMask = smoothstep(uSweep + 0.08, uSweep - 0.02, arc);
    sweepMask = mix(sweepMask, 1.0, smoothstep(0.75, 0.98, inst));
    float alphaFade = smoothstep(0.0, 0.52, inst) * sweepMask;

    mainAlpha *= alphaFade;
    backAlpha *= alphaFade;
    heatGlow *= alphaFade;
    ember *= sweepMask;

    // Palette: lime core → hot tip (amber) with rim highlight.
    vec3 subColor  = uColor * vec3(0.75, 0.79, 0.58);
    vec3 rimColor  = uColor * vec3(0.81, 0.85, 0.64);
    vec3 coreColor = mix(uColor, vec3(0.97, 1.0, 0.86), 0.58);
    vec3 tipColor  = mix(uColor, vec3(1.0, 0.72, 0.22), 0.42);

    float tipMix = smoothstep(0.18, 0.88, yLocal) * tongue;
    float coreBand = smoothstep(0.42, 0.48, fieldA)
                   * smoothstep(0.04, 0.18, yLocal)
                   * (1.0 - smoothstep(0.32, 0.55, yLocal));
    float rimBand = (smoothstep(0.172, 0.208, fieldA) - smoothstep(0.210, 0.245, fieldA))
                  * smoothstep(0.06, 0.22, yLocal);

    vec3 mainColor = mix(uColor, coreColor, coreBand * 0.85);
    mainColor = mix(mainColor, tipColor, tipMix * 0.82);
    mainColor = mix(mainColor, rimColor, rimBand * 0.55);

    // Wisps / embers rising along the outward normal from hot spots.
    vec3 wispPremul = vec3(0.0);
    float wispAlpha = 0.0;
    float wInst = clamp(inst * 0.92, 0.0, 1.0);
    for (int k = 0; k < 7; k++) {
      float seed = float(k) * 2.17 + 0.7;
      float dur = 1.65 + hash1(seed) * 1.25;
      float phaseOff = hash1(seed + 7.1);
      float tCycle = uTime / dur + phaseOff;
      float cycleId = floor(tCycle);
      float rawLife = fract(tCycle);

      float active = 0.50 + 0.22 * hash1(seed + 2.3 + cycleId * 1.7);
      if (rawLife > active) continue;
      float life = rawLife / active;

      float a0 = hash1(seed + 13.3 + cycleId * 3.1) - 0.5;
      float angS = a0 * 6.28318530718;
      vec2 nS = vec2(sin(angS), -cos(angS));
      vec2 tS = vec2(-nS.y, nS.x);

      float rise = pow(life, 0.78);
      float baseR = length(halfSize) * 0.92 + lineW * 0.2;
      float tipBoost = 0.018 + 0.034 * hash1(seed + cycleId * 5.7);
      vec2 sp = center + nS * (baseR + rise * (tipBoost + 0.022));
      sp += tS * sin(life * (3.6 + 3.2 * hash1(seed + 4.4)) + seed) * 0.010;

      vec2 d = (uv - sp) * vec2(uAspect, 1.0);
      // Stretch along outward normal so wisps read as rising sparks.
      float nx = dot(d, nS);
      float tx = dot(d, tS);
      float stretch = 1.25 + 1.05 * hash1(seed + cycleId * 3.9);
      float rw = mix(0.007, 0.013, hash1(seed + 5.0)) * (1.0 - 0.58 * life);
      float rh = rw * stretch;
      float r = length(vec2(tx / max(rw, 0.001), nx / max(rh, 0.001)));
      float fade = smoothstep(0.0, 0.10, life) * (1.0 - smoothstep(0.38, 1.0, life));
      float wa = (1.0 - smoothstep(0.72, 0.96, r)) * fade * wInst * 0.88 * sweepMask;
      vec3 wc = mix(coreColor, tipColor, life * 0.85);
      wc = mix(wc, subColor, smoothstep(0.5, 0.9, life) * 0.4);
      wispPremul = wc * wa + wispPremul * (1.0 - wa);
      wispAlpha = wa + wispAlpha * (1.0 - wa);
    }

    vec3 premul = uColor * (heatGlow + ember);
    float alpha = heatGlow + ember;
    premul = subColor * backAlpha + premul * (1.0 - backAlpha);
    alpha = backAlpha + alpha * (1.0 - backAlpha);
    premul = wispPremul + premul * (1.0 - wispAlpha);
    alpha = wispAlpha + alpha * (1.0 - wispAlpha);
    premul = mainColor * mainAlpha + premul * (1.0 - mainAlpha);
    alpha = mainAlpha + alpha * (1.0 - mainAlpha);

    gl_FragColor = vec4(premul, alpha);
  }
`;
