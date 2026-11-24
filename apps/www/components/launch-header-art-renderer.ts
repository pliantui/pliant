// Animates the Pliant tangram artwork in one WebGL shader drawn over the
// original image. Each of the seven pieces breathes on its own rhythm, its hue
// drifts, a band of light sweeps across, and from time to time a piece
// dissolves into fine pixels along a crystalline front and resolves again.

const SETTINGS = {
  speed: 1,
  sweep: 0.8,
  shimmer: 1,
  breath: 1.2,
  breathSpeed: 1,
  spacing: 1,
  peak: 3,
  pixPace: 1,
}

type Point = readonly [number, number]

// The tangram in a 40 × 40 square.
const PIECES: readonly (readonly Point[])[] = [
  [
    [0, 0],
    [40, 0],
    [20, 20],
  ],
  [
    [40, 0],
    [40, 40],
    [20, 20],
  ],
  [
    [0, 20],
    [20, 40],
    [0, 40],
  ],
  [
    [10, 30],
    [30, 30],
    [40, 40],
    [20, 40],
  ],
  [
    [0, 0],
    [10, 10],
    [0, 20],
  ],
  [
    [10, 10],
    [20, 20],
    [10, 30],
    [0, 20],
  ],
  [
    [20, 20],
    [30, 30],
    [10, 30],
  ],
]

// Where the tangram sits inside the image, in fractions of the image.
const MAP = { s: 25.0 / 1254, ox: 131.0 / 1254, oy: 110.0 / 1254 }
const toUV = ([x, y]: Point): Point => [MAP.ox + x * MAP.s, MAP.oy + y * MAP.s]

