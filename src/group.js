import { mk, clamp, RENDERERS } from './engine.js';

export const MAX_GROUP = 6;
export const GROUP_DEFAULTS = {
  style: 'collide', layout: 'line', rotate: 0,
  overlap: 0.45, soft: 0.35, blend: 'blend',
  width: 0.4, gap: 0.35, fibre: 5,
  matchPupil: true, pupil: null,
  repaint: true, pupilColour: '#08080a', pupilSoft: 0.35
};

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- Members: one isolated iris disc each ---------- */

// Cuts the current iris out as a tight transparent disc (eyelid areas rebuilt so it stays round).
export function makeDisc(A, size = 1200) {
  const art = RENDERERS.cutout(size, A, { feather: 0.12, keepPupil: true, rebuild: true });
  const half = size / 2, r = Math.floor(half * 0.94 * 0.975) - 1, side = 2 * r;
  const c = mk(side, side);
  c.getContext('2d').drawImage(art, half - r, half - r, side, side, 0, 0, side, side);
  return { disc: c, prFrac: clamp(A.circ.pr / (A.circ.ir * 0.975), 0.05, 0.8) };
}

function makeThumb(disc, size = 160) {
  const c = mk(size, size);
  c.getContext('2d').drawImage(disc, 0, 0, size, size);
  return c.toDataURL('image/png');
}

export async function buildMember(A, name) {
  const { disc, prFrac } = makeDisc(A);
  const blob = await new Promise(r => disc.toBlob(r, 'image/png'));
  const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return { id, name, prFrac, disc, blob, thumb: makeThumb(disc) };
}

export async function restoreMember(rec) {
  const bmp = await createImageBitmap(rec.blob);
  const c = mk(bmp.width, bmp.height);
  c.getContext('2d').drawImage(bmp, 0, 0);
  return { id: rec.id, name: rec.name, prFrac: rec.prFrac, disc: c, blob: rec.blob, thumb: makeThumb(c) };
}

/* ---------- Matching pupil sizes ----------
   Each disc is warped radially: the pupil is rescaled to the target fraction of the iris radius and the
   rest of the iris is stretched to fit, so the iris edge stays put and the fibres keep their angles. */

export function avgPupil(members) {
  return members.length ? members.reduce((s, m) => s + m.prFrac, 0) / members.length : 0.3;
}

function warpPupil(m, target) {
  const d = m.disc, W = d.width, R = W / 2, p = m.prFrac;
  const src = d.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, d.height).data;
  const c = mk(W, d.height), x = c.getContext('2d'), out = x.createImageData(W, d.height), od = out.data;
  for (let y = 0; y < d.height; y++) {
    for (let xx = 0; xx < W; xx++) {
      const dx = xx + 0.5 - R, dy = y + 0.5 - R, rho = Math.hypot(dx, dy) / R;
      if (rho >= 1) continue;
      const sr = rho < target ? rho / target * p : p + (rho - target) / (1 - target) * (1 - p), f = rho > 0 ? sr / rho : 0;
      const px = R + dx * f - 0.5, py = R + dy * f - 0.5, x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
      const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4, o = (y * W + xx) * 4;
      for (let ch = 0; ch < 4; ch++) {
        od[o + ch] = (src[i00 + ch] * (1 - fx) + src[i10 + ch] * fx) * (1 - fy) + (src[i01 + ch] * (1 - fx) + src[i11 + ch] * fx) * fy;
      }
    }
  }
  x.putImageData(out, 0, 0);
  return c;
}

