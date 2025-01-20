import { CHARACTER_PRESETS } from '../constants/characters';
import { useDesignStore } from '../store/designStore';
import { AvatarCustomizer } from './AvatarCustomizer';
import { useState } from 'react';
import { MetaPersonCreator } from './MetaPersonCreator';

export function PremadeDropdown() {
  const assetType = useDesignStore((s) => s.assetType);
  const aiModelUrl = useDesignStore((s) => s.aiModelUrl);
  const characterTint = useDesignStore((s) => s.characterTint);
  const setAiModelUrl = useDesignStore((s) => s.setAiModelUrl);
  const setCharacterTint = useDesignStore((s) => s.setCharacterTint);
  const setAssetType = useDesignStore((s) => s.setAssetType);
  const setAvatarEnabled = useDesignStore((s) => s.setAvatarEnabled);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const selectedId =
    CHARACTER_PRESETS.find((p) => p.url === aiModelUrl)?.id ?? '';

  const onPick = (value: string) => {
    if (!value) {
      setAiModelUrl(null);
      return;
    }
    const preset = CHARACTER_PRESETS.find((p) => p.id === value);
    if (!preset) return;
    setAvatarEnabled(false);
    setAssetType('characters');
    setAiModelUrl(preset.url);
  };

  return (
    <>
      {assetType === 'characters' && <AvatarCustomizer />}

      <section className="panel premade-panel">
        <h2>Premade models</h2>

        <label className="slider-label">
          Character
          <select
            className="premade-select"
            value={selectedId}
            onChange={(e) => onPick(e.target.value)}
          >
            <option value="">None — draw your own</option>
            {CHARACTER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.icon} {preset.label} — {preset.description}
              </option>
            ))}
          </select>
        </label>

        {aiModelUrl && (
          <label className="slider-label">
            Tint color
            <input
              type="color"
              value={characterTint}
              onChange={(e) => setCharacterTint(e.target.value)}
            />
          </label>
        )}

        {assetType === 'characters' && (
          <button
            type="button"
            className="export-btn"
            style={{ width: '100%', marginTop: '0.35rem' }}
            onClick={() => setCreatorOpen(true)}
          >
            👤 Open avatar creator (MetaPerson)
          </button>
        )}

        <MetaPersonCreator
          open={creatorOpen}
          onClose={() => setCreatorOpen(false)}
          onExported={(url) => {
            setAvatarEnabled(false);
            setAiModelUrl(url);
          }}
        />
      </section>
    </>
  );
}
