/** Free in-app avatar catalog — procedural styles + color swatches (no paid API). */

export type AvatarCategoryId =
  | 'body'
  | 'skin'
  | 'hairStyle'
  | 'hairColor'
  | 'eyes'
  | 'eyeColor'
  | 'top'
  | 'topColor'
  | 'bottom'
  | 'bottomColor'
  | 'shoes'
  | 'shoeColor'
  | 'accessory';

export type AvatarItem = {
  id: string;
  label: string;
  /** Hex color when this item is a swatch */
  color?: string;
  /** Style key consumed by AvatarFigure */
  style?: string;
};

export type AvatarConfig = {
  body: string;
  skin: string;
  hairStyle: string;
  hairColor: string;
  eyes: string;
  eyeColor: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoeColor: string;
  accessory: string;
};

const SKIN_TONES = [
  '#ffe7d1', '#ffd3b0', '#f5c39a', '#e8b48a', '#d9a074', '#c68642', '#a86d32', '#8d5524',
  '#704214', '#5c3610', '#f6e0c8', '#efd0b0', '#e0b090', '#c9956c', '#b07a4f', '#96633c',
  '#7a4e2d', '#623d22', '#4a2e1a', '#fff5eb', '#f0d5b8', '#d4a574', '#b87333', '#8b5a2b',
];

const HAIR_COLORS = [
  '#1a1a1a', '#2c1b18', '#3b2f2f', '#4a3728', '#5c4033', '#6b4423', '#8b4513', '#a0522d',
  '#cd853f', '#daa520', '#b8860b', '#d2691e', '#ff4500', '#dc143c', '#c71585', '#9400d3',
  '#4b0082', '#000080', '#191970', '#008080', '#2e8b57', '#556b2f', '#808000', '#c0c0c0',
  '#dcdcdc', '#f5f5dc', '#fff8dc', '#ffd700', '#ff69b4', '#ff1493', '#00ced1', '#7fffd4',
  '#98fb98', '#eee8aa', '#f4a460', '#deb887',
];

const EYE_COLORS = [
  '#2c1810', '#3d2314', '#5c4033', '#8b4513', '#a0522d', '#1e3a5f', '#2563eb', '#3b82f6',
  '#60a5fa', '#0ea5e9', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#a3a3a3', '#e5e5e5',
  '#7c3aed', '#c026d3', '#e11d48', '#f59e0b',
];

const CLOTH_COLORS = [
  '#111827', '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ffffff', '#fef3c7',
  '#7f1d1d', '#14532d', '#1e3a8a', '#4c1d95', '#831843', '#44403c',
];

function swatches(prefix: string, colors: string[], labelPrefix: string): AvatarItem[] {
  return colors.map((color, i) => ({
    id: `${prefix}-${i + 1}`,
    label: `${labelPrefix} ${i + 1}`,
    color,
  }));
}

function styles(prefix: string, names: string[]): AvatarItem[] {
  return names.map((name) => ({
    id: `${prefix}-${name}`,
    label: name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    style: name,
  }));
}

export const AVATAR_CATEGORIES: {
  id: AvatarCategoryId;
  label: string;
  items: AvatarItem[];
}[] = [
  {
    id: 'body',
    label: 'Body',
    items: styles('body', [
      'slim',
      'average',
      'athletic',
      'stocky',
      'tall',
      'petite',
      'wide',
      'hero',
    ]),
  },
  {
    id: 'skin',
    label: 'Skin',
    items: swatches('skin', SKIN_TONES, 'Skin'),
  },
  {
    id: 'hairStyle',
    label: 'Hair style',
    items: styles('hair', [
      'short',
      'buzz',
      'crew',
      'messy',
      'spiky',
      'bowl',
      'bob',
      'long',
      'ponytail',
      'bun',
      'afro',
      'mohawk',
      'braids',
      'curly',
      'side-part',
      'none',
    ]),
  },
  {
    id: 'hairColor',
    label: 'Hair color',
    items: swatches('hairc', HAIR_COLORS, 'Hair'),
  },
  {
    id: 'eyes',
    label: 'Eyes',
    items: styles('eyes', ['round', 'almond', 'wide', 'narrow', 'sleepy', 'spark']),
  },
  {
    id: 'eyeColor',
    label: 'Eye color',
    items: swatches('eyec', EYE_COLORS, 'Eyes'),
  },
  {
    id: 'top',
    label: 'Top',
    items: styles('top', [
      'tee',
      'tank',
      'hoodie',
      'shirt',
      'sweater',
      'jacket',
      'vest',
      'dress',
      'armor',
      'crop',
      'polo',
      'cloak',
    ]),
  },
  {
    id: 'topColor',
    label: 'Top color',
    items: swatches('topc', CLOTH_COLORS, 'Top'),
  },
  {
    id: 'bottom',
    label: 'Bottom',
    items: styles('bottom', [
      'pants',
      'jeans',
      'shorts',
      'skirt',
      'leggings',
      'cargo',
      'suit',
      'robe',
    ]),
  },
  {
    id: 'bottomColor',
    label: 'Bottom color',
    items: swatches('botc', CLOTH_COLORS.slice(0, 24), 'Bottom'),
  },
  {
    id: 'shoes',
    label: 'Shoes',
    items: styles('shoes', ['sneakers', 'boots', 'sandals', 'heels', 'bare', 'armor-boots']),
  },
  {
    id: 'shoeColor',
    label: 'Shoe color',
    items: swatches('shoec', CLOTH_COLORS.slice(0, 16), 'Shoes'),
  },
  {
    id: 'accessory',
    label: 'Accessory',
    items: styles('acc', [
      'none',
      'glasses',
      'sunglasses',
      'cap',
      'beanie',
      'headphones',
      'earrings',
      'scarf',
      'backpack',
      'crown',
    ]),
  },
];

export const AVATAR_ITEM_COUNT = AVATAR_CATEGORIES.reduce((n, c) => n + c.items.length, 0);

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  body: 'body-average',
  skin: 'skin-6',
  hairStyle: 'hair-short',
  hairColor: 'hairc-1',
  eyes: 'eyes-round',
  eyeColor: 'eyec-7',
  top: 'top-tee',
  topColor: 'topc-16',
  bottom: 'bottom-jeans',
  bottomColor: 'botc-4',
  shoes: 'shoes-sneakers',
  shoeColor: 'shoec-1',
  accessory: 'acc-none',
};

export function findAvatarItem(category: AvatarCategoryId, id: string): AvatarItem | undefined {
  return AVATAR_CATEGORIES.find((c) => c.id === category)?.items.find((i) => i.id === id);
}

export function avatarItemColor(category: AvatarCategoryId, id: string, fallback: string): string {
  return findAvatarItem(category, id)?.color || fallback;
}

export function avatarItemStyle(category: AvatarCategoryId, id: string, fallback: string): string {
  return findAvatarItem(category, id)?.style || fallback;
}
