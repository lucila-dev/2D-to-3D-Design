export type AssetType =
  | 'furniture'
  | 'characters'
  | 'buildings'
  | 'vehicles'
  | 'jewellery'
  | 'plushies'
  | 'shoes';

export type ConversionMode = 'extrude' | 'lathe';

export type DepthMode = 'manual' | 'auto';

export type DrawTool = 'pen' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'select';

export interface Point {
  x: number;
  y: number;
}

export interface ConversionOptions {
  depth: number;
  depthMode: DepthMode;
  bevelAmount: number;
  limbThickness: number;
  /** Uniform mesh scale. 1 = normal size. */
  sizeScale: number;
  /** When true, mesh is a shell instead of a filled solid. */
  hollow: boolean;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: DrawTool;
  closed: boolean;
  /** Per-shape overrides; unset fields inherit global conversion settings. */
  conversion?: Partial<ConversionOptions>;
  /** Offset/rotation in the 3D preview (world units / euler radians). */
  transform?: {
    position: [number, number, number];
    rotation: [number, number, number];
  };
  /** Shapes sharing a groupId move/rotate together. */
  groupId?: string;
}

export interface MaterialSettings {
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
}

export interface LightingSettings {
  ambientIntensity: number;
  ambientColor: string;
  directionalIntensity: number;
  directionalColor: string;
  directionalPosition: [number, number, number];
  enableShadows: boolean;
}

export interface AssetTypeConfig {
  id: AssetType;
  label: string;
  icon: string;
  hint: string;
  defaultMode: ConversionMode;
  defaultDepth: number;
  bevel: boolean;
  bevelSize: number;
  bevelSegments: number;
  latheSegments: number;
}

export type ViewMode = 'edit' | 'preview' | 'texture' | 'physics';
