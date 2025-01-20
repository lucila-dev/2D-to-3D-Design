import type { Stroke } from '../types';
import { CANVAS_SIZE, drawStroke } from './drawingUtils';

/**
 * High-contrast silhouette for image-to-3D.
 * AI models work much better with solid black shapes on white than colored blocks.
 */
export function strokesToImageDataUrl(strokes: Stroke[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (const stroke of strokes) {
    if (stroke.tool === 'eraser') continue;
    drawStroke(ctx, {
      ...stroke,
      color: '#111827',
      width: Math.max(stroke.width, 8),
      closed: stroke.tool === 'line' ? false : true,
    });
  }

  return canvas.toDataURL('image/png');
}

export type GenerateQuality = 'draft' | 'enhance';
export type GenerateMode = 'text' | 'sketch';

export type GenerateResult = {
  modelUrl: string;
  format: 'glb' | 'obj';
  mtlUrl?: string | null;
  textureUrl?: string | null;
  model: string;
};

export async function generateAi3D(options: {
  mode: GenerateMode;
  prompt?: string;
  imageDataUrl?: string;
  quality?: GenerateQuality;
}): Promise<GenerateResult> {
  const res = await fetch('/api/generate-3d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  let data: {
    modelUrl?: string;
    format?: 'glb' | 'obj';
    mtlUrl?: string | null;
    textureUrl?: string | null;
    model?: string;
    error?: string;
  };

  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(
      res.ok
        ? 'Server returned an invalid response after generation'
        : `Generation failed (${res.status})`,
    );
  }

  if (!res.ok || !data.modelUrl) {
    throw new Error(data.error || `Generation failed (${res.status})`);
  }

  return {
    modelUrl: data.modelUrl,
    format: data.format || (data.modelUrl.toLowerCase().includes('.obj') ? 'obj' : 'glb'),
    mtlUrl: data.mtlUrl ?? null,
    textureUrl: data.textureUrl ?? null,
    model: data.model || 'fal-ai',
  };
}
