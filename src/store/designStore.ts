import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { ASSET_TYPES } from '../constants/assetTypes';
import type { StarterTemplate } from '../constants/templates';
import type {
  AssetType,
  ConversionMode,
  ConversionOptions,
  DepthMode,
  DrawTool,
  LightingSettings,
  MaterialSettings,
  Point,
  Stroke,
  ViewMode,
} from '../types';
import {
  DEFAULT_AVATAR_CONFIG,
  type AvatarCategoryId,
  type AvatarConfig,
} from '../constants/avatarCatalog';

const MAX_HISTORY = 50;

interface HistorySnapshot {
  strokes: Stroke[];
  aiModelUrl: string | null;
  aiModelMtlUrl: string | null;
  aiModelTextureUrl: string | null;
}

export type AiModelAssets = {
  url: string | null;
  mtlUrl?: string | null;
  textureUrl?: string | null;
  format?: 'glb' | 'obj' | null;
};

interface DesignState {
  assetType: AssetType;
  conversionMode: ConversionMode;
  extrudeDepth: number;
  depthMode: DepthMode;
  bevelAmount: number;
  limbThickness: number;
  sizeScale: number;
  hollow: boolean;
  latheSegments: number;
  strokes: Stroke[];
  selectedStrokeId: string | null;
  selectedStrokeIds: string[];
  transformMode: 'translate' | 'rotate';
  history: HistorySnapshot[];
  historyIndex: number;
  currentTool: DrawTool;
  brushColor: string;
  brushSize: number;
  material: MaterialSettings;
  lighting: LightingSettings;
  textureDataUrl: string | null;
  physicsEnabled: boolean;
  viewMode: ViewMode;
  showGrid: boolean;
  autoRotate: boolean;
  aiModelUrl: string | null;
  aiModelMtlUrl: string | null;
  aiModelTextureUrl: string | null;
  aiModelFormat: 'glb' | 'obj' | null;
  aiGenerating: boolean;
  aiError: string | null;
  characterTint: string;
  avatarEnabled: boolean;
  avatarConfig: AvatarConfig;

  setAssetType: (type: AssetType) => void;
  setConversionMode: (mode: ConversionMode) => void;
  setExtrudeDepth: (depth: number) => void;
  setDepthMode: (mode: DepthMode) => void;
  setBevelAmount: (amount: number) => void;
  setLimbThickness: (thickness: number) => void;
  setSizeScale: (scale: number) => void;
  setHollow: (hollow: boolean) => void;
  setLatheSegments: (segments: number) => void;
  setCurrentTool: (tool: DrawTool) => void;
  setSelectedStrokeId: (id: string | null) => void;
  /** Select a stroke only (not its group). Pass additive=true (shift) to multi-select. */
  selectStroke: (id: string | null, additive?: boolean) => void;
  /** Selection expanded by groupId — use for move/rotate so grouped shapes transform together. */
  getTransformTargetIds: () => string[];
  setTransformMode: (mode: 'translate' | 'rotate') => void;
  updateStrokeTransform: (
    id: string,
    transform: NonNullable<Stroke['transform']>,
  ) => void;
  updateTransforms: (
    updates: { id: string; transform: NonNullable<Stroke['transform']> }[],
  ) => void;
  /** Move selected strokes on the 2D canvas by dx/dy pixels. */
  translateStrokes: (ids: string[], dx: number, dy: number, commit?: boolean) => void;
  /** Snapshot current strokes into undo history (after a live drag). */
  commitStrokeEdit: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  mergeSelected: () => void;
  updateStrokeConversion: (id: string, partial: Partial<ConversionOptions>) => void;
  /** Apply conversion to selected shape, or to globals (and clear matching overrides). */
  applyConversion: (partial: Partial<ConversionOptions>) => void;
  clearStrokeConversion: (id: string) => void;
  setBrushColor: (color: string) => void;
  recolorAllStrokes: (color: string) => void;
  recolorStroke: (id: string, color: string) => void;
  setBrushSize: (size: number) => void;
  addStroke: (stroke: Omit<Stroke, 'id'>) => string;
  updateStroke: (id: string, points: Point[], closed?: boolean) => void;
  finalizeStroke: (id: string, closed?: boolean) => void;
  removeStroke: (id: string) => void;
  clearStrokes: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  loadTemplate: (template: StarterTemplate) => void;
  setMaterial: (partial: Partial<MaterialSettings>) => void;
  setLighting: (partial: Partial<LightingSettings>) => void;
  setTextureDataUrl: (url: string | null) => void;
  setPhysicsEnabled: (enabled: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setShowGrid: (show: boolean) => void;
  setAutoRotate: (rotate: boolean) => void;
  setAiModelUrl: (url: string | null, assets?: Omit<AiModelAssets, 'url'>) => void;
  setAiGenerating: (generating: boolean) => void;
  setAiError: (error: string | null) => void;
  setCharacterTint: (color: string) => void;
  setAvatarEnabled: (enabled: boolean) => void;
  setAvatarOption: (category: AvatarCategoryId, itemId: string) => void;
  resetAvatarConfig: () => void;
}

const defaultMaterial: MaterialSettings = {
  color: '#e879a9',
  metalness: 0.15,
  roughness: 0.45,
  emissive: '#000000',
  emissiveIntensity: 0,
};

const defaultLighting: LightingSettings = {
  ambientIntensity: 0.4,
  ambientColor: '#ffffff',
  directionalIntensity: 1.2,
  directionalColor: '#fff5e6',
  directionalPosition: [5, 8, 5],
  enableShadows: true,
};

function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({ ...p })),
    conversion: s.conversion ? { ...s.conversion } : undefined,
    transform: s.transform
      ? {
          position: [...s.transform.position] as [number, number, number],
          rotation: [...s.transform.rotation] as [number, number, number],
        }
      : undefined,
  }));
}

