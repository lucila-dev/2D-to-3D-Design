import type { Plugin, Connect } from 'vite';
import type { ServerResponse } from 'node:http';
import { config as loadEnv } from 'dotenv';
import { fal } from '@fal-ai/client';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env'), override: true });

type Quality = 'draft' | 'enhance';
type Mode = 'sketch' | 'text';

export type ModelPayload = {
  modelUrl: string;
  format: 'glb' | 'obj';
  mtlUrl?: string | null;
  textureUrl?: string | null;
  model: string;
  requestId?: string;
};

type FileMeta = {
  url: string;
  content_type?: string;
  file_name?: string;
};

function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function asFileUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  if (typeof value === 'object' && value && 'url' in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

function fileMeta(value: unknown): FileMeta | null {
  const url = asFileUrl(value);
  if (!url) return null;
  if (typeof value === 'object' && value) {
    const v = value as { content_type?: string; file_name?: string };
    return { url, content_type: v.content_type, file_name: v.file_name };
  }
  return { url };
}

function looksLikeObj(meta: FileMeta): boolean {
  const blob = `${meta.file_name ?? ''} ${meta.url} ${meta.content_type ?? ''}`.toLowerCase();
  return blob.includes('.obj') || blob.includes('model/obj') || /(?:^|[^a-z])obj(?:[^a-z]|$)/.test(blob);
}

function looksLikeGlb(meta: FileMeta): boolean {
  if (looksLikeObj(meta)) return false;
  const blob = `${meta.file_name ?? ''} ${meta.url} ${meta.content_type ?? ''}`.toLowerCase();
  return (
    blob.includes('.glb') ||
    blob.includes('.gltf') ||
    blob.includes('gltf') ||
    blob.includes('model/gltf')
  );
}

function isAllowedFalAssetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return (
      host === 'fal.media' ||
      host.endsWith('.fal.media') ||
      host === 'fal.ai' ||
      host.endsWith('.fal.ai')
    );
  } catch {
    return false;
  }
}

/** Same-origin proxy so the browser can load fal.media files (avoids CORS). */
function toProxyUrl(absoluteUrl: string): string {
  return `/api/fal-asset?url=${encodeURIComponent(absoluteUrl)}`;
}

function withProxiedUrls(
  payload: Omit<ModelPayload, 'model' | 'requestId'>,
): Omit<ModelPayload, 'model' | 'requestId'> {
  return {
    modelUrl: toProxyUrl(payload.modelUrl),
    format: payload.format,
    mtlUrl: payload.mtlUrl ? toProxyUrl(payload.mtlUrl) : null,
    textureUrl: payload.textureUrl ? toProxyUrl(payload.textureUrl) : null,
  };
}

/**
 * Prefer real GLB. fal sometimes puts an OBJ in `model_glb` — detect by
 * file_name / content_type / URL, not the field name.
 */
function extractModel(data: Record<string, unknown>): Omit<ModelPayload, 'model' | 'requestId'> | null {
  const urls = (data.model_urls ?? {}) as Record<string, unknown>;

  const candidates = [
    fileMeta(data.model_mesh),
    fileMeta(data.model_glb),
    fileMeta(data.glb),
    fileMeta(urls.glb),
    fileMeta(data.model_obj),
    fileMeta(urls.obj),
    typeof data.model_url === 'string' ? fileMeta(data.model_url) : null,
  ].filter((m): m is FileMeta => Boolean(m));

  const mtlUrl = asFileUrl(data.material_mtl) || asFileUrl(urls.mtl);
  const textureUrl = asFileUrl(data.texture) || asFileUrl(urls.texture);

  const glb = candidates.find(looksLikeGlb);
  if (glb) {
    return { modelUrl: glb.url, format: 'glb', mtlUrl: null, textureUrl: null };
  }

  const obj = candidates.find(looksLikeObj);
  if (obj) {
    return {
      modelUrl: obj.url,
      format: 'obj',
      mtlUrl,
      textureUrl,
    };
  }

  return null;
}

async function generateFromText(prompt: string): Promise<ModelPayload> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is missing. Add it to your .env file.');
  fal.config({ credentials: key });

  const trimmed = prompt.trim().slice(0, 200);
  if (!trimmed) throw new Error('Prompt is required');

  const result = await fal.subscribe('fal-ai/hunyuan-3d/v3.1/rapid/text-to-3d', {
    input: {
      prompt: trimmed,
      enable_pbr: true,
    },
    logs: false,
  });

  const data = result.data as Record<string, unknown>;
  const extracted = extractModel(data);
  if (!extracted) {
    console.error('[fal-generate] unexpected text-to-3d payload:', JSON.stringify(data).slice(0, 2000));
    throw new Error('fal.ai returned no usable 3D model URL (text-to-3d)');
  }

  return {
    ...withProxiedUrls(extracted),
    model: 'fal-ai/hunyuan-3d/v3.1/rapid/text-to-3d',
    requestId: result.requestId,
  };
}

