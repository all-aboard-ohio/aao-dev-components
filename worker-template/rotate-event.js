#!/usr/bin/env node
/**
 * rotate-event.js — One-command event code rotation for aao-event-gate
 *
 * Combines generate-hash.js + wrangler secret put + wrangler deploy into a
 * single guided command. Run this before every event shift.
 *
 * Usage:
 *   node rotate-event.js "your-event-code" "Event Display Name"
 *
 * Examples:
 *   node rotate-event.js "blazing-cardinal-2026" "July Columbus Canvass"
 *   node rotate-event.js "ohio-rail-summit-05"  "May Rail Summit"
 *
 * What it does (with confirmation prompts at each step):
 *   1. Validates and strength-checks the event code
 *   2. Derives the PBKDF2-SHA256 hash
 *   3. Sets EVENT_CODE_HASH via `wrangler secret put`
 *   4. Updates EVENT_NAME in wrangler.toml
 *   5. Runs `wrangler deploy`
 *
 * Prerequisites:
 *   - wrangler CLI installed and authenticated (`wrangler login`)
 *   - JWT_SECRET and TURNSTILE_SECRET already set as secrets
 *   - RATE_LIMIT_KV namespace ID in wrangler.toml
 *
 * Security: the event code is never written to disk or logged.
 */

'use strict';

const { pbkdf2 }              = require('node:crypto');
const { spawnSync }           = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { join }                = require('node:path');
const readline                = require('node:readline');

const SALT       = 'aao-event-gate-v1';
const ITERATIONS = 100_000;
const KEY_LEN    = 32; // 256 bits

// ── Argument parsing ──────────────────────────────────────────────────────────

const [,, rawCode, displayName] = process.argv;

if (!rawCode || !displayName) {
  console.error('');
  console.error('  Usage: node rotate-event.js "event-code" "Display Name"');
  console.error('');
  console.error('  Example: node rotate-event.js "blazing-cardinal-2026" "July Columbus Canvass"');
  console.error('');
  process.exit(1);
}

const code = rawCode.trim().toLowerCase();

if (!code) {
  console.error('Error: Event code cannot be blank.');
  process.exit(1);
}

if (code.length > 256) {
  console.error('Error: Event code must be 256 characters or fewer.');
  process.exit(1);
}

// ── Strength check (same logic as generate-hash.js) ──────────────────────────

const WEAK_PATTERNS = [
  /^[a-z]+$/i,
  /^[0-9]+$/,
  /^(.)\1+$/,
  /^(password|secret|test|admin|aao|event|code|canvass|ohio|transit|letmein|opensesame|1234|qwerty)$/i,
];

function checkStrength(c) {
  const warnings = [];
  if (c.length < 8) {
    warnings.push('Code is very short (less than 8 characters).');
  }
  for (const p of WEAK_PATTERNS) {
    if (p.test(c)) {
      warnings.push('Code matches a common or trivially guessable pattern.');
      break;
    }
  }
  if (c.split(/[-_ ]+/).filter(Boolean).length < 2) {
    warnings.push('Tip: A two-word code (e.g. "cedar-rapids-2026") is harder to guess and easier to distribute.');
  }
  return warnings;
}

// ── PBKDF2 derivation ─────────────────────────────────────────────────────────

function deriveHash(c) {
  return new Promise((resolve, reject) => {
    pbkdf2(c, SALT, ITERATIONS, KEY_LEN, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('base64'));
    });
  });
}

// ── wrangler.toml updater ─────────────────────────────────────────────────────

function updateWranglerToml(name) {
  const tomlPath = join(__dirname, 'wrangler.toml');
  let content;
  try {
    content = readFileSync(tomlPath, 'utf8');
  } catch {
    console.warn('  ⚠  Could not read wrangler.toml — EVENT_NAME not updated automatically.');
    console.warn(`     Set it manually: EVENT_NAME = "${name}"`);
    return false;
  }

  const escaped = name.replace(/"/g, '\\"');
  const updated = content.replace(
    /^EVENT_NAME\s*=\s*"[^"]*"/m,
    `EVENT_NAME = "${escaped}"`
  );

  if (updated === content) {
    console.warn('  ⚠  EVENT_NAME line not found in wrangler.toml — update it manually.');
    return false;
  }

  writeFileSync(tomlPath, updated, 'utf8');
  return true;
}