function snapshot(
  strokes: Stroke[],
  aiModelUrl: string | null,
  aiModelMtlUrl: string | null = null,
  aiModelTextureUrl: string | null = null,
): HistorySnapshot {
  return {
    strokes: cloneStrokes(strokes),
    aiModelUrl,
    aiModelMtlUrl,
    aiModelTextureUrl,
  };
}

function pushHistory(
  state: DesignState,
  newStrokes: Stroke[],
  aiModelUrl: string | null = state.aiModelUrl,
  aiModelMtlUrl: string | null = state.aiModelMtlUrl,
  aiModelTextureUrl: string | null = state.aiModelTextureUrl,
): Partial<DesignState> {
  const trimmed = state.history.slice(0, state.historyIndex + 1);
  trimmed.push(snapshot(newStrokes, aiModelUrl, aiModelMtlUrl, aiModelTextureUrl));
  if (trimmed.length > MAX_HISTORY) trimmed.shift();
  return {
    strokes: newStrokes,
    aiModelUrl,
    aiModelMtlUrl,
    aiModelTextureUrl,
    history: trimmed,
    historyIndex: trimmed.length - 1,
  };
}

export const useDesignStore = create<DesignState>((set, get) => ({
  assetType: 'characters',
  conversionMode: 'extrude',
  extrudeDepth: 0.45,
  depthMode: 'manual',
  bevelAmount: 0,
  limbThickness: 1,
  sizeScale: 1,
  hollow: false,
  latheSegments: 48,
  strokes: [],
  selectedStrokeId: null,
  selectedStrokeIds: [],
  transformMode: 'translate',
  history: [{ strokes: [], aiModelUrl: null, aiModelMtlUrl: null, aiModelTextureUrl: null }],
  historyIndex: 0,
  currentTool: 'pen',
  brushColor: '#e879a9',
  brushSize: 12,
  material: defaultMaterial,
  lighting: defaultLighting,
  textureDataUrl: null,
  physicsEnabled: false,
  viewMode: 'edit',
  showGrid: true,
  autoRotate: false,
  aiModelUrl: null,
  aiModelMtlUrl: null,
  aiModelTextureUrl: null,
  aiModelFormat: null,
  aiGenerating: false,
  aiError: null,
  characterTint: '#ffffff',
  avatarEnabled: false,
  avatarConfig: { ...DEFAULT_AVATAR_CONFIG },

  setAssetType: (type) => {
    const config = ASSET_TYPES.find((a) => a.id === type)!;
    set({
      assetType: type,
      conversionMode: config.defaultMode,
      extrudeDepth: config.defaultDepth,
      latheSegments: config.latheSegments,
    });
  },

  setConversionMode: (mode) => set({ conversionMode: mode }),
  setExtrudeDepth: (depth) => set({ extrudeDepth: depth }),
  setDepthMode: (mode) => set({ depthMode: mode }),
  setBevelAmount: (amount) => set({ bevelAmount: amount }),
  setLimbThickness: (thickness) => set({ limbThickness: thickness }),
  setSizeScale: (scale) => set({ sizeScale: scale }),
  setHollow: (hollow) => set({ hollow }),
  setLatheSegments: (segments) => set({ latheSegments: segments }),
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setSelectedStrokeId: (id) =>
    set({
      selectedStrokeId: id,
      selectedStrokeIds: id ? [id] : [],
    }),
  selectStroke: (id, additive = false) =>
    set((s) => {
      if (!id) {
        return { selectedStrokeId: null, selectedStrokeIds: [] };
      }
      // Select only the clicked shape (not the whole group).
      // Shift+click adds/removes that one shape for multi-select.
      if (!additive) {
        return { selectedStrokeId: id, selectedStrokeIds: [id] };
      }

      const setIds = new Set(s.selectedStrokeIds);
      if (setIds.has(id)) setIds.delete(id);
      else setIds.add(id);
      const next = [...setIds];
      return {
        selectedStrokeId: next.includes(id) ? id : next[next.length - 1] ?? null,
        selectedStrokeIds: next,
      };
    }),
  /** IDs to move/rotate together: current selection, expanded by group membership. */
  getTransformTargetIds: () => {
    const s = get();
    const ids = new Set(s.selectedStrokeIds);
    for (const id of s.selectedStrokeIds) {
      const st = s.strokes.find((x) => x.id === id);
      if (!st?.groupId) continue;
      for (const mate of s.strokes) {
        if (mate.groupId === st.groupId) ids.add(mate.id);
      }
    }
    return [...ids];
  },
  setTransformMode: (mode) => set({ transformMode: mode }),
  updateStrokeTransform: (id, transform) =>
    set((s) => ({
      strokes: s.strokes.map((st) => (st.id === id ? { ...st, transform } : st)),
    })),
  updateTransforms: (updates) =>
    set((s) => {
      const map = new Map(updates.map((u) => [u.id, u.transform]));
      return {
        strokes: s.strokes.map((st) =>
          map.has(st.id) ? { ...st, transform: map.get(st.id)! } : st,
        ),
      };
    }),
  translateStrokes: (ids, dx, dy, commit = false) =>
    set((s) => {
      if (ids.length === 0 || (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)) return s;
      const idSet = new Set(ids);
      const newStrokes = s.strokes.map((st) =>
        idSet.has(st.id)
          ? {
              ...st,
              points: st.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            }
          : st,
      );
      if (commit) return { ...pushHistory(s, newStrokes) };
      return { strokes: newStrokes };
    }),
  commitStrokeEdit: () =>
    set((s) => ({
      ...pushHistory(s, s.strokes),
    })),
  groupSelected: () =>
    set((s) => {
      const ids = s.selectedStrokeIds;
      if (ids.length < 2) return s;
      const groupId = uuid();
      return {
        ...pushHistory(
          s,
          s.strokes.map((st) =>
            ids.includes(st.id) ? { ...st, groupId } : st,
          ),
        ),
        selectedStrokeIds: ids,
        selectedStrokeId: s.selectedStrokeId,
      };
    }),
  ungroupSelected: () =>
    set((s) => {
      const ids = new Set(s.selectedStrokeIds);
      if (ids.size === 0) return s;
      const groupIds = new Set(
        s.strokes.filter((st) => ids.has(st.id) && st.groupId).map((st) => st.groupId!),
      );
      if (groupIds.size === 0) return s;
      return {
        ...pushHistory(
          s,
          s.strokes.map((st) =>
            st.groupId && groupIds.has(st.groupId)
              ? { ...st, groupId: undefined }
              : st,
          ),
        ),
      };
    }),
  mergeSelected: () =>
    set((s) => {
      const ids = s.selectedStrokeIds;
      if (ids.length < 2) return s;
      // Merge = permanent group (same as group, keeps individuals for color/settings)
      const groupId = uuid();
      return {
        ...pushHistory(
          s,
          s.strokes.map((st) =>
            ids.includes(st.id) ? { ...st, groupId } : st,
          ),
        ),
        selectedStrokeIds: ids,
        selectedStrokeId: s.selectedStrokeId,
      };
    }),
  updateStrokeConversion: (id, partial) =>
    set((s) => ({
      strokes: s.strokes.map((st) =>
        st.id === id
          ? { ...st, conversion: { ...st.conversion, ...partial } }
          : st,
      ),
    })),
  applyConversion: (partial) =>
    set((s) => {
      if (s.selectedStrokeId) {
        return {
          strokes: s.strokes.map((st) =>
            st.id === s.selectedStrokeId
              ? { ...st, conversion: { ...st.conversion, ...partial } }
              : st,
          ),
        };
      }

      const globalPatch: Partial<{
        extrudeDepth: number;
        depthMode: DepthMode;
        bevelAmount: number;
        limbThickness: number;
        sizeScale: number;
        hollow: boolean;
      }> = {};
      if (partial.depth !== undefined) globalPatch.extrudeDepth = partial.depth;
      if (partial.depthMode !== undefined) globalPatch.depthMode = partial.depthMode;
      if (partial.bevelAmount !== undefined) globalPatch.bevelAmount = partial.bevelAmount;
      if (partial.limbThickness !== undefined) globalPatch.limbThickness = partial.limbThickness;
      if (partial.sizeScale !== undefined) globalPatch.sizeScale = partial.sizeScale;
      if (partial.hollow !== undefined) globalPatch.hollow = partial.hollow;

      const keys = Object.keys(partial) as (keyof ConversionOptions)[];
      return {
        ...globalPatch,
        strokes: s.strokes.map((st) => {
          if (!st.conversion) return st;
          const next = { ...st.conversion };
          let changed = false;
          for (const key of keys) {
            if (key in next) {
              delete next[key];
              changed = true;
            }
          }
          if (!changed) return st;
          return {
            ...st,
            conversion: Object.keys(next).length > 0 ? next : undefined,
          };
        }),
      };
    }),
  clearStrokeConversion: (id) =>
    set((s) => ({
      strokes: s.strokes.map((st) =>
        st.id === id ? { ...st, conversion: undefined } : st,
      ),
    })),
  setBrushColor: (color) => set({ brushColor: color, material: { ...get().material, color } }),
  recolorAllStrokes: (color) =>
    set((s) => {
      const newStrokes = s.strokes.map((st) =>
        st.tool === 'eraser' || st.color === 'transparent' ? st : { ...st, color },
      );
      return {
        ...pushHistory(s, newStrokes),
        brushColor: color,
        material: { ...s.material, color },
      };
    }),
  recolorStroke: (id, color) =>
    set((s) => ({
      brushColor: color,
      material: { ...s.material, color },
      strokes: s.strokes.map((st) => (st.id === id ? { ...st, color } : st)),
    })),
  setBrushSize: (size) => set({ brushSize: size }),

  addStroke: (stroke) => {
    const id = uuid();
    set((s) => ({
      strokes: [...s.strokes, { ...stroke, id }],
    }));
    return id;
  },

  updateStroke: (id, points, closed) =>
    set((s) => ({
      strokes: s.strokes.map((st) =>
        st.id === id ? { ...st, points, ...(closed !== undefined ? { closed } : {}) } : st,
      ),
    })),

  finalizeStroke: (id, closed) =>
    set((s) => {
      const newStrokes = s.strokes.map((st) =>
        st.id === id ? { ...st, ...(closed !== undefined ? { closed } : {}) } : st,
      );
      return pushHistory(s, newStrokes);
    }),

  removeStroke: (id) =>
    set((s) => ({
      ...pushHistory(s, s.strokes.filter((st) => st.id !== id)),
      selectedStrokeId: s.selectedStrokeId === id ? null : s.selectedStrokeId,
    })),

  clearStrokes: () =>
    set((s) => ({
      ...pushHistory(s, [], null, null, null),
      textureDataUrl: null,
      aiError: null,
      selectedStrokeId: null,
    })),

  undo: () => {
    const { historyIndex, history, selectedStrokeId } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const snap = history[newIndex];
    const stillThere = selectedStrokeId
      ? snap.strokes.some((st) => st.id === selectedStrokeId)
      : false;
    set({
      historyIndex: newIndex,
      strokes: cloneStrokes(snap.strokes),
      aiModelUrl: snap.aiModelUrl,
      aiModelMtlUrl: snap.aiModelMtlUrl,
      aiModelTextureUrl: snap.aiModelTextureUrl,
      aiError: null,
      selectedStrokeId: stillThere ? selectedStrokeId : null,
    });
  },

  redo: () => {
    const { historyIndex, history, selectedStrokeId } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const snap = history[newIndex];
    const stillThere = selectedStrokeId
      ? snap.strokes.some((st) => st.id === selectedStrokeId)
      : false;
    set({
      historyIndex: newIndex,
      strokes: cloneStrokes(snap.strokes),
      aiModelUrl: snap.aiModelUrl,
      aiModelMtlUrl: snap.aiModelMtlUrl,
      aiModelTextureUrl: snap.aiModelTextureUrl,
      aiError: null,
      selectedStrokeId: stillThere ? selectedStrokeId : null,
    });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  loadTemplate: (template) =>
    set((s) => {
      const newStrokes = template.strokes.map((st) => ({ ...st, id: uuid() }));
      return pushHistory(s, newStrokes);
    }),

  setMaterial: (partial) =>
    set((s) => {
      const material = { ...s.material, ...partial };
      if (!partial.color) return { material };

      const newStrokes = s.strokes.map((st) =>
        st.tool === 'eraser' || st.color === 'transparent' ? st : { ...st, color: partial.color! },
      );
      // Don't push history on every color-picker drag — only update live strokes + brush
      return {
        material,
        brushColor: partial.color,
        strokes: newStrokes,
      };
    }),

  setLighting: (partial) =>
    set((s) => ({ lighting: { ...s.lighting, ...partial } })),

  setTextureDataUrl: (url) => set({ textureDataUrl: url }),
  setPhysicsEnabled: (enabled) => set({ physicsEnabled: enabled }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setShowGrid: (show) => set({ showGrid: show }),
  setAutoRotate: (rotate) => set({ autoRotate: rotate }),
  setAiModelUrl: (url, assets) =>
    set((s) => {
      const mtlUrl = url ? (assets?.mtlUrl ?? null) : null;
      const textureUrl = url ? (assets?.textureUrl ?? null) : null;
      const format =
        url
          ? (assets?.format ??
            (mtlUrl || /\.obj/i.test(url) || /[.]obj(?:%|$|&)/i.test(url) ? 'obj' : 'glb'))
          : null;
      if (
        s.aiModelUrl === url &&
        s.aiModelMtlUrl === mtlUrl &&
        s.aiModelTextureUrl === textureUrl &&
        s.aiModelFormat === format
      ) {
        return { aiError: null };
      }
      return {
        ...pushHistory(s, s.strokes, url, mtlUrl, textureUrl),
        aiModelFormat: format,
        aiError: null,
        ...(url ? { avatarEnabled: false } : {}),
      };
    }),
  setAiGenerating: (generating) => set({ aiGenerating: generating }),
  setAiError: (error) => set({ aiError: error }),
  setCharacterTint: (color) => set({ characterTint: color }),
  setAvatarEnabled: (enabled) =>
    set({
      avatarEnabled: enabled,
      ...(enabled
        ? {
            aiModelUrl: null,
            aiModelMtlUrl: null,
            aiModelTextureUrl: null,
            aiModelFormat: null,
          }
        : {}),
    }),
  setAvatarOption: (category, itemId) =>
    set((s) => ({
      avatarConfig: { ...s.avatarConfig, [category]: itemId },
      avatarEnabled: true,
      aiModelUrl: null,
      aiModelMtlUrl: null,
      aiModelTextureUrl: null,
      aiModelFormat: null,
    })),
  resetAvatarConfig: () =>
    set({ avatarConfig: { ...DEFAULT_AVATAR_CONFIG }, avatarEnabled: true }),
}));
