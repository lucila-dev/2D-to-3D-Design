import type { Point, Stroke } from '../types';

export const CANVAS_SIZE = 400;

/** Convert pointer position to canvas pixel coords (canvas bitmap is stretched to element box). */
export function pointerToCanvas(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return { x: 0, y: 0 };
  }
  return {
    x: clamp(((clientX - rect.left) / rect.width) * CANVAS_SIZE, 0, CANVAS_SIZE),
    y: clamp(((clientY - rect.top) / rect.height) * CANVAS_SIZE, 0, CANVAS_SIZE),
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function buildShapePoints(
  tool: Stroke['tool'],
  start: Point,
  end: Point,
): Point[] {
  if (tool === 'line') return [start, end];
  if (tool === 'rect') {
    const x1 = Math.min(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const x2 = Math.max(start.x, end.x);
    const y2 = Math.max(start.y, end.y);
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  }
  if (tool === 'ellipse') {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const pts: Point[] = [];
    for (let i = 0; i <= 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
    }
    return pts;
  }
  return [start, end];
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 1) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.width;

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = stroke.color;
    ctx.strokeStyle = stroke.color;
  }

  if (stroke.tool === 'rect' && stroke.points.length >= 2) {
    const xs = stroke.points.map((p) => p.x);
    const ys = stroke.points.map((p) => p.y);
    const x1 = Math.min(...xs);
    const y1 = Math.min(...ys);
    const x2 = Math.max(...xs);
    const y2 = Math.max(...ys);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  } else if (stroke.tool === 'ellipse' && stroke.points.length >= 2) {
    const xs = stroke.points.map((p) => p.x);
    const ys = stroke.points.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rx = Math.max((Math.max(...xs) - Math.min(...xs)) / 2, 0.5);
    const ry = Math.max((Math.max(...ys) - Math.min(...ys)) / 2, 0.5);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (stroke.tool === 'line' && stroke.points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y);
    ctx.stroke();
  } else if (stroke.points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    if (stroke.closed) ctx.closePath();
    if (stroke.closed) ctx.fill();
    else ctx.stroke();
  } else if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function renderCanvasBackground(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= CANVAS_SIZE; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(CANVAS_SIZE, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(232,121,169,0.22)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(CANVAS_SIZE / 2, 0);
  ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
  ctx.moveTo(0, CANVAS_SIZE / 2);
  ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  selectedId?: string | null,
  selectedIds?: string[],
) {
  renderCanvasBackground(ctx);
  for (const stroke of strokes) drawStroke(ctx, stroke);
  const ids = selectedIds?.length ? selectedIds : selectedId ? [selectedId] : [];
  for (const id of ids) {
    const selected = strokes.find((s) => s.id === id);
    if (selected) drawSelectionOutline(ctx, selected);
  }
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function strokeBounds2D(stroke: Stroke) {
  const xs = stroke.points.map((p) => p.x);
  const ys = stroke.points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function strokeHitTest(stroke: Stroke, point: Point): boolean {
  if (stroke.tool === 'eraser' || stroke.color === 'transparent' || stroke.points.length < 1) {
    return false;
  }

  const pad = Math.max(stroke.width * 2, 14);
  const b = strokeBounds2D(stroke);

  // Generous bounding-box hit — primary so separate shapes are easy to click
  if (
    point.x >= b.minX - pad &&
    point.x <= b.maxX + pad &&
    point.y >= b.minY - pad &&
    point.y <= b.maxY + pad
  ) {
    // Thin lines: require near-segment so empty bbox corners don't steal clicks
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const thin = Math.min(w, h) < pad * 1.5 || stroke.tool === 'line' || (!stroke.closed && stroke.tool === 'pen');
    if (!thin) return true;

    if (stroke.tool === 'ellipse') {
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const rx = Math.max(w / 2, 1) + pad;
      const ry = Math.max(h / 2, 1) + pad;
      const nx = (point.x - cx) / rx;
      const ny = (point.y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }

    for (let i = 1; i < stroke.points.length; i++) {
      if (distToSegment(point, stroke.points[i - 1], stroke.points[i]) <= pad) return true;
    }
    if (stroke.points.length === 1) {
      return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) <= pad;
    }
    return false;
  }

  return false;
}

/** Topmost matching stroke (last drawn wins). */
export function hitTestStroke(strokes: Stroke[], point: Point): Stroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (strokeHitTest(strokes[i], point)) return strokes[i];
  }
  return null;
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 1) return;
  const b = strokeBounds2D(stroke);
  const pad = Math.max(stroke.width, 6) + 6;
  const x = b.minX - pad;
  const y = b.minY - pad;
  const w = Math.max(b.maxX - b.minX + pad * 2, 10);
  const h = Math.max(b.maxY - b.minY + pad * 2, 10);

  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = '#e879a9';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x, y, w, h);

  const hs = 6;
  ctx.fillStyle = '#e879a9';
  ctx.setLineDash([]);
  for (const [hx, hy] of [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ] as const) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
  ctx.restore();
}
