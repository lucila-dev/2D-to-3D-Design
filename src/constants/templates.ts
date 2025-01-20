import type { AssetType, Stroke } from '../types';

export interface StarterTemplate {
  id: string;
  label: string;
  icon: string;
  assetTypes: AssetType[];
  strokes: Omit<Stroke, 'id'>[];
}

function rect(x: number, y: number, w: number, h: number, color: string): Omit<Stroke, 'id'> {
  return {
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    color,
    width: 2,
    tool: 'rect',
    closed: true,
  };
}

function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): Omit<Stroke, 'id'> {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return { points: pts, color, width: 2, tool: 'ellipse', closed: true };
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'char-basic',
    label: 'Basic body',
    icon: '🧍',
    assetTypes: ['characters'],
    strokes: [
      ellipse(200, 55, 28, 32, '#fbbf24'),
      rect(178, 88, 44, 70, '#60a5fa'),
      rect(148, 95, 28, 12, '#fbbf24'),
      rect(224, 95, 28, 12, '#fbbf24'),
      rect(182, 158, 16, 55, '#334155'),
      rect(202, 158, 16, 55, '#334155'),
    ],
  },
  {
    id: 'char-detailed',
    label: 'Full figure',
    icon: '🏃',
    assetTypes: ['characters'],
    strokes: [
      ellipse(200, 45, 30, 34, '#fcd34d'),
      rect(185, 80, 30, 55, '#3b82f6'),
      rect(155, 88, 26, 10, '#fcd34d'),
      rect(219, 88, 26, 10, '#fcd34d'),
      rect(150, 98, 10, 35, '#fcd34d'),
      rect(240, 98, 10, 35, '#fcd34d'),
      rect(183, 135, 14, 45, '#1e293b'),
      rect(203, 135, 14, 45, '#1e293b'),
      rect(180, 178, 18, 12, '#1e293b'),
      rect(202, 178, 18, 12, '#1e293b'),
    ],
  },
  {
    id: 'char-chibi',
    label: 'Chibi',
    icon: '😊',
    assetTypes: ['characters', 'plushies'],
    strokes: [
      ellipse(200, 80, 55, 50, '#f472b6'),
      ellipse(175, 70, 10, 12, '#1e293b'),
      ellipse(225, 70, 10, 12, '#1e293b'),
      rect(175, 130, 50, 45, '#f472b6'),
      ellipse(155, 145, 14, 18, '#f472b6'),
      ellipse(245, 145, 14, 18, '#f472b6'),
      ellipse(188, 195, 16, 22, '#f472b6'),
      ellipse(212, 195, 16, 22, '#f472b6'),
    ],
  },
  {
    id: 'furn-chair',
    label: 'Chair',
    icon: '🪑',
    assetTypes: ['furniture'],
    strokes: [
      rect(130, 200, 140, 14, '#92400e'),
      rect(250, 120, 12, 94, '#78350f'),
      rect(130, 214, 10, 86, '#78350f'),
      rect(260, 214, 10, 86, '#78350f'),
      rect(138, 214, 10, 86, '#78350f'),
      rect(120, 110, 12, 104, '#a16207'),
    ],
  },
  {
    id: 'furn-table',
    label: 'Table',
    icon: '🪵',
    assetTypes: ['furniture'],
    strokes: [
      rect(80, 180, 240, 16, '#78716c'),
      rect(95, 196, 14, 90, '#57534e'),
      rect(291, 196, 14, 90, '#57534e'),
      rect(95, 120, 14, 60, '#57534e'),
      rect(291, 120, 14, 60, '#57534e'),
    ],
  },
  {
    id: 'furn-sofa',
    label: 'Sofa',
    icon: '🛋️',
    assetTypes: ['furniture', 'plushies'],
    strokes: [
      rect(60, 170, 280, 50, '#6366f1'),
      rect(60, 140, 280, 35, '#818cf8'),
      rect(45, 150, 20, 70, '#818cf8'),
      rect(335, 150, 20, 70, '#818cf8'),
      rect(70, 220, 20, 40, '#4338ca'),
      rect(310, 220, 20, 40, '#4338ca'),
    ],
  },
  {
    id: 'furn-bed',
    label: 'Bed',
    icon: '🛏',
    assetTypes: ['furniture'],
    strokes: [
      rect(50, 190, 300, 60, '#78350f'),
      rect(60, 160, 280, 35, '#e2e8f0'),
      rect(50, 130, 20, 120, '#92400e'),
      rect(330, 130, 20, 120, '#92400e'),
      rect(40, 110, 30, 50, '#a16207'),
    ],
  },
  {
    id: 'furn-shelf',
    label: 'Shelf',
    icon: '📚',
    assetTypes: ['furniture', 'buildings'],
    strokes: [
      rect(100, 80, 200, 12, '#92400e'),
      rect(100, 150, 200, 12, '#92400e'),
      rect(100, 220, 200, 12, '#92400e'),
      rect(92, 80, 12, 152, '#78350f'),
      rect(296, 80, 12, 152, '#78350f'),
    ],
  },
  {
    id: 'prim-sphere',
    label: 'Sphere',
    icon: '⚽',
    assetTypes: ['jewellery', 'plushies', 'characters'],
    strokes: [ellipse(200, 200, 70, 70, '#6366f1')],
  },
];

export function getTemplatesForAsset(assetType: AssetType): StarterTemplate[] {
  return STARTER_TEMPLATES.filter((t) => t.assetTypes.includes(assetType));
}