const FRAGMENT_SHADER = `precision highp float;
uniform sampler2D uImg, uIds; uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
uniform float uSweep, uShimmer, uSide; uniform vec2 uCorner;
uniform float uPeak; uniform float uTileAmt[7];
uniform vec2 uTileSeed[7]; uniform vec3 uTileGrow[7];
uniform float uBreath, uBreathSpeed, uSpace; uniform vec2 uDir[7];
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
// crystal growth: each pixel cell switches on when the growth front reaches it; the front spreads from a seed,
// with a jagged, crystalline edge (per-cell jitter plus a coarser noise), and recedes the same way
float grow(vec2 cc, vec2 seed, vec3 g, float progress, vec2 cell){
  float v = (length(cc - seed) - g.x) / max(g.y - g.x, 1e-4);
  v = mix(v, 1.0 - v, g.z);
  v += (hash(cell) - 0.5) * 0.10 + (vnoise(cc * 38.0) - 0.5) * 0.30;
  return smoothstep(v - 0.06, v + 0.02, progress * 1.25 - 0.1);
}
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
vec3 oklab(vec3 c){
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c;
  lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662, -0.0040720468, 0.4505937099, -0.8086757660) * lms;
}
vec3 fromOklab(vec3 l){
  vec3 lms = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * l;
  lms = lms * lms * lms;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.7076147010) * lms;
}
// Returns the straight (not premultiplied) colour and its alpha.
vec4 shade(vec2 uv){
  // each piece is its own layer: it breathes on its own rhythm and drifts slightly outward as it breathes,
  // so the gaps between pieces gently open and close. Find which piece (if any) is drawn at this pixel.
  float k = 0.0; float breath = 0.0; vec2 uvs = uv;
  for (int i = 1; i <= 7; i++) {
    float fi = float(i);
    float ph = fi * 2.39996;                                          // golden-angle offsets: never in sync
    float sp = 0.8 + 0.35 * fract(fi * 0.618);                        // each piece breathes at its own pace
    float br = sin(uTime * 0.55 * uBreathSpeed * sp + ph);
    vec2 q = uv - uDir[i - 1] * uSpace * 0.007 * (br * 0.5 + 0.5);
    float id = floor(texture2D(uIds, q).r * 255.0 / 32.0 + 0.5);
    if (k < 0.5 && abs(id - fi) < 0.5) { k = fi; uvs = q; breath = br; }
  }
  float piece = step(0.5, k);
  float ph = k * 2.39996;
  float sp = 0.8 + 0.35 * fract(k * 0.618);
  // the texture is premultiplied, so filtering doesn't darken soft edges; the effects work on the straight colour
  vec4 texel = piece > 0.5 ? texture2D(uImg, uvs) : vec4(0.0);
  vec3 src = texel.a > 0.0 ? texel.rgb / texel.a : vec3(0.0);
  vec3 lab = oklab(toLin(src));
  // lazy breathing: a slow rise and fall in brightness and colour depth, per piece
  lab.x *= 1.0 + 0.08 * uBreath * breath * piece;
  lab.yz *= 1.0 + 0.18 * uBreath * breath * piece;
  // shimmer: a gentle hue drift that travels across each piece on its own schedule
  float ang = uShimmer * 0.28 * sin(uTime * 0.45 * sp + ph + dot(uv, vec2(5.0, -3.2)) + lab.x * 4.0 + uMouse.x * 1.5) * smoothstep(0.15, 0.55, lab.x) * piece;
  float ca = cos(ang), sa = sin(ang);
  lab.yz = vec2(lab.y * ca - lab.z * sa, lab.y * sa + lab.z * ca);
  vec3 col = max(fromOklab(lab), 0.0);
  // light sweep across the whole tangram
  vec2 dir = normalize(vec2(1.0, 0.75));
  float pos = mod(uTime * 0.09, 1.8) - 0.4 + uMouse.x * 0.12 + uMouse.y * 0.08;
  float band = exp(-pow((dot(uv, dir) - pos) / 0.06, 2.0));
  col = 1.0 - (1.0 - col) * (1.0 - vec3(0.42, 0.40, 0.44) * band * smoothstep(0.1, 0.8, lab.x) * uSweep * piece);
  return vec4(toSrgb(col), texel.a);
}
void main(){
  vec2 uv = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uCorner) / uSide;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec4 base = shade(uv);
  vec3 outc = base.rgb * base.a; float outa = base.a;
  // pixelation, per piece: fine pixels grow across a piece from its seed
  float pa = 0.0, ps = uPeak;
  vec2 px0 = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uCorner;
  vec2 cell = floor(px0 / ps);
  vec2 cc = (cell + 0.5) * ps / uSide;
  float kk = floor(texture2D(uIds, uv).r * 255.0 / 32.0 + 0.5);
  for (int i = 0; i < 7; i++) {
    if (abs(float(i + 1) - kk) < 0.5 && uTileAmt[i] > 0.0) pa = grow(cc, uTileSeed[i], uTileGrow[i], uTileAmt[i], cell) * 0.85;
  }
  if (pa > 0.003 && ps > 1.01) {
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uCorner;
    vec2 cellCentre = (floor(px / ps) + 0.5) * ps / uSide;
    float mixAmt = smoothstep(0.0, 1.0, pa);   // fixed fine pixels, faded in and out: no jumping grid
    vec4 cellShade = shade(cellCentre);
    outc = mix(outc, cellShade.rgb * cellShade.a, mixAmt);
    outa = mix(outa, cellShade.a, mixAmt);
  }
  vec3 straight = outa > 0.0 ? outc / outa : vec3(0.0);
  gl_FragColor = vec4(clamp(straight, 0.0, 1.0) * outa, outa);
}`

const VERTEX_SHADER =
  "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }"

const UNIFORMS = [
  "uImg",
  "uIds",
  "uRes",
  "uTime",
  "uMouse",
  "uSweep",
  "uShimmer",
  "uSide",
  "uCorner",
  "uPeak",
  "uTileAmt",
  "uTileSeed",
  "uTileGrow",
  "uBreath",
  "uBreathSpeed",
  "uSpace",
  "uDir",
] as const

type UniformName = (typeof UNIFORMS)[number]

// Each side of a polygon, from a corner to the next one.
const sides = (poly: readonly Point[]): [Point, Point][] =>
  poly.map((a, i) => [a, poly[(i + 1) % poly.length] ?? a])

