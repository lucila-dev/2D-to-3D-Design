import { useCallback, useEffect, useRef, useState } from 'react';
import { useDesignStore } from '../store/designStore';
import {
  CANVAS_SIZE,
  brushPctToWidth,
  buildShapePoints,
  renderAllStrokes,
  drawStroke,
  hitTestStroke,
} from '../utils/drawingUtils';
import type { Point, Stroke } from '../types';

const DRAG_THRESHOLD = 6;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Map pointer → canvas world coords under zoom/pan (origin at canvas center). */
function pointerToWorld(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  zoom: number,
  pan: Point,
): Point {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return { x: 0, y: 0 };
  const sx = ((clientX - rect.left) / rect.width) * CANVAS_SIZE;
  const sy = ((clientY - rect.top) / rect.height) * CANVAS_SIZE;
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  return {
    x: clamp((sx - cx - pan.x) / zoom + cx, -CANVAS_SIZE, CANVAS_SIZE * 2),
    y: clamp((sy - cy - pan.y) / zoom + cy, -CANVAS_SIZE, CANVAS_SIZE * 2),
  };
}

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useDesignStore((s) => s.strokes);
  const selectedStrokeId = useDesignStore((s) => s.selectedStrokeId);
  const selectedStrokeIds = useDesignStore((s) => s.selectedStrokeIds);
  const currentTool = useDesignStore((s) => s.currentTool);
  const assetType = useDesignStore((s) => s.assetType);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const drawingRef = useRef(false);
  const panningRef = useRef(false);
  const panLastRef = useRef<Point | null>(null);
  const spaceDownRef = useRef(false);
  const movingRef = useRef(false);
  const moveLastRef = useRef<Point | null>(null);
  const moveTotalRef = useRef({ x: 0, y: 0 });
  const activeIdRef = useRef<string | null>(null);
  const activePointsRef = useRef<Point[]>([]);
  const startPointRef = useRef<Point | null>(null);
  const pendingSelectRef = useRef<{ id: string; start: Point } | null>(null);

  const paintFrame = useCallback((extra?: Stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = useDesignStore.getState();
    const z = zoomRef.current;
    const p = panRef.current;
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1216';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.translate(cx + p.x, cy + p.y);
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);

    renderAllStrokes(ctx, state.strokes, state.selectedStrokeId, state.selectedStrokeIds);
    if (extra) drawStroke(ctx, extra);
  }, []);

  useEffect(() => {
    paintFrame();
  }, [strokes, selectedStrokeId, selectedStrokeIds, zoom, pan, paintFrame]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement> | WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return pointerToWorld(e.clientX, e.clientY, canvas, zoomRef.current, panRef.current);
  };

  const startStrokeAt = (pos: Point) => {
    const { currentTool, brushColor, brushSize, addStroke } = useDesignStore.getState();
    const width = brushPctToWidth(brushSize);
    drawingRef.current = true;
    pendingSelectRef.current = null;
    startPointRef.current = pos;
    activePointsRef.current = [pos];

    if (currentTool === 'pen' || currentTool === 'eraser') {
      const id = addStroke({
        points: [pos],
        color: currentTool === 'eraser' ? 'transparent' : brushColor,
        width: currentTool === 'eraser' ? width * 3 : width,
        tool: currentTool,
        closed: false,
      });
      activeIdRef.current = id;
    } else if (currentTool !== 'select') {
      const id = addStroke({
        points: buildShapePoints(currentTool, pos, pos),
        color: brushColor,
        width,
        tool: currentTool,
        closed: currentTool !== 'line',
      });
      activeIdRef.current = id;
    }
    paintFrame();
  };

  const beginPointer = (pos: Point, additive: boolean) => {
    const state = useDesignStore.getState();
    const { currentTool, selectStroke } = state;
    const hit = hitTestStroke(state.strokes, pos);

    if (currentTool === 'select') {
      if (hit) {
        const already = state.selectedStrokeIds.includes(hit.id);
        if (!already || additive) selectStroke(hit.id, additive);
        else if (!additive) selectStroke(hit.id, false);
        movingRef.current = true;
        moveLastRef.current = pos;
        moveTotalRef.current = { x: 0, y: 0 };
      } else {
        selectStroke(null);
      }
      paintFrame();
      return;
    }

    if (currentTool !== 'eraser' && hit) {
      pendingSelectRef.current = { id: hit.id, start: pos };
      startPointRef.current = pos;
      return;
    }

    startStrokeAt(pos);
  };

  const continueDraw = (pos: Point) => {
    if (movingRef.current && moveLastRef.current) {
      const dx = pos.x - moveLastRef.current.x;
      const dy = pos.y - moveLastRef.current.y;
      moveLastRef.current = pos;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
      moveTotalRef.current.x += dx;
      moveTotalRef.current.y += dy;
      const store = useDesignStore.getState();
      const ids = store.getTransformTargetIds();
      if (ids.length > 0) {
        store.translateStrokes(ids, dx, dy, false);
        paintFrame();
      }
      return;
    }

    const pending = pendingSelectRef.current;
    if (pending && !drawingRef.current) {
      const dist = Math.hypot(pos.x - pending.start.x, pos.y - pending.start.y);
      if (dist >= DRAG_THRESHOLD) {
        startStrokeAt(pending.start);
      } else {
        return;
      }
    }

    if (!drawingRef.current || !activeIdRef.current) return;
    const { currentTool, brushColor, brushSize, updateStroke } = useDesignStore.getState();
    const width = brushPctToWidth(brushSize);

    if (currentTool === 'pen' || currentTool === 'eraser') {
      const last = activePointsRef.current[activePointsRef.current.length - 1];
      if (last && Math.hypot(pos.x - last.x, pos.y - last.y) < 1.2) return;

      activePointsRef.current.push(pos);
      updateStroke(activeIdRef.current, [...activePointsRef.current]);

      paintFrame({
        id: 'preview',
        points: activePointsRef.current,
        color: currentTool === 'eraser' ? 'transparent' : brushColor,
        width: currentTool === 'eraser' ? width * 3 : width,
        tool: currentTool,
        closed: false,
      });
    } else if (startPointRef.current) {
      const pts = buildShapePoints(currentTool, startPointRef.current, pos);
      activePointsRef.current = pts;
      updateStroke(activeIdRef.current, pts);
      paintFrame({
        id: 'preview',
        points: pts,
        color: brushColor,
        width,
        tool: currentTool,
        closed: currentTool !== 'line',
      });
    }
  };

  const endDraw = (additive: boolean) => {
    if (movingRef.current) {
      if (Math.hypot(moveTotalRef.current.x, moveTotalRef.current.y) >= 1) {
        useDesignStore.getState().commitStrokeEdit();
      }
      movingRef.current = false;
      moveLastRef.current = null;
      moveTotalRef.current = { x: 0, y: 0 };
      paintFrame();
      return;
    }

    const pending = pendingSelectRef.current;
    if (pending && !drawingRef.current) {
      useDesignStore.getState().selectStroke(pending.id, additive);
      pendingSelectRef.current = null;
      startPointRef.current = null;
      paintFrame();
      return;
    }

    if (!drawingRef.current) return;
    const id = activeIdRef.current;
    const pts = activePointsRef.current;
    const { currentTool, finalizeStroke } = useDesignStore.getState();

    if (id) {
      if (currentTool === 'pen' || currentTool === 'eraser') {
        let shouldClose = false;
        if (currentTool === 'pen' && pts.length >= 4) {
          const xs = pts.map((p) => p.x);
          const ys = pts.map((p) => p.y);
          const w = Math.max(...xs) - Math.min(...xs) || 1;
          const h = Math.max(...ys) - Math.min(...ys) || 1;
          const closeGap = Math.hypot(
            pts[pts.length - 1].x - pts[0].x,
            pts[pts.length - 1].y - pts[0].y,
          );
          // Close into a filled shape whenever the stroke loops back near the start
          shouldClose = closeGap < Math.max(Math.min(w, h) * 0.55, brushPctToWidth(useDesignStore.getState().brushSize) * 4, 18);
        }
        finalizeStroke(id, shouldClose);
      } else if (currentTool === 'line' && pts.length >= 2) {
        finalizeStroke(id, true);
      } else if (currentTool === 'rect' || currentTool === 'ellipse') {
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        if (w < 3 && h < 3) {
          useDesignStore.getState().removeStroke(id);
        } else {
          finalizeStroke(id, true);
        }
      }
    }

    drawingRef.current = false;
    pendingSelectRef.current = null;
    activeIdRef.current = null;
    activePointsRef.current = [];
    startPointRef.current = null;
    paintFrame();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.button === 1 || e.button === 2 || spaceDownRef.current) {
      panningRef.current = true;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    if (e.button !== 0) return;
    beginPointer(toWorld(e), e.shiftKey);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panningRef.current && panLastRef.current) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scale = CANVAS_SIZE / Math.max(rect.width, 1);
      const dx = (e.clientX - panLastRef.current.x) * scale;
      const dy = (e.clientY - panLastRef.current.y) * scale;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }
    if (!drawingRef.current && !pendingSelectRef.current && !movingRef.current) return;
    e.preventDefault();
    continueDraw(toWorld(e));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (panningRef.current) {
      panningRef.current = false;
      panLastRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    endDraw(e.shiftKey);
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const oldZ = zoomRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZ = clamp(oldZ * factor, MIN_ZOOM, MAX_ZOOM);
    const p = panRef.current;
    // Keep world point under cursor stable
    const worldX = (sx - cx - p.x) / oldZ + cx;
    const worldY = (sy - cy - p.y) / oldZ + cy;
    const newPan = {
      x: sx - cx - (worldX - cx) * newZ,
      y: sy - cy - (worldY - cy) * newZ,
    };
    setZoom(newZ);
    setPan(newPan);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const shapeCount = strokes.filter(
    (s) => s.tool !== 'eraser' && s.color !== 'transparent',
  ).length;

  return (
    <div className="drawing-canvas-wrap">
      <div className="canvas-label">
        <span>2D Canvas</span>
        <div className="canvas-zoom-controls">
          <button type="button" className="zoom-btn" onClick={() => setZoom((z) => clamp(z / 1.2, MIN_ZOOM, MAX_ZOOM))} title="Zoom out">
            −
          </button>
          <button type="button" className="zoom-btn zoom-label" onClick={resetView} title="Reset view">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="zoom-btn" onClick={() => setZoom((z) => clamp(z * 1.2, MIN_ZOOM, MAX_ZOOM))} title="Zoom in">
            +
          </button>
        </div>
        <span className="canvas-hint">
          {currentTool === 'select'
            ? selectedStrokeIds.length > 0
              ? 'Drag to move · Shift+click multi'
              : 'Click a shape to move'
            : selectedStrokeId
              ? 'Selected — scroll to zoom'
              : shapeCount > 0
                ? 'Scroll zoom · space+drag pan'
                : assetType}
        </span>
      </div>
      <div className="canvas-area">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className={`drawing-canvas ${currentTool === 'select' ? 'select-mode' : ''} ${panningRef.current ? 'panning' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}
