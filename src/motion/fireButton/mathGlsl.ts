/** Shared GLSL helpers for fire-button crown + ignite screen burn. */

export const FIRE_MATH_GLSL = `
  float hash1(float n) { return fract(sin(n) * 4375.5453); }

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 4375.5453);
  }

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  vec3 snoiseGrad(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
     -0.577350269189626,
      0.024390243902439
    );

    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    i = mod289_2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    vec3 angles = p * C.w * 6.28318530718;
    vec3 gx = cos(angles);
    vec3 gy = sin(angles);

    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    vec3 m2 = m * m;
    vec3 m4 = m2 * m2;

    vec3 gdotx = vec3(
      gx.x * x0.x + gy.x * x0.y,
      gx.y * x12.x + gy.y * x12.y,
      gx.z * x12.z + gy.z * x12.w
    );

    float val = 42.0 * dot(m4, gdotx);
    vec3 dm = -8.0 * m2 * m * gdotx;

    vec2 grad = 42.0 * vec2(
      dot(m4, gx) + dm.x * x0.x + dm.y * x12.x + dm.z * x12.z,
      dot(m4, gy) + dm.x * x0.y + dm.y * x12.y + dm.z * x12.w
    );
    return vec3(val, grad);
  }

  vec3 fbmGrad(vec2 p) {
    vec3 n1 = snoiseGrad(p);
    mat2 R = mat2(0.80, -0.60, 0.60, 0.80);
    vec3 n2 = snoiseGrad(2.07 * (R * p));
    vec2 g2World = 2.07 * (n2.yz * R);
    return vec3(
      0.65 * n1.x + 0.35 * n2.x,
      0.65 * n1.y + 0.35 * g2World.x,
      0.65 * n1.z + 0.35 * g2World.y
    );
  }

  vec2 curlFluid(vec2 p, float distFromBound, float rampEnd) {
    float t = clamp(distFromBound / rampEnd, 0.0, 1.0);
    float b = t * t * (3.0 - 2.0 * t);
    float dbdy = (distFromBound > 0.0 && distFromBound < rampEnd)
      ? (6.0 * t * (1.0 - t) / rampEnd)
      : 0.0;

    vec3 fg = fbmGrad(p);
    return vec2(dbdy * fg.x + b * fg.z, -b * fg.y);
  }

  float voronoi(vec2 uv, float tOffset) {
    vec2 i_st = floor(uv);
    vec2 f_st = uv - i_st;
    float minDist = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 pt = hash2(i_st + neighbor);
        pt = 0.5 + 0.36 * sin(tOffset + 6.2831 * pt);
        vec2 diff = neighbor + pt - f_st;
        minDist = min(minDist, length(diff));
      }
    }
    return minDist;
  }
`;