// ── Confirm prompt ────────────────────────────────────────────────────────────

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ── wrangler helpers ──────────────────────────────────────────────────────────

function wranglerSecretPut(secretName, value) {
  const result = spawnSync('wrangler', ['secret', 'put', secretName], {
    input:    value + '\n',
    encoding: 'utf8',
    stdio:    ['pipe', 'pipe', 'pipe'],
    cwd:      __dirname,
  });
  if (result.status !== 0) {
    throw new Error(`wrangler secret put failed:\n${result.stderr || result.stdout}`);
  }
}

function wranglerDeploy() {
  const result = spawnSync('wrangler', ['deploy'], {
    encoding: 'utf8',
    stdio:    ['inherit', 'pipe', 'pipe'],
    cwd:      __dirname,
  });
  if (result.status !== 0) {
    throw new Error(`wrangler deploy failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout || '';
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  AAO Event Gate — Code Rotation');
  console.log('═'.repeat(60));
  console.log(`  Event code  : ${code}`);
  console.log(`  Display name: ${displayName}`);
  console.log('');

  // Strength warnings (non-blocking)
  const warnings = checkStrength(code);
  if (warnings.length) {
    console.log('  ⚠  Strength warnings:');
    warnings.forEach(w => console.log(`     • ${w}`));
    console.log('');
    const proceed = await confirm('  Continue anyway? (y/N): ');
    if (!proceed) {
      console.log('  Aborted. Choose a stronger code and re-run.');
      console.log('');
      process.exit(0);
    }
    console.log('');
  }

  // Step 1: Derive hash
  console.log('  Step 1/4 — Deriving PBKDF2-SHA256 hash (~2 seconds)...');
  let hash;
  try {
    hash = await deriveHash(code);
  } catch (err) {
    console.error('  ✗ Hash derivation failed:', err.message);
    process.exit(1);
  }
  console.log('  ✓ Hash derived (not shown — it will be piped directly to wrangler).');
  console.log('');

  // Step 2: Set secret
  const goSecret = await confirm('  Step 2/4 — Set EVENT_CODE_HASH secret via wrangler? (y/N): ');
  if (!goSecret) { console.log('  Aborted.'); process.exit(0); }

  try {
    wranglerSecretPut('EVENT_CODE_HASH', hash);
    console.log('  ✓ EVENT_CODE_HASH secret updated in Cloudflare.');
  } catch (err) {
    console.error('  ✗', err.message);
    process.exit(1);
  }
  console.log('');

  // Step 3: Update wrangler.toml
  console.log(`  Step 3/4 — Updating EVENT_NAME to "${displayName}" in wrangler.toml...`);
  const tomlUpdated = updateWranglerToml(displayName);
  if (tomlUpdated) {
    console.log(`  ✓ EVENT_NAME updated.`);
  }
  console.log('');

  // Step 4: Deploy
  const goDeploy = await confirm('  Step 4/4 — Deploy worker now? (y/N): ');
  if (!goDeploy) {
    console.log('');
    console.log('  ℹ  Secret updated but worker not yet deployed.');
    console.log('  ℹ  Run `wrangler deploy` from the worker-template/ directory when ready.');
    console.log('');
    process.exit(0);
  }

  console.log('  Deploying...');
  try {
    const output = wranglerDeploy();
    const urlMatch = output.match(/https:\/\/[^\s]+\.workers\.dev/);
    console.log('  ✓ Worker deployed successfully.');
    if (urlMatch) console.log(`  ✓ Worker URL: ${urlMatch[0]}`);
  } catch (err) {
    console.error('  ✗ Deploy failed:', err.message);
    process.exit(1);
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('  ✓ Rotation complete.');
  console.log('  ✓ Share the event code via Slack or Signal — not email.');
  console.log('  ⚠  Never commit the event code to source control.');
  console.log('═'.repeat(60));
  console.log('');
})();