function insetPolygon(pts: readonly Point[], d: number): Point[] {
  let area = 0
  for (const [a, b] of sides(pts)) area += a[0] * b[1] - b[0] * a[1]
  const s = area > 0 ? 1 : -1
  const lines = sides(pts).map(([a, b]): [Point, Point] => {
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const L = Math.hypot(ex, ey)
    return [
      [a[0] - (ey / L) * s * d, a[1] + (ex / L) * s * d],
      [ex, ey],
    ]
  })
  return lines.map((cur, i) => {
    const [p, r] = lines.at(i - 1) ?? cur
    const [q, t] = cur
    const den = r[0] * t[1] - r[1] * t[0]
    const u = ((q[0] - p[0]) * t[1] - (q[1] - p[1]) * t[0]) / den
    return [p[0] + u * r[0], p[1] + u * r[1]]
  })
}

const key = (p: Point) => `${String(p[0])},${String(p[1])}`

const centroid = (poly: readonly Point[]): Point =>
  poly.reduce<Point>(
    (a, q) => [a[0] + q[0] / poly.length, a[1] + q[1] / poly.length],
    [0, 0]
  )

const onSeg = (p: Point, a: Point, b: Point) => {
  const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  if (Math.abs(cr) > 1e-6) return false
  const t =
    ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) /
    ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
  return t > 1e-6 && t < 1 - 1e-6
}

const onBoundary = (pt: Point, poly: readonly Point[]) =>
  sides(poly).some(([a, b]) => onSeg(pt, a, b) || key(pt) === key(a))

// For each piece, the pieces it shares a seam with: every piece edge is split
// wherever another piece's corner sits on it, and the pieces on both sides of
// each split segment are neighbours.
function neighbourPieces() {
  const verts: Point[] = []
  for (const p of PIECES.flat()) {
    if (!verts.some((q) => key(q) === key(p))) verts.push(p)
  }
  const segments: [Point, Point][] = []
  PIECES.forEach((poly) => {
    sides(poly).forEach(([a, b]) => {
      const pts = [a, ...verts.filter((p) => onSeg(p, a, b)), b].sort(
        (p, q) =>
          (p[0] - a[0]) ** 2 +
          (p[1] - a[1]) ** 2 -
          ((q[0] - a[0]) ** 2 + (q[1] - a[1]) ** 2)
      )
      pts.slice(1).forEach((q, j) => segments.push([pts[j] ?? q, q]))
    })
  })
  const neighbours = PIECES.map(() => new Set<number>())
  for (const [a, b] of segments) {
    const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const owners = PIECES.flatMap((poly, k) =>
      onBoundary(mid, poly) ? [k] : []
    )
    for (const i of owners)
      for (const j of owners) if (i !== j) neighbours[i]?.add(j)
  }
  return neighbours
}

interface GrowthPattern {
  seed: Point
  grow: readonly [number, number, number]
}

// Growth patterns: from the centre outward, from the edges inward, from a
// corner, or sweeping in from one side. Each returns a seed point and the
// distance range the front travels (in image fractions), plus an invert flag.
function growthPattern(poly: readonly Point[]): GrowthPattern {
  const c = centroid(poly)
  const span = (seed: Point): [number, number] => {
    const ds = poly.map((q) => Math.hypot(q[0] - seed[0], q[1] - seed[1]))
    return [Math.min(...ds), Math.max(...ds)]
  }
  const kind = Math.floor(Math.random() * 4)
  let seed: Point
  let d0: number
  let d1: number
  let inv = 0
  if (kind === 0 || kind === 1) {
    seed = c
    d0 = 0
    d1 = span(c)[1] * 0.8
    inv = kind
  } else if (kind === 2) {
    seed = poly[Math.floor(Math.random() * poly.length)] ?? c
    d0 = 0
    d1 = span(seed)[1]
  } else {
    const side = sides(poly)[Math.floor(Math.random() * poly.length)]
    const [a, b] = side ?? [c, c]
    const m: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    let n: Point = [b[1] - a[1], -(b[0] - a[0])]
    const l = Math.hypot(n[0], n[1])
    n = [n[0] / l, n[1] / l]
    if (n[0] * (m[0] - c[0]) + n[1] * (m[1] - c[1]) < 0) n = [-n[0], -n[1]]
    seed = [m[0] + n[0] * 60, m[1] + n[1] * 60]
    ;[d0, d1] = span(seed)
    d0 -= 0.5
  }
  return { seed: toUV(seed), grow: [d0 * MAP.s, d1 * MAP.s, inv] }
}

