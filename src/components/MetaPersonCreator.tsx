import { useEffect, useRef } from 'react';

const CREATOR_URL = 'https://metaperson.avatarsdk.com/iframe.html';

interface MetaPersonCreatorProps {
  open: boolean;
  onClose: () => void;
  onExported: (modelUrl: string) => void;
}

/**
 * Ready Player Me replacement: MetaPerson Creator (Avatar SDK).
 * Needs developer credentials from https://accounts.avatarsdk.com/
 */
export function MetaPersonCreator({ open, onClose, onExported }: MetaPersonCreatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;

    const onMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.eventName === 'metaperson_creator_loaded') {
        try {
          const res = await fetch('/api/metaperson-config');
          const cfg = (await res.json()) as {
            clientId?: string;
            clientSecret?: string;
            error?: string;
          };
          if (!res.ok || !cfg.clientId || !cfg.clientSecret) {
            console.warn('[metaperson]', cfg.error || 'Missing credentials');
            return;
          }

          const win = iframeRef.current?.contentWindow;
          if (!win) return;

          win.postMessage(
            {
              eventName: 'authenticate',
              clientId: cfg.clientId,
              clientSecret: cfg.clientSecret,
            },
            '*',
          );

          win.postMessage(
            {
              eventName: 'set_export_parameters',
              format: 'glb',
              lod: 1,
              textureProfile: '1K.png',
              useZip: false,
            },
            '*',
          );

          win.postMessage(
            {
              eventName: 'set_ui_parameters',
              isExportButtonVisible: true,
              closeExportDialogWhenExportComlpeted: true,
              isLoginButtonVisible: true,
            },
            '*',
          );
        } catch (err) {
          console.error('[metaperson] auth failed', err);
        }
      }

      if (data.eventName === 'model_exported' && data.url) {
        onExported(String(data.url));
        onClose();
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, onClose, onExported]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Character creator">
      <div className="modal-panel metaperson-modal">
        <header className="modal-header">
          <div>
            <h2>Create character</h2>
            <p>MetaPerson Creator — customize a premade avatar, then export to 3D</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <iframe
          ref={iframeRef}
          title="MetaPerson Creator"
          src={CREATOR_URL}
          className="metaperson-iframe"
          allow="camera; microphone; clipboard-write"
        />
        <p className="hint modal-hint">
          Needs free Avatar SDK credentials in <code>.env</code> (
          <code>METAPERSON_CLIENT_ID</code> / <code>METAPERSON_CLIENT_SECRET</code>). Get them at{' '}
          <a href="https://accounts.avatarsdk.com/" target="_blank" rel="noreferrer">
            accounts.avatarsdk.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
