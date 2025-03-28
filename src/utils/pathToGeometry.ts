import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { AssetTypeConfig, ConversionOptions, Point, Stroke } from '../types';
import { CANVAS_SIZE } from './drawingUtils';

export function resolveStrokeOptions(
  stroke: Stroke,
  global: ConversionOptions,
): ConversionOptions {
  return { ...global, ...stroke.conversion };
}

/** Roundness 0 = box, 1 = fully round (sphere). */
export function getEffectiveRoundness(stroke: Stroke, globalBevel: number): number {
  if (stroke.conversion?.bevelAmount !== undefined) {
    return THREE.MathUtils.clamp(stroke.conversion.bevelAmount, 0, 1);
  }
  if (stroke.tool === 'ellipse' || isRoundShape(stroke)) return 1;
  return THREE.MathUtils.clamp(globalBevel, 0, 1);
}

/** How a 2D stroke should become 3D. */
type ShapeRole =
  | 'sphere' // round / head / ball
  | 'capsule' // limb, stick, thin stroke
  | 'box' // rectangle / blocky body
  | 'tube' // open freehand path
  | 'extrude' // filled silhouette
  | 'lathe'; // jewellery profile

function toShapeSpace(p: Point): THREE.Vector2 {
  const x = (p.x / CANVAS_SIZE - 0.5) * 2;
  const y = -(p.y / CANVAS_SIZE - 0.5) * 2;
  return new THREE.Vector2(x, y);
}

function getRenderableStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.filter(
    (s) => s.tool !== 'eraser' && s.color !== 'transparent' && s.points.length >= 1,
  );
}

/** Click / dab with little or no drag — becomes a small sphere in 3D. */
function isDotStroke(stroke: Stroke): boolean {
  if (stroke.points.length === 0) return false;
  if (stroke.points.length === 1) return true;
  const { dist } = farthestPair(stroke.points);
  return dist < Math.max(stroke.width * 1.75, 5);
}

function strokeCentroid(stroke: Stroke): Point {
  let x = 0;
  let y = 0;
  for (const p of stroke.points) {
    x += p.x;
    y += p.y;
  }
  const n = stroke.points.length || 1;
  return { x: x / n, y: y / n };
}

function toDotGeometry(stroke: Stroke, options: ConversionOptions): THREE.BufferGeometry {
  const c = strokeCentroid(stroke);
  const center = toShapeSpace(c);
  // Match 2D filled-circle radius (stroke.width / 2) in world units
  const r = Math.max((stroke.width / CANVAS_SIZE), 0.035);
  const hollow = Boolean(options.hollow);
  if (hollow) {
    const geom = hollowRoundGeometry(r * 2, r * 2, r * 2, 0.28);
    geom.translate(center.x, center.y, 0);
    return geom;
  }
  const geom = new THREE.SphereGeometry(r, 20, 16);
  geom.translate(center.x, center.y, 0);
  return geom;
}

function strokeBounds(stroke: Stroke) {
  const xs = stroke.points.map((p) => p.x);
  const ys = stroke.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  return {
    minX,
    maxX,
    minY,
    maxY,
    w,
    h,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: w / 2,
    ry: h / 2,
    aspect: Math.max(w, h) / Math.min(w, h),
  };
}

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function perimeter(points: Point[]): number {
  let len = 0;
  const n = points.length;
  const closed = n > 2;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function farthestPair(points: Point[]): { a: Point; b: Point; dist: number } {
  let a = points[0];
  let b = points[points.length - 1];
  let best = 0;
  const n = points.length;
  // Cap pairwise search for long strokes
  const step = n > 40 ? Math.ceil(n / 40) : 1;
  for (let i = 0; i < n; i += step) {
    for (let j = i + step; j < n; j += step) {
      const d = Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
      if (d > best) {
        best = d;
        a = points[i];
        b = points[j];
      }
    }
  }
  return { a, b, dist: best || 1 };
}

function maxDeviationFromAxis(points: Point[], a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLen2 = abx * abx + aby * aby || 1;
  let maxDev = 0;
  for (const p of points) {
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / abLen2));
    const qx = a.x + t * abx;
    const qy = a.y + t * aby;
    maxDev = Math.max(maxDev, Math.hypot(p.x - qx, p.y - qy));
  }
  return maxDev;
}

