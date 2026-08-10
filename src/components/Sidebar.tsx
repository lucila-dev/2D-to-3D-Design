import { useDesignStore } from '../store/designStore';
import { ASSET_TYPES, PRESET_COLORS, MATERIAL_PRESETS } from '../constants/assetTypes';
import { getTemplatesForAsset } from '../constants/templates';
import { getEffectiveRoundness } from '../utils/pathToGeometry';
import { PremadeDropdown } from './PremadeDropdown';
import { ColorWheel } from './ColorWheel';
import { xrStore } from './Preview3D';
import { useExportObject } from '../hooks/useExportObject';
import {
  exportGLTF,
  exportOBJ,
  exportBlenderManifest,
  exportUnityManifest,
} from '../utils/exportModel';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const {
    assetType,
    setAssetType,
    conversionMode,
    setConversionMode,
    extrudeDepth,
    depthMode,
    bevelAmount,
    limbThickness,
    sizeScale,
    hollow,
    latheSegments,
    setLatheSegments,
    currentTool,
    setCurrentTool,
    brushColor,
    brushSize,
    setBrushSize,
    material,
    setMaterial,
    lighting,
    setLighting,
    physicsEnabled,
    setPhysicsEnabled,
    viewMode,
    setViewMode,
    showGrid,
    setShowGrid,
    autoRotate,
    setAutoRotate,
    loadTemplate,
    strokes,
    selectedStrokeId,
    selectedStrokeIds,
    setSelectedStrokeId,
    selectStroke,
    groupSelected,
    ungroupSelected,
    mergeSelected,
    applyConversion,
    clearStrokeConversion,
    aiModelUrl,
    aiGenerating,
    aiError,
    setAiModelUrl,
    setAiGenerating,
    setAiError,
  } = useDesignStore();

  const exportObject = useExportObject();
  const templates = getTemplatesForAsset(assetType);
  const selectedStroke = selectedStrokeId
    ? strokes.find((s) => s.id === selectedStrokeId) ?? null
    : null;
  const selectableStrokes = strokes.filter(
    (s) => s.tool !== 'eraser' && s.color !== 'transparent' && s.points.length >= 1,
  );

  const activeDepth = selectedStroke?.conversion?.depth ?? extrudeDepth;
  const activeDepthMode = selectedStroke?.conversion?.depthMode ?? depthMode;
  const activeBevel = selectedStroke
    ? getEffectiveRoundness(selectedStroke, bevelAmount)
    : bevelAmount;
  const activeLimb = selectedStroke?.conversion?.limbThickness ?? limbThickness;
  const activeSize = selectedStroke?.conversion?.sizeScale ?? sizeScale;
  const activeHollow = selectedStroke?.conversion?.hollow ?? hollow;
  const activeBevelPct = Math.round(activeBevel * 100);

  const setActiveDepth = (value: number) => {
    applyConversion({ depth: value });
  };
  const setActiveDepthMode = (mode: typeof depthMode) => {
    applyConversion({ depthMode: mode });
  };
  const setActiveBevel = (value: number) => {
    applyConversion({ bevelAmount: value });
  };
  const setActiveLimb = (value: number) => {
    applyConversion({ limbThickness: value });
  };
  const setActiveSize = (value: number) => {
    applyConversion({ sizeScale: value });
  };
  const setActiveHollow = (value: boolean) => {
    applyConversion({ hollow: value });
  };

  const applyColor = (color: string) => {
    const state = useDesignStore.getState();
    if (state.selectedStrokeIds.length > 0) {
      for (const id of state.selectedStrokeIds) state.recolorStroke(id, color);
    } else {
      state.recolorAllStrokes(color);
    }
  };

  const handleGenerateAi = async (quality: 'draft' | 'enhance') => {
    if (strokes.length === 0) {
      setAiError('Draw something first, or use Text Text → 3D prompt in the top bar.');
      return;
    }
    setAiGenerating(true);
    setAiError(null);
    try {
      const { strokesToImageDataUrl, generateAi3D } = await import('../utils/aiGenerate');
      const imageDataUrl = strokesToImageDataUrl(strokes);
      const result = await generateAi3D({
        mode: 'sketch',
        imageDataUrl,
        quality,
      });
      setAiModelUrl(result.modelUrl, {
        mtlUrl: result.mtlUrl,
        textureUrl: result.textureUrl,
        format: result.format,
      });
      setViewMode('preview');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleExportGLTF = () => exportGLTF(exportObject, `${assetType}-design.glb`);
  const handleExportOBJ = () => exportOBJ(exportObject, `${assetType}-design.obj`);
  const handleBlender = () => {
    exportBlenderManifest(`${assetType}-design`);
    handleExportGLTF();
  };
  const handleUnity = () => {
    exportUnityManifest(`${assetType}-design`);
    handleExportGLTF();
  };

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>🎨 2D → 3D</h1>
        <p>Draw in 2D, see it in 3D — free &amp; local</p>
      </header>

      {/* Asset Types */}
      <section className="panel">
        <h2>What are you making?</h2>
        <div className="asset-grid">
          {ASSET_TYPES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`asset-btn ${assetType === a.id ? 'active' : ''}`}
              onClick={() => {
                setAssetType(a.id);
                onNavigate?.();
              }}
              title={a.label}
            >
              <span className="asset-icon">{a.icon}</span>
              <span className="asset-label">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <PremadeDropdown />

      {templates.length > 0 && (
        <section className="panel">
          <h2>Starter templates</h2>
          <div className="template-grid">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className="template-btn"
                onClick={() => loadTemplate(t)}
                title={`Load ${t.label} template`}
              >
                <span className="asset-icon">{t.icon}</span>
                <span className="asset-label">{t.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* View Mode */}
      <section className="panel">
        <h2>Workspace</h2>
        <div className="tab-row">
          {(['edit', 'preview', 'texture', 'physics'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`tab-btn ${viewMode === m ? 'active' : ''}`}
              onClick={() => {
                setViewMode(m);
                if (m === 'physics') setPhysicsEnabled(true);
                onNavigate?.();
              }}
            >
              {m === 'edit' && '✏️ Draw'}
              {m === 'preview' && '👁 3D'}
              {m === 'texture' && '🖌 Texture'}
              {m === 'physics' && '⚡ Physics'}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Draw Tools</h2>
        <div className="tool-row">
          {([
            ['select', 'Select'],
            ['pen', '✏️'],
            ['eraser', '🧹'],
            ['line', '📏'],
            ['rect', '⬜'],
            ['ellipse', '⭕'],
          ] as const).map(([tool, icon]) => (
            <button
              key={tool}
              type="button"
              className={`tool-btn ${currentTool === tool ? 'active' : ''} ${tool === 'select' ? 'tool-btn-select' : ''}`}
              title={tool === 'select' ? 'Select shape' : tool}
              onClick={() => {
                setCurrentTool(tool);
                if (tool === 'select') setViewMode('edit');
              }}
            >
              {icon}
            </button>
          ))}
        </div>
        <label className="slider-label">
          Brush size
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={brushSize}
            onChange={(e) => setBrushSize(+e.target.value)}
          />
          <span>{brushSize}%</span>
        </label>
        <div className="color-picker-block">
          <ColorWheel
            color={selectedStroke?.color ?? brushColor}
            onChange={(hex) => applyColor(hex)}
            size={140}
          />
          <div className="color-row">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${(selectedStroke?.color ?? brushColor) === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => applyColor(c)}
              />
            ))}
            <input
              type="color"
              value={selectedStroke?.color ?? brushColor}
              title="Custom color"
              onChange={(e) => applyColor(e.target.value)}
              style={{ width: 28, height: 28, padding: 0, border: 'none' }}
            />
          </div>
        </div>
      </section>

      {/* 3D Settings */}
      <section className="panel">
        <h2>{selectedStroke ? 'Selected shape' : '3D Conversion'}</h2>
        {selectableStrokes.length > 0 && (
          <div className="shape-list">
            {selectableStrokes.map((st, i) => (
              <button
                key={st.id}
                type="button"
                className={`shape-chip ${selectedStrokeIds.includes(st.id) ? 'active' : ''}`}
                onClick={(e) => {
                  selectStroke(st.id, e.shiftKey);
                  setViewMode('edit');
                }}
              >
                {st.groupId ? '⧉ ' : ''}
                {st.tool === 'ellipse' ? '⭕' : st.tool === 'rect' ? '⬜' : st.tool === 'line' ? '📏' : '✏️'}{' '}
                Shape {i + 1}
              </button>
            ))}
          </div>
        )}
        {(selectedStroke || selectedStrokeIds.length > 1) && (
          <div className="export-row" style={{ marginBottom: '0.55rem' }}>
            <button
              type="button"
              className="export-btn"
              onClick={() => {
                setSelectedStrokeId(null);
                if (currentTool === 'select') setCurrentTool('pen');
              }}
            >
              Deselect
            </button>
            {selectedStrokeIds.length >= 2 && (
              <>
                <button type="button" className="export-btn" onClick={() => groupSelected()}>
                  Group
                </button>
                <button type="button" className="export-btn" onClick={() => mergeSelected()}>
                  Merge
                </button>
              </>
            )}
            {selectedStrokeIds.some((id) => strokes.find((s) => s.id === id)?.groupId) && (
              <button type="button" className="export-btn" onClick={() => ungroupSelected()}>
                Ungroup
              </button>
            )}
            {selectedStroke && (
              <button
                type="button"
                className="export-btn"
                onClick={() => clearStrokeConversion(selectedStroke.id)}
              >
                Reset shape
              </button>
            )}
          </div>
        )}
        <div className="seg-control">
          <button
            type="button"
            className={conversionMode === 'extrude' ? 'active' : ''}
            onClick={() => setConversionMode('extrude')}
          >
            Extrude
          </button>
          <button
            type="button"
            className={conversionMode === 'lathe' ? 'active' : ''}
            onClick={() => setConversionMode('lathe')}
          >
            Lathe
          </button>
        </div>

        <div className="seg-control" style={{ marginTop: '0.45rem' }}>
          <button
            type="button"
            className={activeDepthMode === 'manual' ? 'active' : ''}
            onClick={() => setActiveDepthMode('manual')}
          >
            Manual depth
          </button>
          <button
            type="button"
            className={activeDepthMode === 'auto' ? 'active' : ''}
            onClick={() => setActiveDepthMode('auto')}
          >
            Auto depth
          </button>
        </div>

        {conversionMode === 'extrude' ? (
          <>
            <label className="slider-label">
              {activeDepthMode === 'manual' ? 'Depth / thickness' : 'Depth scale'}
              <input
                type="range"
                min={0.05}
                max={3}
                step={0.05}
                value={activeDepth}
                onChange={(e) => setActiveDepth(+e.target.value)}
              />
              <span>{activeDepth.toFixed(2)}</span>
            </label>
            <div className="preset-row" style={{ marginBottom: '0.45rem' }}>
              {[
                ['Flat', 0.12],
                ['Thin', 0.25],
                ['Medium', 0.45],
                ['Thick', 0.9],
                ['Deep', 1.6],
              ].map(([label, value]) => (
                <button
                  key={label as string}
                  type="button"
                  className={`preset-btn ${Math.abs(activeDepth - (value as number)) < 0.03 ? 'active' : ''}`}
                  onClick={() => setActiveDepth(value as number)}
                >
                  {label as string}
                </button>
              ))}
            </div>
            <label className="slider-label">
              Round edges
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={activeBevelPct}
                onChange={(e) => setActiveBevel(+e.target.value / 100)}
              />
              <span>{activeBevelPct}%</span>
            </label>
            <label className="slider-label">
              Size
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                value={activeSize}
                onChange={(e) => setActiveSize(+e.target.value)}
              />
              <span>{Math.round(activeSize * 100)}%</span>
            </label>
            <div className="seg-control" style={{ marginBottom: '0.45rem' }}>
              <button
                type="button"
                className={!activeHollow ? 'active' : ''}
                onClick={() => setActiveHollow(false)}
              >
                Solid
              </button>
              <button
                type="button"
                className={activeHollow ? 'active' : ''}
                onClick={() => setActiveHollow(true)}
              >
                Hollow
              </button>
            </div>
            <label className="slider-label">
              Limb thickness
              <input
                type="range"
                min={0.4}
                max={2.5}
                step={0.05}
                value={activeLimb}
                onChange={(e) => setActiveLimb(+e.target.value)}
              />
              <span>{activeLimb.toFixed(2)}×</span>
            </label>
          </>
        ) : (
          <label className="slider-label">
            Lathe segments
            <input
              type="range"
              min={8}
              max={64}
              value={latheSegments}
              onChange={(e) => setLatheSegments(+e.target.value)}
            />
            <span>{latheSegments}</span>
          </label>
        )}
      </section>

      {/* Materials */}
      <section className="panel">
        <h2>Materials</h2>
        <div className="preset-row">
          {MATERIAL_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="preset-btn"
              onClick={() => setMaterial({ metalness: p.metalness, roughness: p.roughness })}
            >
              {p.name}
            </button>
          ))}
        </div>
        <label className="slider-label">
          Color
          <input
            type="color"
            value={material.color}
            onChange={(e) => setMaterial({ color: e.target.value })}
          />
        </label>
        <label className="slider-label">
          Metalness
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={material.metalness}
            onChange={(e) => setMaterial({ metalness: +e.target.value })}
          />
        </label>
        <label className="slider-label">
          Roughness
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={material.roughness}
            onChange={(e) => setMaterial({ roughness: +e.target.value })}
          />
        </label>
      </section>

      {/* Lighting */}
      <section className="panel">
        <h2>Lighting</h2>
        <label className="slider-label">
          Ambient
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={lighting.ambientIntensity}
            onChange={(e) => setLighting({ ambientIntensity: +e.target.value })}
          />
        </label>
        <label className="slider-label">
          Sun intensity
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={lighting.directionalIntensity}
            onChange={(e) => setLighting({ directionalIntensity: +e.target.value })}
          />
        </label>
        <label className="slider-label">
          Sun color
          <input
            type="color"
            value={lighting.directionalColor}
            onChange={(e) => setLighting({ directionalColor: e.target.value })}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={lighting.enableShadows}
            onChange={(e) => setLighting({ enableShadows: e.target.checked })}
          />
          Shadows
        </label>
      </section>

      {/* Physics & Preview options */}
      <section className="panel">
        <h2>Simulation &amp; View</h2>
        <label className="check-label">
          <input
            type="checkbox"
            checked={physicsEnabled}
            onChange={(e) => {
              setPhysicsEnabled(e.target.checked);
              if (e.target.checked) setViewMode('physics');
            }}
          />
          Physics (gravity drop)
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          Show grid
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(e) => setAutoRotate(e.target.checked)}
          />
          Auto-rotate
        </label>
      </section>

      {/* AI 3D */}
      <section className="panel">
        <h2>AI 3D (fal.ai)</h2>
        <div className="export-col">
          <button
            type="button"
            className="export-btn"
            disabled={aiGenerating}
            onClick={() => handleGenerateAi('enhance')}
          >
            Sketch → 3D
          </button>
          {aiModelUrl && (
            <button
              type="button"
              className="export-btn"
              onClick={() => setAiModelUrl(null)}
            >
              Clear AI model
            </button>
          )}
        </div>
        {aiError && <p className="error-hint">{aiError}</p>}
      </section>

      {/* AR / VR */}
      <section className="panel">
        <h2>Immersive Preview</h2>
        <div className="export-row">
          <button type="button" className="primary-btn" onClick={() => xrStore.enterAR()}>
            📱 AR Preview
          </button>
          <button type="button" className="primary-btn" onClick={() => xrStore.enterVR()}>
            🥽 VR Walkthrough
          </button>
        </div>
      </section>

      {/* Export */}
      <section className="panel">
        <h2>Export</h2>
        <div className="export-col">
          <button type="button" className="export-btn" onClick={handleExportGLTF}>
            ⬇ Download .glb
          </button>
          <button type="button" className="export-btn" onClick={handleExportOBJ}>
            ⬇ Download .obj
          </button>
          <button type="button" className="export-btn" onClick={handleBlender}>
            🟠 Export for Blender
          </button>
          <button type="button" className="export-btn" onClick={handleUnity}>
            🔷 Export for Unity
          </button>
        </div>
      </section>
    </aside>
  );
}
