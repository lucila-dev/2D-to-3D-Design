import { useCallback, useEffect, useRef } from 'react';

interface ColorWheelProps {
  color: string;
  onChange: (hex: string) => void;
  size?: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max < 1e-6 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

function hsvToHex(h: number, s: number, v: number): string {
  const [r, g, b] = hsvToRgb(h, s, v);
  const to = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function ColorWheel({ color, onChange, size = 148 }: ColorWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<ImageData | null>(null);
  const dragging = useRef(false);
  const hsvRef = useRef(hexToHsv(color));

  useEffect(() => {
    hsvRef.current = hexToHsv(color);
  }, [color]);

  const ensureRing = useCallback(
    (ctx: CanvasRenderingContext2D, px: number) => {
      if (ringRef.current && ringRef.current.width === px) return ringRef.current;
      const img = ctx.createImageData(px, px);
      const cx = px / 2;
      const cy = px / 2;
      const outerR = px / 2 - 2;
      const innerR = outerR * 0.62;
      for (let y = 0; y < px; y++) {
        for (let x = 0; x < px; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.hypot(dx, dy);
          if (dist > outerR || dist < innerR) continue;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const hue = (angle + 360) % 360;
          const sat = (dist - innerR) / (outerR - innerR);
          const [r, g, b] = hsvToRgb(hue, sat, 1);
          const i = (y * px + x) * 4;
          img.data[i] = Math.round(r * 255);
          img.data[i + 1] = Math.round(g * 255);
          img.data[i + 2] = Math.round(b * 255);
          img.data[i + 3] = 255;
        }
      }
      ringRef.current = img;
      return img;
    },
    [],
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
      ringRef.current = null;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.putImageData(ensureRing(ctx, px), 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 2;
    const innerR = outerR * 0.62;
    const discR = innerR - 6;
    const { h, s, v } = hsvRef.current;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, discR);
    const pure = hsvToHex(h, 1, 1);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, pure);
    grad.addColorStop(1, '#000000');
    ctx.beginPath();
    ctx.arc(cx, cy, discR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    const ringDist = innerR + s * (outerR - innerR);
    const rad = (h * Math.PI) / 180;
    const mx = cx + Math.cos(rad) * ringDist;
    const my = cy + Math.sin(rad) * ringDist;
    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    const vx = cx + (s * 2 - 1) * discR * 0.55;
    const vy = cy + (1 - v) * discR * 0.85 - discR * 0.15;
    const vDist = Math.min(Math.hypot(vx - cx, vy - cy), discR - 4);
    const vAng = Math.atan2(vy - cy, vx - cx);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(vAng) * vDist, cy + Math.sin(vAng) * vDist, 4, 0, Math.PI * 2);
    ctx.fillStyle = hsvToHex(h, s, v);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [ensureRing, size]);

  useEffect(() => {
    paint();
  }, [color, paint]);

  const pick = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * size;
    const y = ((clientY - rect.top) / rect.height) * size;
    const cx = size / 2;
    const cy = size / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    const outerR = size / 2 - 2;
    const innerR = outerR * 0.62;
    const discR = innerR - 6;
    const cur = { ...hsvRef.current };

    if (dist <= discR) {
      const nx = dx / discR;
      const ny = dy / discR;
      cur.s = clamp(Math.hypot(nx, ny) * 1.15, 0, 1);
      cur.v = clamp(1 - (ny * 0.5 + 0.5) * 0.85, 0.05, 1);
    } else if (dist <= outerR + 4) {
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      cur.h = (angle + 360) % 360;
      cur.s = clamp((dist - innerR) / (outerR - innerR), 0.05, 1);
      if (cur.v < 0.15) cur.v = 0.85;
    } else {
      return;
    }

    hsvRef.current = cur;
    onChange(hsvToHex(cur.h, cur.s, cur.v));
    paint();
  };

  return (
    <canvas
      ref={canvasRef}
      className="color-wheel"
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        pick(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    />
  );
}