function isRoundShape(stroke: Stroke): boolean {
  if (stroke.tool === 'ellipse') return true;
  if (stroke.tool === 'rect') return false;
  if (stroke.points.length < 5) return false;

  const { w, h, aspect } = strokeBounds(stroke);
  if (aspect > 1.65) return false;

  const area = polygonArea(stroke.points);
  const peri = perimeter(stroke.points);
  if (peri < 1) return false;

  const circularity = (4 * Math.PI * area) / (peri * peri);
  const fillRatio = area / (w * h);

  // Circle: circularity ≈ 1.0, fill ≈ 0.785
  if (circularity >= 0.72 && fillRatio <= 0.92 && aspect <= 1.45) return true;
  // Loose hand-drawn loop
  if (circularity >= 0.55 && fillRatio >= 0.35 && fillRatio <= 0.88 && aspect <= 1.4) {
    return true;
  }

  return false;
}

function isRectangular(stroke: Stroke): boolean {
  if (stroke.tool === 'rect') return true;
  if (stroke.points.length < 4) return false;

  const { w, h, aspect } = strokeBounds(stroke);
  if (aspect > 4) return false;

  const area = polygonArea(stroke.points);
  const peri = perimeter(stroke.points);
  if (peri < 1) return false;

  const circularity = (4 * Math.PI * area) / (peri * peri);
  const fillRatio = area / (w * h);

  // Don't call a circle a rectangle
  if (circularity >= 0.85) return false;

  // Squares/blocks fill most of their bounding box
  return fillRatio >= 0.86;
}

function isLineLikeStroke(stroke: Stroke): boolean {
  if (stroke.tool === 'line') return true;
  if (stroke.points.length < 2) return false;

  const { w, h, aspect } = strokeBounds(stroke);
  const { a, b, dist: best } = farthestPair(stroke.points);
  const pathLen = pathLength(stroke.points);
  if (pathLen < 2) return false;

  const maxDev = maxDeviationFromAxis(stroke.points, a, b);
  const thinEnough = maxDev <= Math.max(stroke.width * 2.2, best * 0.2, 8);

  // Stick / limb: thin along a main axis
  if (thinEnough && (aspect >= 1.45 || best > pathLen * 0.55)) return true;

  // Open pen stroke that doesn't close into a blob
  if (!stroke.closed && stroke.tool === 'pen') {
    const endGap = Math.hypot(
      stroke.points[0].x - stroke.points[stroke.points.length - 1].x,
      stroke.points[0].y - stroke.points[stroke.points.length - 1].y,
    );
    if (endGap > best * 0.35 && thinEnough) return true;
  }

  if (stroke.points.length >= 3) {
    const area = polygonArea(stroke.points);
    const fillRatio = area / (w * h);
    if (fillRatio < 0.28 && aspect >= 1.35) return true;
  }

  return false;
}

/** Depth in world units — manual uses the slider; auto sizes from the stroke. */
function resolveDepth(
  stroke: Stroke,
  config: AssetTypeConfig,
  options: ConversionOptions,
): number {
  const userDepth = Math.max(0.05, options.depth);

  if (options.depthMode === 'manual') {
    return userDepth;
  }

  const { w, h } = strokeBounds(stroke);
  const size = Math.sqrt(w * h) / CANVAS_SIZE;
  const base = config.defaultDepth || 0.45;
  const scale = userDepth / base;

  switch (config.id) {
    case 'buildings':
      return THREE.MathUtils.clamp(userDepth * (0.7 + size) * scale, 0.2, 4);
    case 'vehicles':
      return THREE.MathUtils.clamp((Math.max(h, w) / CANVAS_SIZE) * 2.2 * scale, 0.15, 3);
    case 'furniture':
      return THREE.MathUtils.clamp((Math.min(w, h) / CANVAS_SIZE) * 1.8 * scale, 0.1, 2);
    case 'shoes':
      return THREE.MathUtils.clamp((h / CANVAS_SIZE) * 2.4 * scale, 0.1, 2);
    case 'jewellery':
      return userDepth;
    case 'plushies':
      return THREE.MathUtils.clamp(size * 1.1 * scale, 0.1, 1.2);
    case 'characters':
    default:
      return THREE.MathUtils.clamp(size * 0.95 * scale, 0.1, 1.2);
  }
}

