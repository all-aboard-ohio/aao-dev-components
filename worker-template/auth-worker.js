/**
 * auth-worker.js — Cloudflare Worker for aao-event-gate
 *
 * Handles passphrase verification + Turnstile bot-check + rate limiting,
 * then issues a short-lived signed JWT on success.
 *
 * Required Cloudflare bindings (set via `wrangler secret put` or Dashboard):
 *
 *   RATE_LIMIT_KV    — KV namespace (for rate limiting by IP)
 *   EVENT_CODE_HASH  — base64 PBKDF2-SHA256 hash of the event code
 *                      Generate with: node generate-hash.js "your-code"
 *   JWT_SECRET       — random 256-bit secret for HMAC-SHA256 JWT signing
 *                      Generate with: openssl rand -base64 32
 *   TURNSTILE_SECRET — Turnstile secret key from Cloudflare Dashboard
 *
 * Optional env vars (safe to set in wrangler.toml [vars]):
 *
 *   ALLOWED_ORIGINS  — comma-separated list of allowed CORS origins
 *                      e.g. "https://lab.allaboardohio.org,https://canvass.allaboardohio.org"
 *                      Leave empty to allow all origins (only do this in local dev).
 *   EVENT_NAME       — label embedded in the JWT payload for logging purposes
 *   TTL_HOURS        — JWT validity in hours (default: 8)
 */

const PBKDF2_SALT       = 'aao-event-gate-v1';
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BITS   = 256;

const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 900; // 15 minutes, in seconds

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// ── CORS ──────────────────────────────────────────────────────────────────────
//
// Note: CORS only protects browsers from third-party sites making requests on
// behalf of a user. It does NOT prevent a determined attacker using curl or a
// script from sending requests directly. The real security is the passphrase
// hash check, Turnstile bot verification, and rate limiting.

function getCorsHeaders(request, env) {
  const origin  = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // If no origins configured, allow all (warn in logs)
  const isAllowed = allowed.length === 0 || allowed.includes(origin);
  if (allowed.length === 0) {
    structuredLog('warn', 'cors_open', { note: 'ALLOWED_ORIGINS not set — accepting all origins' });
  }

  return {
    'Access-Control-Allow-Origin':  isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  };
}

// ── JWT (HS256) ───────────────────────────────────────────────────────────────

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function signJWT(payload, secret) {
  const enc    = new TextEncoder();
  const header = toBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = toBase64Url(enc.encode(JSON.stringify(payload)));
  const input  = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(input));

  return `${input}.${toBase64Url(sig)}`;
}

// ── PBKDF2 hash derivation ────────────────────────────────────────────────────

async function deriveCodeHash(code) {
  const enc         = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(code),
    'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name:       'PBKDF2',
      hash:       'SHA-256',
      salt:       enc.encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    PBKDF2_KEY_BITS
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

// ── Constant-time string comparison ──────────────────────────────────────────
//
// Both a and b are base64-encoded 256-bit values (44 chars each).
// We HMAC both with a fresh random key so the loop time is independent
// of where the first difference occurs — preventing timing side-channels.

async function constantTimeEqual(a, b) {
  const enc    = new TextEncoder();
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key    = await crypto.subtle.importKey(
    'raw', rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const [macA, macB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(a)),
    crypto.subtle.sign('HMAC', key, enc.encode(b)),
  ]);

  const ua = new Uint8Array(macA);
  const ub = new Uint8Array(macB);
  let diff = 0;
  // 32-byte fixed-length loop — always runs exact same number of iterations
  for (let i = 0; i < 32; i++) diff |= (ua[i] ?? 0) ^ (ub[i] ?? 0);
  return diff === 0;
}

// ── Rate limiting (Cloudflare KV) ────────────────────────────────────────────

async function getRateCount(ip, eventName, kv) {
  const val = await kv.get(`rl:${eventName}:${ip}`, 'json');
  return (val && typeof val.count === 'number') ? val.count : 0;
}

async function incrementRateLimit(ip, eventName, kv) {
  const key   = `rl:${eventName}:${ip}`;
  const count = await getRateCount(ip, eventName, kv);
  const next  = count + 1;
  await kv.put(key, JSON.stringify({ count: next }), { expirationTtl: RATE_LIMIT_WINDOW });
  return next;
}