// Paints a clean, uniform pupil over a copy of the disc: solid colour with a soft edge into the iris.
function paintPupil(disc, target, paint) {
  const c = mk(disc.width, disc.height), x = c.getContext('2d'), R = disc.width / 2, f = 0.006 + 0.03 * paint.soft;
  x.drawImage(disc, 0, 0);
  const ro = (target + f) * R, g = x.createRadialGradient(R, R, 0, R, R, ro), solid = clamp((target - f) / (target + f), 0, 0.999);
  g.addColorStop(0, paint.col); g.addColorStop(solid, paint.col);
  const n = parseInt(paint.col.slice(1), 16), rgb = (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  x.fillStyle = g; x.beginPath(); x.arc(R, R, ro, 0, TAU); x.fill();
  return c;
}

function viewOf(m, target, paint) {
  const same = Math.abs(target - m.prFrac) < 0.004;
  if (same && !paint) return m;
  const key = Math.round(target * 200) + '|' + (paint ? paint.col + '|' + Math.round(paint.soft * 100) : '');
  m.views = m.views || {};
  if (!m.views[key]) {
    let disc = same ? m.disc : warpPupil(m, target);
    if (paint) disc = paintPupil(disc, target, paint);
    m.views[key] = { id: m.id, disc, prFrac: target };
  }
  return m.views[key];
}

// Members as they will be drawn: pupils matched in size and/or repainted, if switched on.
function prepared(members, P) {
  const target = P.matchPupil && members.length > 1 ? clamp(P.pupil == null ? avgPupil(members) : P.pupil, 0.15, 0.65) : null;
  const paint = P.repaint ? { col: P.pupilColour, soft: P.pupilSoft } : null;
  return members.map(m => viewOf(m, target == null ? m.prFrac : target, paint));
}

/* ---------- Ribbon texture: the iris unwrapped, mirrored so the pupil side runs down the middle ---------- */

const TEX_W = 1600, TEX_H = 256;
export function ribbonTexture(m) {
  if (m.tex) return m.tex;
  const d = m.disc, W = d.width, R = W / 2;
  const src = d.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, d.height).data;
  const t = mk(TEX_W, TEX_H), tx = t.getContext('2d'), out = tx.createImageData(TEX_W, TEX_H), od = out.data;
  const rIn = Math.min(0.5, m.prFrac + 0.05), rOut = 0.95;
  for (let y = 0; y < TEX_H; y++) {
    const v = Math.abs(y + 0.5 - TEX_H / 2) / (TEX_H / 2), rho = (rIn + (rOut - rIn) * v) * R, shade = 0.86 + 0.14 * (1 - v * v);
    for (let x = 0; x < TEX_W; x++) {
      const th = (x + 0.5) / TEX_W * TAU, px = R + rho * Math.cos(th) - 0.5, py = R + rho * Math.sin(th) - 0.5;
      const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
      const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4, o = (y * TEX_W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        od[o + ch] = ((src[i00 + ch] * (1 - fx) + src[i10 + ch] * fx) * (1 - fy) + (src[i01 + ch] * (1 - fx) + src[i11 + ch] * fx) * fy) * shade;
      }
      od[o + 3] = 255;
    }
  }
  tx.putImageData(out, 0, 0);
  m.tex = t;
  return t;
}

/* ---------- Layout helpers (units: one iris radius = 1) ---------- */

function centresFor(n, layout, spacing, rotDeg) {
  let pts;
  if (n === 1) pts = [[0, 0]];
  else if (layout === 'ring' && n > 2) {
    const rad = spacing / (2 * Math.sin(Math.PI / n));
    pts = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + TAU * i / n; return [rad * Math.cos(a), rad * Math.sin(a)]; });
  } else pts = Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * spacing, 0]);
  const a = rotDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

function frame(cs, ext, longEdge) {
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const c of cs) { minx = Math.min(minx, c[0] - ext); maxx = Math.max(maxx, c[0] + ext); miny = Math.min(miny, c[1] - ext); maxy = Math.max(maxy, c[1] + ext); }
  const marg = 0.05 * Math.max(maxx - minx, maxy - miny), wu = maxx - minx + 2 * marg, hu = maxy - miny + 2 * marg, scale = longEdge / Math.max(wu, hu);
  return { W: Math.max(2, Math.round(wu * scale)), H: Math.max(2, Math.round(hu * scale)), scale, ox: marg - minx, oy: marg - miny };
}

function plan(n, P, L) {
  if (P.style === 'infinity' && n > 1) {
    const w = P.width, Rc = 1.06 + w / 2, D = 2 * Rc * (1 + P.gap);
    const cs = centresFor(n, P.layout, D, P.rotate);
    return { cs, w, Rc, D, f: frame(cs, Rc + w / 2 + 0.05, L) };
  }
  const cs = centresFor(n, P.layout, 2 * (1 - (n > 1 ? P.overlap : 0)), P.rotate);
  return { cs, f: frame(cs, 1, L) };
}

export function groupDims(n, P, L) {
  const { f } = plan(Math.max(1, n), P, L);
  return { w: f.W, h: f.H };
}

/* ---------- Colliding irises ---------- */

function softDisc(m, soft) {
  const d = m.disc, c = mk(d.width, d.height), x = c.getContext('2d');
  x.drawImage(d, 0, 0);
  if (soft > 0.01) {
    const R = d.width / 2, g = x.createRadialGradient(R, R, R * (1 - 0.7 * soft), R, R, R);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, d.width, d.height);
  }
  return c;
}

function renderCollide(members, P, L) {
  const { cs, f } = plan(members.length, P, L);
  const art = mk(f.W, f.H), x = art.getContext('2d');
  x.imageSmoothingQuality = 'high';
  const op = { blend: 'source-over', screen: 'screen', multiply: 'multiply', difference: 'difference', lighten: 'lighten' }[P.blend] || 'source-over';
  members.forEach((m, i) => {
    const sd = softDisc(m, members.length > 1 ? P.soft : 0), r = f.scale, px = (cs[i][0] + f.ox) * f.scale, py = (cs[i][1] + f.oy) * f.scale;
    x.globalCompositeOperation = i === 0 ? 'source-over' : op;
    x.drawImage(sd, px - r, py - r, 2 * r, 2 * r);
  });
  x.globalCompositeOperation = 'source-over';
  return art;
}