function classifyStroke(stroke: Stroke, config: AssetTypeConfig, mode: 'extrude' | 'lathe'): ShapeRole {
  if (isDotStroke(stroke)) return 'sphere';

  if (mode === 'lathe' && config.id === 'jewellery' && stroke.tool !== 'line') {
    return 'lathe';
  }

  // Explicit tools win first
  if (stroke.tool === 'ellipse') return 'sphere';
  if (stroke.tool === 'rect') {
    const { aspect } = strokeBounds(stroke);
    if (
      aspect >= 2.2 &&
      (config.id === 'characters' || config.id === 'plushies')
    ) {
      return 'capsule';
    }
    return 'box';
  }

  if (stroke.tool === 'line' || isLineLikeStroke(stroke)) return 'capsule';

  // Round before blocky — circles fill ~78% of bbox and used to look "rectangular"
  if (isRoundShape(stroke)) return 'sphere';

  if (isRectangular(stroke)) {
    const { aspect } = strokeBounds(stroke);
    if (
      aspect >= 2.2 &&
      (config.id === 'characters' || config.id === 'plushies')
    ) {
      return 'capsule';
    }
    return 'box';
  }
  // Open freehand that isn't a stick → tube (rope / antenna / outline)
  if (
    stroke.tool === 'pen' &&
    !stroke.closed &&
    stroke.points.length >= 4 &&
    !isLineLikeStroke(stroke)
  ) {
    const { dist } = farthestPair(stroke.points);
    const endGap = Math.hypot(
      stroke.points[0].x - stroke.points[stroke.points.length - 1].x,
      stroke.points[0].y - stroke.points[stroke.points.length - 1].y,
    );
    if (endGap > dist * 0.25) return 'tube';
  }

  return 'extrude';
}

function strokeToShape(stroke: Stroke): THREE.Shape | null {
  if (stroke.points.length < 3) return null;
  const shape = new THREE.Shape();
  const pts = stroke.points.map(toShapeSpace);
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
  shape.closePath();
  return shape;
}

function insetShapeHole(shape: THREE.Shape, inset = 0.82): void {
  const pts = shape.getPoints(48);
  if (pts.length < 3) return;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;

  const hole = new THREE.Path();
  pts.forEach((p, i) => {
    const x = cx + (p.x - cx) * inset;
    const y = cy + (p.y - cy) * inset;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  });
  hole.closePath();
  shape.holes.push(hole);
}

function hollowBoxGeometry(sx: number, sy: number, sz: number, wallRatio = 0.2): THREE.BufferGeometry {
  const wall = Math.min(sx, sy) * THREE.MathUtils.clamp(wallRatio, 0.1, 0.4);
  const hx = sx / 2;
  const hy = sy / 2;
  const ix = Math.max(hx - wall, hx * 0.2);
  const iy = Math.max(hy - wall, hy * 0.2);

  const outer = new THREE.Shape();
  outer.moveTo(-hx, -hy);
  outer.lineTo(hx, -hy);
  outer.lineTo(hx, hy);
  outer.lineTo(-hx, hy);
  outer.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-ix, -iy);
  hole.lineTo(-ix, iy);
  hole.lineTo(ix, iy);
  hole.lineTo(ix, -iy);
  hole.closePath();
  outer.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(outer, {
    depth: sz,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geom.translate(0, 0, -sz / 2);
  return geom;
}

/** Hollow disc / ring — clearly see-through (opaque shells look solid from outside). */
function hollowRoundGeometry(sx: number, sy: number, sz: number, wallRatio = 0.22): THREE.BufferGeometry {
  const rx = sx / 2;
  const ry = sy / 2;
  const inset = 1 - THREE.MathUtils.clamp(wallRatio, 0.12, 0.45);
  const segments = 48;

  const outer = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    if (i === 0) outer.moveTo(x, y);
    else outer.lineTo(x, y);
  }
  outer.closePath();

  const hole = new THREE.Path();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * rx * inset;
    const y = Math.sin(a) * ry * inset;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  hole.closePath();
  outer.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(outer, {
    depth: sz,
    bevelEnabled: false,
    curveSegments: segments,
  });
  geom.translate(0, 0, -sz / 2);
  return geom;
}

/**
 * Round edges only softens corners — outer width/height/depth stay fixed.
 * Hollow builds an open shell with the same outer bounds.
 */
