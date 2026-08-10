import { useCallback, useEffect, useRef } from 'react';
import { useDesignStore } from '../store/designStore';
import { brushPctToWidth } from '../utils/drawingUtils';

const TEX_SIZE = 512;

export function TexturePainter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { textureDataUrl, setTextureDataUrl, brushColor, brushSize } = useDesignStore();
  const isPainting = useRef(false);

  const renderBase = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!textureDataUrl) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    }
  }, [textureDataUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    if (textureDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = textureDataUrl;
    } else {
      renderBase();
    }
  }, [textureDataUrl, renderBase]);

  const getPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * TEX_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * TEX_SIZE,
    };
  };

  const paint = (x: number, y: number) => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const r = brushPctToWidth(brushSize) * 1.5;
    ctx.fillStyle = brushColor;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const commitTexture = () => {
    setTextureDataUrl(canvasRef.current!.toDataURL('image/png'));
  };

  const handleDown = (e: React.MouseEvent) => {
    isPainting.current = true;
    const { x, y } = getPos(e);
    paint(x, y);
  };

  const handleMove = (e: React.MouseEvent) => {
    if (!isPainting.current) return;
    const { x, y } = getPos(e);
    paint(x, y);
  };

  const handleUp = () => {
    if (isPainting.current) {
      isPainting.current = false;
      commitTexture();
    }
  };

  const fillBase = (color: string) => {
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    commitTexture();
  };

  return (
    <div className="texture-painter">
      <div className="canvas-label">
        <span>Texture Paint</span>
      </div>
      <canvas
        ref={canvasRef}
        width={TEX_SIZE}
        height={TEX_SIZE}
        className="texture-canvas"
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
      />
      <div className="texture-actions">
        <button type="button" onClick={() => fillBase('#808080')}>Gray base</button>
        <button type="button" onClick={() => fillBase('#ffffff')}>White base</button>
        <button type="button" onClick={() => setTextureDataUrl(null)}>Clear texture</button>
      </div>
    </div>
  );
}
