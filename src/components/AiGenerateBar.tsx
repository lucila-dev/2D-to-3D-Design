import { useEffect, useState } from 'react';
import { useDesignStore } from '../store/designStore';

const PROMPT_HINTS: Record<string, string> = {
  characters: 'cute stylized cartoon character, full body, soft colors, game-ready',
  furniture: 'modern wooden chair, clean design, studio product photo style',
  buildings: 'small cozy house, simple architecture, game asset',
  vehicles: 'cute toy car, rounded shapes, colorful',
  jewellery: 'gold ring with gemstone, product render',
  plushies: 'soft plush teddy bear, fluffy fabric, cute',
  shoes: 'sneaker shoe, side view, product design',
};

export function AiGenerateBar() {
  const strokes = useDesignStore((s) => s.strokes);
  const assetType = useDesignStore((s) => s.assetType);
  const aiGenerating = useDesignStore((s) => s.aiGenerating);
  const aiModelUrl = useDesignStore((s) => s.aiModelUrl);
  const aiError = useDesignStore((s) => s.aiError);
  const historyIndex = useDesignStore((s) => s.historyIndex);
  const history = useDesignStore((s) => s.history);
  const setAiModelUrl = useDesignStore((s) => s.setAiModelUrl);
  const setAiGenerating = useDesignStore((s) => s.setAiGenerating);
  const setAiError = useDesignStore((s) => s.setAiError);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const clearStrokes = useDesignStore((s) => s.clearStrokes);

  const [prompt, setPrompt] = useState(PROMPT_HINTS.characters);
  const [mode, setMode] = useState<'text' | 'sketch'>('text');

  useEffect(() => {
    setPrompt(PROMPT_HINTS[assetType] || PROMPT_HINTS.characters);
  }, [assetType]);

  const handleGenerate = async () => {
    setAiGenerating(true);
    setAiError(null);
    try {
      const { strokesToImageDataUrl, generateAi3D } = await import('../utils/aiGenerate');

      if (mode === 'text') {
        if (!prompt.trim()) {
          setAiError('Type a description of what you want in 3D.');
          return;
        }
        const result = await generateAi3D({ mode: 'text', prompt: prompt.trim() });
        setAiModelUrl(result.modelUrl, {
          mtlUrl: result.mtlUrl,
          textureUrl: result.textureUrl,
          format: result.format,
        });
      } else {
        if (strokes.length === 0) {
          setAiError('Draw something first, or switch to Text mode.');
          return;
        }
        const imageDataUrl = strokesToImageDataUrl(strokes);
        const result = await generateAi3D({
          mode: 'sketch',
          imageDataUrl,
          quality: 'enhance',
        });
        setAiModelUrl(result.modelUrl, {
          mtlUrl: result.mtlUrl,
          textureUrl: result.textureUrl,
          format: result.format,
        });
      }

      setViewMode('preview');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="ai-bar ai-bar-expanded">
      <div className="top-history-row">
        <button
          type="button"
          className="undo-btn icon-only"
          onClick={undo}
          disabled={historyIndex <= 0}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          ↩
        </button>
        <button
          type="button"
          className="undo-btn icon-only"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          ↪
        </button>
        <button
          type="button"
          className="danger-btn top-clear-btn"
          onClick={clearStrokes}
          title="Clear drawing"
        >
          Clear drawing
        </button>
        {aiModelUrl && (
          <button
            type="button"
            className="export-btn"
            onClick={() => setAiModelUrl(null)}
            title="Remove loaded 3D model"
          >
            Clear 3D model
          </button>
        )}
      </div>

      <div className="ai-bar-copy">
        <strong>{aiModelUrl ? '3D model loaded' : 'AI 3D'}</strong>
        {aiGenerating && (
          <span>
            {mode === 'text'
              ? 'Generating from text…'
              : 'Generating from sketch…'}
          </span>
        )}
      </div>

      <div className="ai-mode-row">
        <button
          type="button"
          className={`seg-pill ${mode === 'text' ? 'active' : ''}`}
          onClick={() => setMode('text')}
        >
          Text → 3D
        </button>
        <button
          type="button"
          className={`seg-pill ${mode === 'sketch' ? 'active' : ''}`}
          onClick={() => setMode('sketch')}
        >
          Sketch → 3D
        </button>
        <button
          type="button"
          className="export-btn"
          onClick={() => setPrompt(PROMPT_HINTS[assetType] || '')}
        >
          Prompt preset
        </button>
      </div>

      {mode === 'text' && (
        <input
          className="ai-prompt"
          type="text"
          maxLength={200}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the 3D object…"
          disabled={aiGenerating}
        />
      )}

      <div className="ai-bar-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={aiGenerating}
          onClick={handleGenerate}
        >
          {aiGenerating
            ? 'Generating…'
            : mode === 'text'
              ? '✨ Generate from text'
              : '✨ Generate from sketch'}
        </button>
      </div>
      {aiError && <p className="error-hint ai-bar-error">{aiError}</p>}
    </div>
  );
}