function toBoxSphereMorph(
  stroke: Stroke,
  config: AssetTypeConfig,
  options: ConversionOptions,
): THREE.BufferGeometry {
  const t = getEffectiveRoundness(stroke, options.bevelAmount);
  const { cx, cy, w, h } = strokeBounds(stroke);
  const center = toShapeSpace({ x: cx, y: cy });
  const sx = Math.max((w / CANVAS_SIZE) * 2, 0.04);
  const sy = Math.max((h / CANVAS_SIZE) * 2, 0.04);
  const sz = Math.max(resolveDepth(stroke, config, options), 0.05);
  const hollow = Boolean(options.hollow);

  if (hollow) {
    const roundLike = t >= 0.72 || stroke.tool === 'ellipse' || isRoundShape(stroke);
    const geom = roundLike
      ? hollowRoundGeometry(sx, sy, sz)
      : hollowBoxGeometry(sx, sy, sz);
    geom.translate(center.x, center.y, 0);
    return geom;
  }

  if (t <= 0.02) {
    const geom = new THREE.BoxGeometry(sx, sy, sz);
    geom.translate(center.x, center.y, 0);
    return geom;
  }

  if (t >= 0.98 && (stroke.tool === 'ellipse' || isRoundShape(stroke))) {
    const geom = new THREE.SphereGeometry(1, 28, 20);
    geom.scale(sx / 2, sy / 2, sz / 2);
    geom.translate(center.x, center.y, 0);
    return geom;
  }

  const maxR = Math.min(sx, sy, sz) * 0.5;
  const radius = Math.min(Math.max(t * maxR, 0.001), maxR * 0.999);
  const geom = new RoundedBoxGeometry(sx, sy, sz, 6, radius);
  geom.translate(center.x, center.y, 0);
  return geom;
}

function toCapsuleGeometry(stroke: Stroke, limbThickness: number): THREE.BufferGeometry {
  const { a, b } = farthestPair(stroke.points);
  const A = toShapeSpace(a);
  const B = toShapeSpace(b);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 0.05;

  const radius = Math.max((stroke.width / CANVAS_SIZE) * 1.75 * limbThickness, 0.025);
  const geom = new THREE.CapsuleGeometry(radius, Math.max(len - radius * 2, 0.02), 5, 10);
  const angle = Math.atan2(dy, dx) - Math.PI / 2;
  geom.rotateZ(angle);
  geom.translate((A.x + B.x) / 2, (A.y + B.y) / 2, 0);
  return geom;
}

function toTubeGeometry(stroke: Stroke, limbThickness: number): THREE.BufferGeometry | null {
  if (stroke.points.length < 2) return null;
  const pts = stroke.points.map((p) => {
    const v = toShapeSpace(p);
    return new THREE.Vector3(v.x, v.y, 0);
  });
  const curve = new THREE.CatmullRomCurve3(pts);
  const radius = Math.max((stroke.width / CANVAS_SIZE) * 1.2 * limbThickness, 0.02);
  return new THREE.TubeGeometry(curve, Math.min(stroke.points.length * 2, 64), radius, 8, false);
}

function softExtrude(
  shape: THREE.Shape,
  config: AssetTypeConfig,
  depth: number,
  bevelAmount: number,
  hollow = false,
): THREE.BufferGeometry {
  if (hollow) {
    insetShapeHole(shape, 0.78);
  }
  const roundness = THREE.MathUtils.clamp(bevelAmount, 0, 1);
  const bevel =
    !hollow && roundness > 0.001
      ? Math.min(Math.max(roundness * depth * 0.4, 0.01), depth * 0.35)
      : 0;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: Math.max(config.bevelSegments, 2),
    curveSegments: 10,
  });
  geom.translate(0, 0, -depth / 2);
  return geom;
}

function toLatheGeometry(stroke: Stroke, latheSegments: number): THREE.BufferGeometry | null {
  const shape = strokeToShape({ ...stroke, closed: true });
  if (!shape) return null;
  const points = shape.getPoints(64);
  // Profile: use right half (x >= 0) as radius
  const lathePoints = points
    .map((p) => new THREE.Vector2(Math.abs(p.x), p.y))
    .filter((p, i, arr) => i === 0 || p.distanceTo(arr[i - 1]) > 0.002);
  if (lathePoints.length < 2) return null;
  return new THREE.LatheGeometry(lathePoints, latheSegments);
}

/**
 * Buildings are drawn as a top-down floor plan → extrude upward (Y).
 * Rotate extruded geometry from Z-up extrusion into Y-up walls.
 */
function orientForAsset(
  geom: THREE.BufferGeometry,
  config: AssetTypeConfig,
  role: ShapeRole,
): THREE.BufferGeometry {
  if (config.id === 'buildings' && (role === 'extrude' || role === 'box')) {
    // Extrude was in +Z; map drawing XY → XZ floor, extrusion → Y height
    geom.rotateX(-Math.PI / 2);
  }
  return geom;
}

