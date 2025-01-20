import { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import {
  AVATAR_CATEGORIES,
  type AvatarCategoryId,
} from '../constants/avatarCatalog';

export function AvatarCustomizer() {
  const avatarEnabled = useDesignStore((s) => s.avatarEnabled);
  const avatarConfig = useDesignStore((s) => s.avatarConfig);
  const setAvatarEnabled = useDesignStore((s) => s.setAvatarEnabled);
  const setAvatarOption = useDesignStore((s) => s.setAvatarOption);
  const resetAvatarConfig = useDesignStore((s) => s.resetAvatarConfig);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const setAssetType = useDesignStore((s) => s.setAssetType);

  const [category, setCategory] = useState<AvatarCategoryId>('hairStyle');
  const active = AVATAR_CATEGORIES.find((c) => c.id === category)!;
  const selectedId = avatarConfig[category];

  const startEditing = () => {
    setAssetType('characters');
    setAvatarEnabled(true);
    setViewMode('preview');
  };

  return (
    <section className="panel premade-panel avatar-panel">
      <h2>Avatar studio</h2>

      {!avatarEnabled ? (
        <button type="button" className="primary-btn" style={{ width: '100%' }} onClick={startEditing}>
          Create / edit avatar
        </button>
      ) : (
        <>
          <div className="action-row" style={{ marginBottom: '0.5rem' }}>
            <button type="button" className="export-btn" onClick={resetAvatarConfig}>
              Reset
            </button>
            <button type="button" className="danger-btn" onClick={() => setAvatarEnabled(false)}>
              Close avatar
            </button>
          </div>

          <div className="avatar-cat-row">
            {AVATAR_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`seg-pill ${category === c.id ? 'active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="avatar-swatch-grid" role="listbox" aria-label={active.label}>
            {active.items.map((item) => {
              const selected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`avatar-swatch ${selected ? 'selected' : ''} ${item.color ? 'has-color' : 'has-label'}`}
                  title={item.label}
                  aria-label={item.label}
                  aria-selected={selected}
                  style={item.color ? { background: item.color } : undefined}
                  onClick={() => setAvatarOption(category, item.id)}
                >
                  {!item.color && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