/* ---------- Infinity loop: a crossed belt around two irises, made of unwrapped iris ---------- */

function beltSegments(h, Rc) {
  const al = Math.asin(Rc / h), Lt = Math.sqrt(h * h - Rc * Rc), ca = Math.cos(al), sa = Math.sin(al);
  const T1 = [Lt * ca, Lt * sa], T2 = [Lt * ca, -Lt * sa], T3 = [-Lt * ca, Lt * sa], T4 = [-Lt * ca, -Lt * sa], O = [0, 0];
  const th1 = Math.atan2(T1[1], T1[0] - h), th3 = Math.atan2(T3[1], T3[0] + h);
  const line = (a, b) => ({ len: Math.hypot(b[0] - a[0], b[1] - a[1]), at: t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] });
  const arc = (cx, a0, a1) => ({ len: Math.abs(a1 - a0) * Rc, at: t => { const a = a0 + (a1 - a0) * t; return [cx + Rc * Math.cos(a), Rc * Math.sin(a)]; } });
  return [line(O, T1), arc(h, th1, -th1), line(T2, O), line(O, T3), arc(-h, th3, TAU - th3), line(T4, O)];
}

function beltPoints(segs, stepUnits) {
  const total = segs.reduce((s, g) => s + g.len, 0), n = Math.max(8, Math.ceil(total / stepUnits)), pts = [];
  for (let i = 0; i <= n; i++) {
    let s = i / n * total, k = 0;
    while (k < segs.length - 1 && s > segs[k].len) { s -= segs[k].len; k++; }
    pts.push({ p: segs[k].at(clamp(s / segs[k].len, 0, 1)), s: i / n * total });
  }
  return pts;
}

function renderInfinity(members, P, L) {
  const n = members.length;
  if (n < 2) return renderCollide(members, P, L);
  const { cs, w, Rc, D, f } = plan(n, P, L), sc = f.scale;
  const art = mk(f.W, f.H), x = art.getContext('2d');
  x.imageSmoothingQuality = 'high';
  const pairs = [];
  for (let i = 0; i < n - 1; i++) pairs.push([i, i + 1]);
  if (P.layout === 'ring' && n > 2) pairs.push([n - 1, 0]);
  const wpx = w * sc, step = clamp(wpx / 10, 2, 8) / sc, tilePx = w * P.fibre * sc;
  const belts = pairs.map(([a, b]) => {
    const A = cs[a], B = cs[b], dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy), ex = [dx / d, dy / d], ey = [-ex[1], ex[0]], h = d / 2;
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const pts = beltPoints(beltSegments(h, Rc), step).map(q => ({
      x: (mid[0] + q.p[0] * ex[0] + q.p[1] * ey[0] + f.ox) * sc,
      y: (mid[1] + q.p[0] * ex[1] + q.p[1] * ey[1] + f.oy) * sc,
      s: q.s * sc, m: smooth(-0.25 * h, 0.25 * h, q.p[0])
    }));
    return { a, b, pts };
  });
  // soft dark edge under the ribbons gives them depth and hides slice joins
  x.lineJoin = 'round'; x.lineCap = 'round';
  for (const bt of belts) {
    x.beginPath(); bt.pts.forEach((q, i) => i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)); x.closePath();
    x.lineWidth = (w + 0.05) * sc; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.stroke();
  }
  for (const bt of belts) {
    const ta = ribbonTexture(members[bt.a]), tb = ribbonTexture(members[bt.b]), pts = bt.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const ang = Math.atan2(dy, dx), cs_ = Math.cos(ang), sn = Math.sin(ang);
      const u0 = (p.s / tilePx) % 1, sx = Math.floor(u0 * TEX_W), sw = Math.max(2, Math.min(TEX_W - sx, Math.round(len / tilePx * TEX_W) + 1));
      x.setTransform(cs_, sn, -sn, cs_, (p.x + q.x) / 2, (p.y + q.y) / 2);
      x.drawImage(ta, sx, 0, sw, TEX_H, -len * 0.7, -wpx / 2, len * 1.4, wpx);
      const m = (p.m + q.m) / 2;
      if (m > 0.02) { x.globalAlpha = m; x.drawImage(tb, sx, 0, sw, TEX_H, -len * 0.7, -wpx / 2, len * 1.4, wpx); x.globalAlpha = 1; }
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
  }
  members.forEach((m, i) => {
    const r = sc, px = (cs[i][0] + f.ox) * sc, py = (cs[i][1] + f.oy) * sc;
    x.drawImage(m.disc, px - r, py - r, 2 * r, 2 * r);
  });
  return art;
}

export function renderGroup(rawMembers, P, L) {
  const members = prepared(rawMembers, P);
  return P.style === 'infinity' ? renderInfinity(members, P, L) : renderCollide(members, P, L);
}