const ease = (x: number) => x * x * (3 - 2 * x)
const lifecycle = (u: number) =>
  u <= 0 || u >= 1
    ? 0
    : u < 0.42
      ? ease(u / 0.42)
      : u < 0.58
        ? 1
        : 1 - ease((u - 0.58) / 0.42)

export interface LaunchHeaderArtOptions {
  canvas: HTMLCanvasElement
  // The element that tracks the pointer and the viewport.
  container: HTMLElement
  imageSrc: string
  onFirstFrame: () => void
  onFailure: () => void
}

// Starts the animation and returns a function that stops it and frees its
// GPU resources. Returns null when WebGL is unavailable.
export function startLaunchHeaderArt({
  canvas,
  container,
  imageSrc,
  onFirstFrame,
  onFailure,
}: LaunchHeaderArtOptions): (() => void) | null {
  // Refuses software-rendered WebGL, which is too slow for the animation; the
  // still image stays instead.
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    antialias: true,
    failIfMajorPerformanceCaveat: true,
  })
  if (!gl) return null

  const shaders: WebGLShader[] = []
  const compile = (type: number, src: string) => {
    const o = gl.createShader(type)
    if (!o) return null
    shaders.push(o)
    gl.shaderSource(o, src)
    gl.compileShader(o)
    return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null
  }
  const prog = gl.createProgram()
  const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const buf = gl.createBuffer()
  const idTex = gl.createTexture()
  const tex = gl.createTexture()
  const free = () => {
    shaders.forEach((o) => {
      gl.deleteShader(o)
    })
    gl.deleteProgram(prog)
    gl.deleteBuffer(buf)
    gl.deleteTexture(idTex)
    gl.deleteTexture(tex)
  }
  if (!vs || !fs) {
    free()
    return null
  }
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    free()
    return null
  }
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  )
  const loc = gl.getAttribLocation(prog, "a")
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const U = Object.fromEntries(
    UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])
  ) as Record<UniformName, WebGLUniformLocation | null>

  // A layer per piece: an id map, so every piece can carry its own effects.
  const ID_N = 1024
  const idCv = document.createElement("canvas")
  idCv.width = idCv.height = ID_N
  const ix = idCv.getContext("2d")
  if (!ix) {
    free()
    return null
  }
  ix.fillStyle = "#000"
  ix.fillRect(0, 0, ID_N, ID_N)
  PIECES.forEach((poly, k) => {
    ix.fillStyle = `rgb(${String((k + 1) * 32)},0,0)`
    ix.beginPath()
    insetPolygon(poly, 0.02).forEach((pt, i) => {
      const [u, v] = toUV(pt)
      if (i) ix.lineTo(u * ID_N, v * ID_N)
      else ix.moveTo(u * ID_N, v * ID_N)
    })
    ix.closePath()
    ix.fill()
  })
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, idTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, idCv)
  const dirs = PIECES.map((poly) => {
    const c = centroid(poly)
    const v = [c[0] - 20, c[1] - 20] as const
    const l = Math.hypot(v[0], v[1]) || 1
    return [v[0] / l, v[1] / l]
  })
  const neighbours = neighbourPieces()

  let pixClock = 0
  let nextTileEvent = 2
  const tiles = PIECES.map((poly, index) => ({
    index,
    poly,
    start: -99,
    end: -98,
    pattern: growthPattern(poly),
  }))

  let pointer: Point = [0, 0]
  const smooth: [number, number] = [0, 0]
  const onPointerMove = (ev: PointerEvent) => {
    const r = container.getBoundingClientRect()
    pointer = [
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      ((ev.clientY - r.top) / r.height) * 2 - 1,
    ]
  }
  const onPointerLeave = () => {
    pointer = [0, 0]
  }
  container.addEventListener("pointermove", onPointerMove)
  container.addEventListener("pointerleave", onPointerLeave)

  let time = 2
  let last = performance.now()
  let raf = 0
  let loaded = false
  let visible = false
  let firstFrame = true

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    time += dt * SETTINGS.speed
    smooth[0] += (pointer[0] - smooth[0]) * 0.05
    smooth[1] += (pointer[1] - smooth[1]) * 0.05
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.round(canvas.clientWidth * dpr)
    const h = Math.round(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const side = Math.min(w, h) * 0.98
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(U.uRes, w, h)
    gl.uniform1f(U.uTime, time)
    gl.uniform2f(U.uMouse, smooth[0], smooth[1])
    gl.uniform1f(U.uSweep, SETTINGS.sweep)
    gl.uniform1f(U.uShimmer, SETTINGS.shimmer)
    pixClock += dt * SETTINGS.pixPace
    // Random tiles, scheduled one at a time: each starts at its own random
    // moment with its own duration, up to three at once, never next to a
    // piece that's already pixelating.
    const activeNow = tiles.filter(
      (tile) => pixClock >= tile.start - 0.01 && pixClock < tile.end
    )
    if (pixClock >= nextTileEvent && activeNow.length < 3) {
      const idle = tiles.filter((tile) => pixClock > tile.end + 3)
      const pool = idle.filter((tile) =>
        activeNow.every((active) => !neighbours[tile.index]?.has(active.index))
      )
      const tile = pool[Math.floor(Math.random() * pool.length)]
      if (tile) {
        tile.start = pixClock
        tile.end = pixClock + 10 + Math.random() * 6
        tile.pattern = growthPattern(tile.poly)
      }
      nextTileEvent = pixClock + 2.5 + Math.random() * 5.5
    }
    const amounts = new Float32Array(7)
    const seeds = new Float32Array(14)
    const grows = new Float32Array(21)
    tiles.forEach(({ start, end, pattern }, k) => {
      amounts[k] = lifecycle((pixClock - start) / (end - start))
      seeds[k * 2] = pattern.seed[0]
      seeds[k * 2 + 1] = pattern.seed[1]
      grows[k * 3] = pattern.grow[0]
      grows[k * 3 + 1] = pattern.grow[1]
      grows[k * 3 + 2] = pattern.grow[2]
    })
    gl.uniform2fv(U.uTileSeed, seeds)
    gl.uniform3fv(U.uTileGrow, grows)
    gl.uniform1f(U.uPeak, Math.max(1.5, SETTINGS.peak * dpr))
    gl.uniform1fv(U.uTileAmt, amounts)
    gl.uniform1f(U.uSpace, SETTINGS.spacing)
    gl.uniform2fv(U.uDir, new Float32Array(dirs.flat()))
    gl.uniform1f(U.uBreath, SETTINGS.breath)
    gl.uniform1f(U.uBreathSpeed, SETTINGS.breathSpeed)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, idTex)
    gl.uniform1f(U.uSide, side)
    gl.uniform2f(U.uCorner, (w - side) / 2, (h - side) / 2)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    if (firstFrame) {
      firstFrame = false
      onFirstFrame()
    }
  }

  // Draws only while the art is on screen; the clocks stand still meanwhile.
  const run = () => {
    cancelAnimationFrame(raf)
    raf = 0
    if (loaded && visible) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting)
    run()
  })
  observer.observe(container)

  const img = new Image()
  img.onload = () => {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.uniform1i(U.uImg, 0)
    gl.uniform1i(U.uIds, 1)
    loaded = true
    run()
  }
  img.onerror = onFailure
  img.src = imageSrc

  const onContextLost = () => {
    cancelAnimationFrame(raf)
    onFailure()
  }
  canvas.addEventListener("webglcontextlost", onContextLost)

  return () => {
    cancelAnimationFrame(raf)
    observer.disconnect()
    img.onload = null
    img.onerror = null
    container.removeEventListener("pointermove", onPointerMove)
    container.removeEventListener("pointerleave", onPointerLeave)
    canvas.removeEventListener("webglcontextlost", onContextLost)
    free()
  }
}