function strokeToGeometry(
  stroke: Stroke,
  config: AssetTypeConfig,
  mode: 'extrude' | 'lathe',
  options: ConversionOptions,
  latheSegments: number,
): THREE.BufferGeometry | null {
  const role = classifyStroke(stroke, config, mode);
  const d = resolveDepth(stroke, config, options);
  let geom: THREE.BufferGeometry | null = null;

  switch (role) {
    case 'sphere':
      geom = isDotStroke(stroke)
        ? toDotGeometry(stroke, options)
        : toBoxSphereMorph(stroke, config, options);
      break;
    case 'box':
      geom = toBoxSphereMorph(stroke, config, options);
      break;
    case 'capsule':
      geom = options.hollow
        ? toTubeGeometry(stroke, options.limbThickness) ?? toCapsuleGeometry(stroke, options.limbThickness)
        : toCapsuleGeometry(stroke, options.limbThickness);
      break;
    case 'tube':
      geom = toTubeGeometry(stroke, options.limbThickness);
      break;
    case 'lathe':
      geom = toLatheGeometry(stroke, latheSegments);
      break;
    case 'extrude': {
      let shape: THREE.Shape | null = null;
      if (stroke.closed && stroke.points.length >= 3) {
        shape = strokeToShape(stroke);
      } else if (stroke.tool === 'pen' && stroke.points.length >= 3) {
        shape = strokeToShape({ ...stroke, closed: true });
      } else if (stroke.tool === 'rect' || stroke.tool === 'ellipse') {
        shape = strokeToShape({ ...stroke, closed: true });
      }
      if (!shape) {
        geom = toCapsuleGeometry(stroke, options.limbThickness);
        break;
      }
      if (mode === 'lathe' && config.id === 'jewellery') {
        geom = toLatheGeometry(stroke, latheSegments);
      } else {
        geom = softExtrude(shape, config, d, options.bevelAmount, Boolean(options.hollow));
      }
      break;
    }
  }

  if (!geom) return null;
  const sized = orientForAsset(geom, config, role);
  const scale = THREE.MathUtils.clamp(options.sizeScale ?? 1, 0.15, 4);
  if (Math.abs(scale - 1) > 0.001) {
    sized.scale(scale, scale, scale);
  }
  return sized;
}

export function buildGeometryFromStrokes(
  strokes: Stroke[],
  config: AssetTypeConfig,
  mode: 'extrude' | 'lathe',
  options: ConversionOptions,
  latheSegments: number,
): THREE.BufferGeometry {
  const parts = buildStrokeGeometries(strokes, config, mode, options, latheSegments);
  if (parts.length === 0) {
    return new THREE.BufferGeometry();
  }
  if (parts.length === 1) return parts[0].geometry;
  return mergeGeometries(parts.map((p) => p.geometry));
}

export interface StrokeGeometryPart {
  geometry: THREE.BufferGeometry;
  color: string;
  strokeId: string;
}

export function buildStrokeGeometries(
  strokes: Stroke[],
  config: AssetTypeConfig,
  mode: 'extrude' | 'lathe',
  options: ConversionOptions,
  latheSegments: number,
): StrokeGeometryPart[] {
  const renderable = getRenderableStrokes(strokes);
  const parts: StrokeGeometryPart[] = [];

  for (const stroke of renderable) {
    const resolved = resolveStrokeOptions(stroke, options);
    const geom = strokeToGeometry(stroke, config, mode, resolved, latheSegments);
    if (geom) parts.push({ geometry: geom, color: stroke.color, strokeId: stroke.id });
  }

  if (parts.length === 0) return parts;

  const merged = mergeGeometries(parts.map((p) => p.geometry.clone()));
  merged.computeBoundingBox();
  const box = merged.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const ox = -center.x;
  const oy = -box.min.y;
  const oz = -center.z;
  merged.dispose();

  for (const part of parts) {
    part.geometry.translate(ox, oy, oz);
  }

  return parts;
}

function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const geom of geoms) {
    geom.computeVertexNormals();
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const uv = geom.getAttribute('uv');
    const idx = geom.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    }

    vertexOffset += pos.count;
    geom.dispose();
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (indices.length) merged.setIndex(indices);
  merged.computeBoundingBox();
  return merged;
}

/** Merge without disposing inputs (for export clones). */
export function mergeGeometriesForExport(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const geom of geoms) {
    geom.computeVertexNormals();
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const uv = geom.getAttribute('uv');
    const idx = geom.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(norm ? norm.getX(i) : 0, norm ? norm.getY(i) : 1, norm ? norm.getZ(i) : 0);
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(vertexOffset + i);
    }

    vertexOffset += pos.count;
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (indices.length) merged.setIndex(indices);
  merged.computeBoundingBox();
  return merged;
}

export function centerGeometry(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  geom.translate(-center.x, -box.min.y, -center.z);
  return geom;
}

export { CANVAS_SIZE };