async function generateFromSketch(imageDataUrl: string, quality: Quality): Promise<ModelPayload> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is missing. Add it to your .env file.');
  fal.config({ credentials: key });

  if (quality === 'draft') {
    const result = await fal.subscribe('fal-ai/trellis', {
      input: {
        image_url: imageDataUrl,
        mesh_simplify: 0.9,
        texture_size: 1024 as unknown as '1024',
      },
      logs: false,
    });
    const extracted = extractModel(result.data as Record<string, unknown>);
    if (!extracted) {
      console.error('[fal-generate] unexpected trellis payload keys:', Object.keys(result.data as object));
      throw new Error('fal.ai returned no model URL');
    }
    return {
      ...withProxiedUrls(extracted),
      model: 'fal-ai/trellis',
      requestId: result.requestId,
    };
  }

  const result = await fal.subscribe('fal-ai/trellis-2', {
    input: { image_url: imageDataUrl },
    logs: false,
  });
  const extracted = extractModel(result.data as Record<string, unknown>);
  if (!extracted) {
    console.error('[fal-generate] unexpected trellis-2 payload keys:', Object.keys(result.data as object));
    throw new Error('fal.ai returned no model URL');
  }
  return {
    ...withProxiedUrls(extracted),
    model: 'fal-ai/trellis-2',
    requestId: result.requestId,
  };
}

async function handleFalAssetProxy(req: Connect.IncomingMessage, res: ServerResponse) {
  const raw = req.url ?? '';
  const target = new URL(raw, 'http://localhost').searchParams.get('url');
  if (!target || !isAllowedFalAssetUrl(target)) {
    sendJson(res, 400, { error: 'Invalid or disallowed asset URL' });
    return;
  }

  try {
    const upstream = await fetch(target);
    if (!upstream.ok) {
      sendJson(res, 502, { error: `Upstream asset failed (${upstream.status})` });
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(buffer);
  } catch (err) {
    console.error('[fal-asset-proxy]', err);
    sendJson(res, 502, {
      error: err instanceof Error ? err.message : 'Failed to fetch fal asset',
    });
  }
}

export function falGeneratePlugin(): Plugin {
  const attachApi = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use(async (req, res, next) => {
      if (req.method === 'GET' && req.url?.startsWith('/api/fal-asset')) {
        await handleFalAssetProxy(req, res);
        return;
      }

      if (req.method === 'GET' && req.url === '/api/metaperson-config') {
        const clientId = process.env.METAPERSON_CLIENT_ID;
        const clientSecret = process.env.METAPERSON_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          sendJson(res, 400, {
            error:
              'Add METAPERSON_CLIENT_ID and METAPERSON_CLIENT_SECRET to .env (from accounts.avatarsdk.com)',
          });
          return;
        }
        sendJson(res, 200, { clientId, clientSecret });
        return;
      }

      if (req.method === 'OPTIONS' && req.url?.startsWith('/api/generate-3d')) {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end();
        return;
      }

      if (req.method !== 'POST' || req.url !== '/api/generate-3d') {
        next();
        return;
      }

      // Keep the socket alive during long fal.ai jobs (1–3 min).
      req.socket.setTimeout(0);
      res.setHeader('Connection', 'keep-alive');

      try {
        const body = (await readJsonBody(req)) as {
          mode?: Mode;
          prompt?: string;
          imageDataUrl?: string;
          quality?: Quality;
        };

        const mode: Mode = body.mode === 'sketch' ? 'sketch' : 'text';

        if (mode === 'text') {
          if (!body.prompt?.trim()) {
            sendJson(res, 400, { error: 'prompt is required for text-to-3D' });
            return;
          }
          const result = await generateFromText(body.prompt);
          sendJson(res, 200, result);
          return;
        }

        if (!body.imageDataUrl?.startsWith('data:image/')) {
          sendJson(res, 400, { error: 'imageDataUrl (data:image/...) is required for sketch mode' });
          return;
        }

        const quality: Quality = body.quality === 'draft' ? 'draft' : 'enhance';
        const result = await generateFromSketch(body.imageDataUrl, quality);
        sendJson(res, 200, result);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err && 'body' in err
              ? JSON.stringify((err as { body: unknown }).body)
              : 'Generation failed';
        console.error('[fal-generate]', message, err);
        sendJson(res, 500, { error: message });
      }
    });
  };

  return {
    name: 'fal-generate-api',
    configureServer(server) {
      attachApi(server);
    },
    configurePreviewServer(server) {
      attachApi(server);
    },
  };
}
