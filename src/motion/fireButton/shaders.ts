import { FIRE_MATH_GLSL } from './mathGlsl';

/** Vertex + fragment shaders for the fire button crown (WebGL). */

export const FIRE_BTN_VS = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

export const FIRE_BTN_FS = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uIntensity;
  uniform float uWispIntensity;
  uniform float uIgniteTime;
  uniform float uExtinguishTime;
  uniform float uMouseX;
  uniform float uHover;
  uniform float uWind;
  uniform float uUpDraft;
  uniform float uPress;
  uniform float uClickX;
  uniform float uArch;
  uniform float uFreqX;
  uniform float uSwayScale;
  uniform float uMaxWisps;
  uniform float uEdgeInset;
  uniform vec3 uColor;

  ${FIRE_MATH_GLSL}

  float getBaseY(float ux) {
    // Circular plate: base rides the top semicircle.
    // Canvas tucks to button center (mask punches the face) — peak ≈ R/H.
    float cx = (ux - 0.5) * 2.0;
    float circArc = sqrt(max(0.0, 1.0 - cx * cx));
    // Canvas bottom = button center; peak ≈ R/H (~0.30) so roots sit on the rim.
    float roundLift = max(0.0, circArc * 0.30);
    // Pill keeps a flat baseline (uArch = 0).
    return uArch * roundLift;
  }

  vec2 cursorVortex(vec2 uv, float mouseX, float wind) {
    vec2 dv = vec2((uv.x - mouseX) * uAspect, uv.y - 0.36);
    float r2 = dot(dv, dv);
    float sigma2 = 0.26;
    float gamma = wind * 0.035;
    float psiM = gamma * exp(-r2 / sigma2);
    float b = smoothstep(0.0, 0.35, uv.y);
    return b * (-2.0 / sigma2) * psiM * vec2(dv.y, -dv.x);
  }

  float evalMainField(vec2 uv, float t, float scaleH, float baseShift, float wind, float upDraft, float mouseX, float hover, float press) {
    float yBase = getBaseY(uv.x);
    float yLocal = clamp((uv.y - yBase) / max(1.0 - yBase, 0.01), 0.0, 1.0);
    float yBuoy = yLocal - 0.18 * yLocal * yLocal;

    vec2 curlV = curlFluid(vec2(uv.x * uAspect * 0.95 * uFreqX, yLocal * 1.15 - t * 0.65), yLocal, 0.45);
    vec2 vortexV = cursorVortex(vec2(uv.x, yLocal), mouseX, wind);

    float advX = (curlV.x * 0.017 + vortexV.x - wind * 0.085 * pow(yLocal, 1.22)) * uSwayScale;
    float advY = (curlV.y * 0.013 + vortexV.y) * uSwayScale;

    vec2 p = vec2((uv.x + advX) * uAspect * uFreqX, yBuoy + advY);

    float v1 = voronoi(vec2(p.x * 2.20, p.y * 0.54 - t * 0.66), t * 0.44);
    float v2 = voronoi(vec2(p.x * 4.25 + 3.1, p.y * 1.00 - t * 1.02), t * 0.70);
    float ridge = 0.62 * v1 + 0.38 * v2;

    float edgePad = uEdgeInset;
    float edgeMask = smoothstep(0.0, edgePad, uv.x) * (1.0 - smoothstep(1.0 - edgePad, 1.0, uv.x));
    float hNoise = snoiseGrad(vec2(uv.x * 2.8 - t * 0.16, 1.7)).x;
    float heightVar = 0.76 + 0.24 * hNoise;

    float dx = uv.x - mouseX;
    float hoverBoost = 1.0 + hover * 0.15 * exp(-dx * dx * 10.0) + upDraft * 0.09 * exp(-dx * dx * 7.0);
    float pressScale = 1.0 - press * 0.08;
    float maxH = max(edgeMask * heightVar * 0.84 * scaleH * hoverBoost * pressScale, 0.001);

    float erode = smoothstep(0.0, 0.22, yLocal);
    float baseMain = 0.78 - baseShift - 1.15 * (yLocal / maxH);
    return baseMain + erode * (ridge - 0.45) * 1.44;
  }

  float evalBackField(vec2 uv, float t, float scaleH, float baseShift, float wind, float upDraft, float mouseX, float hover, float press) {
    float yBase = getBaseY(uv.x);
    float yLocal = clamp((uv.y - yBase) / max(1.0 - yBase, 0.01), 0.0, 1.0);
    float yBuoy = yLocal - 0.16 * yLocal * yLocal;

    vec2 curlV = curlFluid(vec2(uv.x * uAspect * 0.90 * uFreqX + 3.4, yLocal * 1.08 - t * 0.56), yLocal, 0.45);
    vec2 vortexV = cursorVortex(vec2(uv.x, yLocal), mouseX, wind * 0.85);

    float advX = (curlV.x * 0.015 + vortexV.x - wind * 0.075 * pow(yLocal, 1.22)) * uSwayScale;
    float advY = (curlV.y * 0.011 + vortexV.y) * uSwayScale;

    vec2 p = vec2((uv.x + advX) * uAspect * uFreqX, yBuoy + advY);

    float vb1 = voronoi(vec2(p.x * 2.05 + 4.7, p.y * 0.52 - t * 0.56 + 2.1), t * 0.38 + 1.5);
    float vb2 = voronoi(vec2(p.x * 3.85 + 8.3, p.y * 0.94 - t * 0.88), t * 0.62);
    float ridgeBack = 0.64 * vb1 + 0.36 * vb2;

    float edgePad = uEdgeInset;
    float edgeMask = smoothstep(0.0, edgePad, uv.x) * (1.0 - smoothstep(1.0 - edgePad, 1.0, uv.x));
    float hNoise = snoiseGrad(vec2(uv.x * 2.5 + t * 0.12, 4.2)).x;
    float heightVar = 0.77 + 0.23 * hNoise;

    float dx = uv.x - mouseX;
    float hoverBoost = 1.0 + hover * 0.12 * exp(-dx * dx * 9.0) + upDraft * 0.07 * exp(-dx * dx * 6.0);
    float pressScale = 1.0 - press * 0.06;
    float maxHBack = max(edgeMask * heightVar * 0.81 * scaleH * hoverBoost * pressScale, 0.001);

    float erode = smoothstep(0.0, 0.22, yLocal);
    float baseBack = 0.75 - baseShift - 1.11 * (yLocal / maxHBack);
    return baseBack + erode * (ridgeBack - 0.45) * 1.36;
  }

  void main() {
    vec2 uv = vUv;
    float inst = clamp(uIntensity, 0.0, 1.45);
    float wInst = clamp(uWispIntensity, 0.0, 1.35);

    if (inst <= 0.001 && wInst <= 0.001) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float yBase = getBaseY(uv.x);
    float yLocal = clamp((uv.y - yBase) / max(1.0 - yBase, 0.01), 0.0, 1.0);
    float localInst = clamp(inst * 1.18 - abs(uv.x - uClickX) * 0.18, 0.0, 1.05);

    float alphaFade = smoothstep(0.0, 0.58, localInst);
    float scaleH = 0.12 + 0.88 * smoothstep(0.0, 1.0, localInst);
    float baseShift = (1.0 - smoothstep(0.0, 0.78, localInst)) * 0.42;

    float fieldMain = evalMainField(uv, uTime, scaleH, baseShift, uWind, uUpDraft, uMouseX, uHover, uPress);
    float fieldBack = evalBackField(uv, uTime, scaleH, baseShift, uWind, uUpDraft, uMouseX, uHover, uPress);

    float mainAlpha = smoothstep(0.175, 0.205, fieldMain) * alphaFade;
    float backAlpha = smoothstep(0.175, 0.205, fieldBack) * 0.75 * alphaFade;
    float heatGlow = smoothstep(0.02, 0.175, fieldMain) * (1.0 - mainAlpha) * alphaFade * 0.085;

    vec3 subColor  = uColor * vec3(0.75, 0.79, 0.58);
    vec3 rimColor  = uColor * vec3(0.81, 0.85, 0.64);
    vec3 coreColor = mix(uColor, vec3(0.96, 1.0, 0.83), 0.50);

    float edgeCorePad = max(0.04, uEdgeInset * 0.85);
    float edgeCore = smoothstep(edgeCorePad, edgeCorePad + 0.11, uv.x)
                   * (1.0 - smoothstep(1.0 - edgeCorePad - 0.11, 1.0 - edgeCorePad, uv.x));
    float coreYMask = smoothstep(0.11, 0.22, yLocal) * (1.0 - smoothstep(0.45, 0.70, yLocal));
    float coreBand = smoothstep(0.43, 0.46, fieldMain) * coreYMask * edgeCore;

    float rimBand = (smoothstep(0.175, 0.205, fieldMain) - smoothstep(0.21, 0.238, fieldMain))
                  * smoothstep(0.09, 0.21, yLocal);

    vec3 mainColor = mix(uColor, coreColor, coreBand);
    mainColor = mix(mainColor, rimColor, rimBand * 0.62);

    vec3 wispPremul = vec3(0.0);
    float wispAlphaTotal = 0.0;

    for (int k = 0; k < 5; k++) {
      if (float(k) >= uMaxWisps) break;

      float seed = float(k) * 2.17 + 0.7 + uArch * 5.1;
      float dur = 2.2 + hash1(seed) * 1.4;
      float phaseOff = hash1(seed + 7.1);
      float tCycle = uTime / dur + phaseOff;
      float cycleId = floor(tCycle);
      float rawLife = fract(tCycle);

      float activeFrac = 0.54 + 0.18 * hash1(seed + 2.3 + cycleId * 1.7);
      if (rawLife > activeFrac) continue;

      float tBirth = (cycleId - phaseOff) * dur;
      if (tBirth < uIgniteTime + 0.28 || tBirth > uExtinguishTime) continue;

      float life = rawLife / activeFrac;

      float xMin = max(0.06, uEdgeInset + 0.03);
      float x0 = xMin + (1.0 - 2.0 * xMin) * hash1(seed + 13.3 + cycleId * 3.1);
      float bestX = x0;
      float bestF = -99.0;
      for (int j = 0; j < 3; j++) {
        float cx = clamp(x0 + (float(j) - 1.0) * 0.06, xMin - 0.03, 1.0 - xMin + 0.03);
        float bY = getBaseY(cx);
        float sampleY = bY + 0.28 * (1.0 - bY);
        float f = evalMainField(vec2(cx, sampleY), tBirth, 1.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0);
        if (f > bestF) {
          bestF = f;
          bestX = cx;
        }
      }

      float bY = getBaseY(bestX);
      float tipLocal = 0.0;
      for (int s = 0; s < 7; s++) {
        float tyLocal = 0.20 + float(s) * 0.065;
        float sampleY = bY + tyLocal * (1.0 - bY);
        if (evalMainField(vec2(bestX, sampleY), tBirth, 1.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0) > 0.18) {
          tipLocal = tyLocal;
        }
      }

      if (tipLocal < 0.19) continue;

      float varSize = hash1(seed + cycleId * 5.7 + 1.1);
      float varStretch = hash1(seed + cycleId * 3.9 + 4.2);
      float varRise = 0.18 + 0.24 * hash1(seed + cycleId * 7.3 + 2.8);
      float varDrift = (hash1(seed + cycleId * 6.1 + 8.4) - 0.5) * 0.09 * uSwayScale;
      float waveFreq = 3.5 + 3.5 * hash1(seed + cycleId * 4.4);

      float riseCurve = pow(life, 0.82);
      float tipScreenY = bY + (tipLocal - 0.02) * (1.0 - bY);
      float wy = min(0.92, tipScreenY + riseCurve * (varRise + uUpDraft * 0.06) * (1.0 - bY));
      float wx = bestX + varDrift * riseCurve + sin(life * waveFreq + seed) * 0.016 * uSwayScale + uWind * 0.105 * uSwayScale * life;

      vec2 d = vec2((uv.x - wx) * uAspect, uv.y - wy);
      float tilt = varDrift * 1.4 + cos(life * waveFreq + seed) * 0.18 + uWind * 0.48;
      d.x -= d.y * tilt;

      float baseR = 0.030 + 0.026 * varSize;
      float shrink = 1.0 - 0.65 * life;
      float stretch = 1.05 + 1.15 * varStretch;
      float taper = d.y > 0.0 ? (1.0 - (0.35 + 0.42 * varStretch) * clamp(d.y / (baseR * stretch), 0.0, 1.0)) : 1.0;
      float rw = baseR * shrink * max(taper, 0.28);
      float rh = baseR * stretch * (1.0 - 0.45 * life);
      float r = length(vec2(d.x / max(rw, 0.001), d.y / max(rh, 0.001)));

      float fadeIn = smoothstep(0.0, 0.12, life);
      float fadeOut = 1.0 - smoothstep(0.42, 1.0, life);
      float wa = (1.0 - smoothstep(0.76, 0.96, r)) * fadeIn * fadeOut * wInst * 0.92;

      float wRim = smoothstep(0.55, 0.74, r) * 0.28;
      vec3 wc = mix(uColor, subColor, clamp(smoothstep(0.25, 0.85, life) + wRim, 0.0, 1.0));

      wispPremul = wc * wa + wispPremul * (1.0 - wa);
      wispAlphaTotal = wa + wispAlphaTotal * (1.0 - wa);
    }

    vec3 premul = uColor * heatGlow;
    float alpha = heatGlow;
    premul = subColor * backAlpha + premul * (1.0 - backAlpha);
    alpha = backAlpha + alpha * (1.0 - backAlpha);
    premul = wispPremul + premul * (1.0 - wispAlphaTotal);
    alpha = wispAlphaTotal + alpha * (1.0 - wispAlphaTotal);
    premul = mainColor * mainAlpha + premul * (1.0 - mainAlpha);
    alpha = mainAlpha + alpha * (1.0 - mainAlpha);

    gl_FragColor = vec4(premul, alpha);
  }
`;