async function clearRateLimit(ip, eventName, kv) {
  await kv.delete(`rl:${eventName}:${ip}`);
}

// ── Cloudflare Turnstile verification ────────────────────────────────────────

async function verifyTurnstile(token, secret, ip) {
  const form = new FormData();
  form.append('secret',   secret);
  form.append('response', token);
  form.append('remoteip', ip); // optional but helps Cloudflare analytics

  const res  = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: form });
  const data = await res.json();
  return data.success === true;
}

// ── JSON response helper ──────────────────────────────────────────────────────

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

// ── Structured logging (#9) ───────────────────────────────────────────────────
// IPs are never logged in plaintext. A one-way HMAC (first 8 bytes) is used
// for correlation without exposing the raw address in log exports.

async function hashIp(ip) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode('aao-log-ip-v1'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(ip));
  return Array.from(new Uint8Array(mac)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function structuredLog(level, event, extras = {}) {
  const entry = { level, event, ts: Math.floor(Date.now() / 1000), ...extras };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ── JWT verification (used by /verify endpoint, #1) ──────────────────────────

async function verifyJWT(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const enc      = new TextEncoder();
    const input    = `${parts[0]}.${parts[1]}`;
    const sigBytes = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(input));
    if (!valid) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const cors = getCorsHeaders(request, env);
    const url  = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── Route: POST /verify (#1) ─────────────────────────────────────────────
    // Lightweight token introspection for embedded tools — verify a JWT is
    // still valid and optionally assert it matches an expected scope.
    if (url.pathname === '/verify' && request.method === 'POST') {
      if (!env.JWT_SECRET) {
        return json({ error: 'Server misconfiguration.' }, 500, cors);
      }
      let body;
      try { body = await request.json(); } catch {
        return json({ error: 'Invalid JSON body' }, 400, cors);
      }
      const { token, scope } = body;
      if (!token || typeof token !== 'string') {
        return json({ valid: false, error: 'Missing token' }, 400, cors);
      }
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (!payload) {
        return json({ valid: false }, 401, cors);
      }
      if (scope && payload.scope && payload.scope !== scope && payload.scope !== 'default') {
        return json({ valid: false, error: 'Token scope mismatch' }, 403, cors);
      }
      return json({ valid: true, event: payload.event, scope: payload.scope, exp: payload.exp }, 200, cors);
    }

    // ── Route: GET /stats (#8) ───────────────────────────────────────────────
    // Admin-only endpoint — requires X-Admin-Key header matching ADMIN_KEY secret.
    // Returns event metadata. Set ADMIN_KEY via `wrangler secret put ADMIN_KEY`.
    if (url.pathname === '/stats' && request.method === 'GET') {
      if (!env.ADMIN_KEY) {
        return json({ error: 'Stats endpoint not configured (ADMIN_KEY missing).' }, 503, cors);
      }
      const providedKey = request.headers.get('X-Admin-Key') || '';
      // Constant-time comparison using HMAC with a per-request ephemeral key
      const enc     = new TextEncoder();
      const rawKey  = crypto.getRandomValues(new Uint8Array(32));
      const hmacKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const [macA, macB] = await Promise.all([
        crypto.subtle.sign('HMAC', hmacKey, enc.encode(providedKey)),
        crypto.subtle.sign('HMAC', hmacKey, enc.encode(env.ADMIN_KEY)),
      ]);
      const ua = new Uint8Array(macA), ub = new Uint8Array(macB);
      let diff = 0;
      for (let i = 0; i < 32; i++) diff |= (ua[i] ?? 0) ^ (ub[i] ?? 0);
      if (diff !== 0) {
        return json({ error: 'Unauthorized' }, 401, cors);
      }
      return json({
        event:     env.EVENT_NAME  || 'aao-event',
        ttlHours:  parseInt(env.TTL_HOURS || '8', 10),
        toolScope: env.TOOL_SCOPE  || 'default',
        workerTime: new Date().toISOString(),
      }, 200, cors);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }

    // ── Check required bindings ─────────────────────────────────────────────

    if (!env.RATE_LIMIT_KV || !env.EVENT_CODE_HASH || !env.JWT_SECRET || !env.TURNSTILE_SECRET) {
      await structuredLog('error', 'misconfiguration', { note: 'Missing required environment bindings' });
      return json({ error: 'Server misconfiguration — contact the tool administrator.' }, 500, cors);
    }

    // ── Rate limit check (by real client IP — set by Cloudflare edge) ───────

    const ip        = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const eventName = (env.EVENT_NAME || 'aao-event').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const ipHash    = await hashIp(ip);
    const count     = await getRateCount(ip, eventName, env.RATE_LIMIT_KV);

    if (count >= RATE_LIMIT_MAX) {
      await structuredLog('warn', 'rate_limited', { eventName, ipHash });
      return json(
        { error: 'Too many attempts. Please wait 15 minutes.', retriesLeft: 0 },
        429,
        { ...cors, 'Retry-After': String(RATE_LIMIT_WINDOW) }
      );
    }

    // ── Parse and validate request body ─────────────────────────────────────

    let body;
    try {
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return json({ error: 'Content-Type must be application/json' }, 400, cors);
      }
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, cors);
    }

    const { code, turnstileToken } = body;

    if (!code || typeof code !== 'string' || !turnstileToken || typeof turnstileToken !== 'string') {
      return json({ error: 'Missing required fields: code, turnstileToken' }, 400, cors);
    }

    // Prevent oversized inputs before any expensive operations
    if (code.length > 256 || turnstileToken.length > 4096) {
      return json({ error: 'Input exceeds maximum length' }, 400, cors);
    }

    // ── Turnstile verification (runs before touching rate limit) ─────────────
    //
    // Bots that fail Turnstile don't consume rate limit attempts — they're
    // rejected here without incrementing the IP's counter.

    let turnstileOk = false;
    try {
      turnstileOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, ip);
    } catch (err) {
      await structuredLog('error', 'turnstile_error', { eventName, ipHash, message: String(err) });
      return json({ error: 'Security check verification failed. Please try again.' }, 503, cors);
    }

    if (!turnstileOk) {
      await structuredLog('warn', 'turnstile_failed', { eventName, ipHash });
      return json({ error: 'Security check failed. Please complete the challenge and try again.' }, 403, cors);
    }

    // ── Passphrase hash check ────────────────────────────────────────────────

    let match = false;
    try {
      const submittedHash = await deriveCodeHash(code);
      match = await constantTimeEqual(submittedHash, env.EVENT_CODE_HASH);
    } catch (err) {
      await structuredLog('error', 'hash_error', { eventName, ipHash, message: String(err) });
      return json({ error: 'Internal error during verification.' }, 500, cors);
    }

    if (!match) {
      const newCount    = await incrementRateLimit(ip, eventName, env.RATE_LIMIT_KV);
      const retriesLeft = Math.max(0, RATE_LIMIT_MAX - newCount);
      await structuredLog('info', 'auth_failure', { eventName, ipHash, retriesLeft });
      return json({ error: 'Incorrect event code.', retriesLeft }, 401, cors);
    }

    // ── Auth success ─────────────────────────────────────────────────────────

    // Clear rate limit counter — a successful auth resets the window
    await clearRateLimit(ip, eventName, env.RATE_LIMIT_KV);

    const ttlHours = Math.min(Math.max(parseInt(env.TTL_HOURS || '8', 10), 1), 72);
    const now      = Math.floor(Date.now() / 1000);

    let token;
    try {
      token = await signJWT(
        {
          iss:   'aao-event-gate',
          iat:   now,
          exp:   now + ttlHours * 3600,
          event: env.EVENT_NAME || 'aao-event',
          scope: env.TOOL_SCOPE || 'default',  // #2: scope claim for tool-level isolation
        },
        env.JWT_SECRET
      );
    } catch (err) {
      await structuredLog('error', 'jwt_error', { eventName, ipHash, message: String(err) });
      return json({ error: 'Internal error issuing session.' }, 500, cors);
    }

    await structuredLog('info', 'auth_success', { eventName, ipHash });
    return json({ token }, 200, cors);
  },
};
