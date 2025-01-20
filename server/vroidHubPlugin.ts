import type { Plugin, Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env'), override: true });

const API_VERSION = '11';
const HUB_URL = () => process.env.VROID_HUB_URL || 'https://hub.vroid.com';
const CLIENT_ID = () => process.env.VROID_CLIENT_ID || '';
const CLIENT_SECRET = () => process.env.VROID_CLIENT_SECRET || '';
const REDIRECT_URI = () =>
  process.env.VROID_REDIRECT_URI || 'http://localhost:5173/api/vroid/callback';
const SCOPE = () => process.env.VROID_SCOPE || 'default';

type Session = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function base64Url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie || '';
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function setCookie(
  res: ServerResponse,
  name: string,
  value: string,
  maxAgeSec: number,
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
  ];
  const prev = res.getHeader('Set-Cookie');
  const next = Array.isArray(prev) ? [...prev, parts.join('; ')] : prev ? [String(prev), parts.join('; ')] : [parts.join('; ')];
  res.setHeader('Set-Cookie', next);
}

function clearCookie(res: ServerResponse, name: string) {
  setCookie(res, name, '', 0);
}

function readSession(req: IncomingMessage): Session | null {
  const raw = parseCookies(req).vroid_session;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(res: ServerResponse, session: Session) {
  setCookie(res, 'vroid_session', JSON.stringify(session), 60 * 60 * 24 * 14);
}

async function hubFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${HUB_URL()}${path}`, {
    ...init,
    headers: {
      'X-Api-Version': API_VERSION,
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

async function exchangeCode(code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID(),
    client_secret: CLIENT_SECRET(),
    redirect_uri: REDIRECT_URI(),
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${HUB_URL()}/oauth/token`, {
    method: 'POST',
    headers: {
      'X-Api-Version': API_VERSION,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token exchange failed (${res.status})`);
  }

  return data;
}

async function getVrmDownloadUrl(token: string, modelId: string): Promise<string> {
  const licenseRes = await hubFetch('/api/download_licenses', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ character_model_id: modelId }),
  });

  if (!licenseRes.ok) {
    const text = await licenseRes.text();
    throw new Error(`Download license failed (${licenseRes.status}): ${text.slice(0, 200)}`);
  }

  const licenseJson = (await licenseRes.json()) as { data?: { id?: string } };
  const licenseId = licenseJson.data?.id;
  if (!licenseId) throw new Error('No download license id returned');

  const downloadRes = await hubFetch(`/api/download_licenses/${licenseId}/download`, token, {
    method: 'GET',
    redirect: 'manual',
    headers: { 'Accept-Encoding': 'gzip' },
  });

  const location = downloadRes.headers.get('location');
  if (!location) {
    throw new Error(`Expected redirect for VRM download (status ${downloadRes.status})`);
  }
  return location;
}

function readUrl(req: IncomingMessage): URL {
  return new URL(req.url || '/', 'http://localhost');
}

export function vroidHubPlugin(): Plugin {
  const attach = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use(async (req, res, next) => {
      const url = readUrl(req);
      if (!url.pathname.startsWith('/api/vroid')) {
        next();
        return;
      }

      try {
        if (req.method === 'GET' && url.pathname === '/api/vroid/status') {
          const configured = Boolean(CLIENT_ID() && CLIENT_SECRET());
          const session = readSession(req);
          sendJson(res, 200, {
            configured,
            connected: Boolean(session?.accessToken),
            redirectUri: REDIRECT_URI(),
          });
          return;
        }

        if (req.method === 'GET' && url.pathname === '/api/vroid/login') {
          if (!CLIENT_ID() || !CLIENT_SECRET()) {
            sendJson(res, 500, {
              error:
                'Add VROID_CLIENT_ID and VROID_CLIENT_SECRET to .env (from hub.vroid.com/oauth/applications)',
            });
            return;
          }

          const state = base64Url(randomBytes(24));
          const codeVerifier = base64Url(randomBytes(48));
          const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());

          setCookie(res, 'vroid_oauth_state', state, 600);
          setCookie(res, 'vroid_code_verifier', codeVerifier, 600);

          const auth = new URL(`${HUB_URL()}/authorize/confirm`);
          auth.searchParams.set('response_type', 'code');
          auth.searchParams.set('client_id', CLIENT_ID());
          auth.searchParams.set('redirect_uri', REDIRECT_URI());
          auth.searchParams.set('scope', SCOPE());
          auth.searchParams.set('state', state);
          auth.searchParams.set('code_challenge', codeChallenge);
          auth.searchParams.set('code_challenge_method', 'S256');

          res.statusCode = 302;
          res.setHeader('Location', auth.toString());
          res.end();
          return;
        }

        if (req.method === 'GET' && url.pathname === '/api/vroid/callback') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const cookies = parseCookies(req);
          const expectedState = cookies.vroid_oauth_state;
          const codeVerifier = cookies.vroid_code_verifier;

          clearCookie(res, 'vroid_oauth_state');
          clearCookie(res, 'vroid_code_verifier');

          if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
            res.statusCode = 302;
            res.setHeader('Location', '/?vroid=error&reason=oauth_state');
            res.end();
            return;
          }

          try {
            const tokens = await exchangeCode(code, codeVerifier);
            writeSession(res, {
              accessToken: tokens.access_token!,
              refreshToken: tokens.refresh_token,
              expiresAt: tokens.expires_in
                ? Date.now() + tokens.expires_in * 1000
                : undefined,
            });
            res.statusCode = 302;
            res.setHeader('Location', '/?vroid=connected');
            res.end();
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'token_failed';
            res.statusCode = 302;
            res.setHeader(
              'Location',
              `/?vroid=error&reason=${encodeURIComponent(msg.slice(0, 120))}`,
            );
            res.end();
          }
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/vroid/logout') {
          clearCookie(res, 'vroid_session');
          sendJson(res, 200, { ok: true });
          return;
        }

        if (req.method === 'GET' && url.pathname === '/api/vroid/models') {
          const session = readSession(req);
          if (!session?.accessToken) {
            sendJson(res, 401, { error: 'Connect VRoid Hub first' });
            return;
          }

          const count = url.searchParams.get('count') || '20';
          const publication = url.searchParams.get('publication') || 'all';
          const maxId = url.searchParams.get('max_id');
          const qs = new URLSearchParams({ count, publication });
          if (maxId) qs.set('max_id', maxId);

          const apiRes = await hubFetch(
            `/api/account/character_models?${qs.toString()}`,
            session.accessToken,
          );
          const json = await apiRes.json();
          if (!apiRes.ok) {
            sendJson(res, apiRes.status, { error: 'Failed to list models', detail: json });
            return;
          }

          const data = (json as { data?: unknown[]; _links?: { next?: { href?: string } } }).data || [];
          let nextMaxId: string | null = null;
          const nextHref = (json as { _links?: { next?: { href?: string } } })._links?.next?.href;
          if (nextHref) {
            try {
              nextMaxId = new URL(nextHref, HUB_URL()).searchParams.get('max_id');
            } catch {
              nextMaxId = null;
            }
          }

          sendJson(res, 200, { data, maxId: nextMaxId });
          return;
        }

        if (req.method === 'GET' && url.pathname === '/api/vroid/vrm') {
          const session = readSession(req);
          const id = url.searchParams.get('id');
          if (!session?.accessToken) {
            sendJson(res, 401, { error: 'Connect VRoid Hub first' });
            return;
          }
          if (!id) {
            sendJson(res, 400, { error: 'id is required' });
            return;
          }

          const downloadUrl = await getVrmDownloadUrl(session.accessToken, id);
          const fileRes = await fetch(downloadUrl);
          if (!fileRes.ok || !fileRes.body) {
            sendJson(res, 502, { error: `Failed to download VRM (${fileRes.status})` });
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'model/gltf-binary');
          res.setHeader('Cache-Control', 'private, max-age=300');
          const buf = Buffer.from(await fileRes.arrayBuffer());
          res.end(buf);
          return;
        }

        sendJson(res, 404, { error: 'Unknown VRoid route' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'VRoid Hub error';
        console.error('[vroid-hub]', message, err);
        sendJson(res, 500, { error: message });
      }
    });
  };

  return {
    name: 'vroid-hub-api',
    configureServer(server) {
      attach(server);
    },
    configurePreviewServer(server) {
      attach(server);
    },
  };
}
