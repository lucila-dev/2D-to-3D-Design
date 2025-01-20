import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Preview3D } from './components/Preview3D';
import { TexturePainter } from './components/TexturePainter';
import { AiGenerateBar } from './components/AiGenerateBar';
import { useDesignStore } from './store/designStore';
import './App.css';

function useHistoryShortcuts() {
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);
}

function useIsNarrow(maxWidth = 900) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxWidth}px)`).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [maxWidth]);

  return narrow;
}

function MainWorkspace() {
  const viewMode = useDesignStore((s) => s.viewMode);

  if (viewMode === 'texture') {
    return (
      <div className="workspace split">
        <TexturePainter />
        <Preview3D />
      </div>
    );
  }

  if (viewMode === 'physics' || viewMode === 'preview') {
    return (
      <div className="workspace focus-3d">
        <DrawingCanvas />
        <Preview3D />
      </div>
    );
  }

  return (
    <div className="workspace split">
      <DrawingCanvas />
      <Preview3D />
    </div>
  );
}

export default function App() {
  useHistoryShortcuts();
  const isNarrow = useIsNarrow(900);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isNarrow) setSidebarOpen(false);
  }, [isNarrow]);

  return (
    <div className={`app ${isNarrow ? 'app-narrow' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <header className="mobile-bar">
        <button
          type="button"
          className="menu-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? 'Close tools' : 'Open tools'}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <div className="mobile-bar-title">
          <strong>🎨 2D → 3D</strong>
          <span>Draw · preview · export</span>
        </div>
      </header>

      {isNarrow && sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close tools"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar onNavigate={() => setSidebarOpen(false)} />

      <main className="main">
        <AiGenerateBar />
        <MainWorkspace />
      </main>
    </div>
  );
}
