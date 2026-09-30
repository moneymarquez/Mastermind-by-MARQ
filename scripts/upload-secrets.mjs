#!/usr/bin/env node
// Copies the Worker's secrets from Cloudflare's Build variables into the
// running Worker, on every deploy. Build variables only exist while the
// build runs; without this step the Worker never sees them, and anything
// set by hand under Variables and Secrets gets wiped by the next deploy
// (see wrangler.jsonc).
//
// Deploy command in Cloudflare (Workers & Pages → mastermind-by-marq →
// Settings → Build → Deploy command):
//
//   node scripts/upload-secrets.mjs && npx wrangler deploy
//
// Only names that are actually set (non-empty) are uploaded, so a missing
// build variable never blanks out a secret that's already on the Worker.
// Values are never printed.
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY', 'TOKEN_ENCRYPTION_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'VITE_STRIPE_PUBLISHABLE_KEY',
  'ANTHROPIC_API_KEY',
  'CF_API_TOKEN', 'CF_ACCOUNT_ID',
  'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_WEBHOOK_SECRET', 'MADEBYMARQUEZ_FROM_EMAIL',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'DIGEST_TO_NUMBER',
  'VAPID_PRIVATE_KEY', 'VITE_VAPID_PUBLIC_KEY', 'VAPID_SUBJECT',
  'ETSY_API_KEY', 'CJ_API_KEY', 'HIGGSFIELD_API_KEY',
  'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET',
];

const found = Object.fromEntries(SECRETS.filter((k) => (process.env[k] ?? '').trim() !== '').map((k) => [k, process.env[k]]));
const names = Object.keys(found);
const missing = SECRETS.filter((k) => !(k in found));
console.log(`upload-secrets: uploading ${names.length}: ${names.join(', ') || '(none)'}`);
if (missing.length) console.log(`upload-secrets: not set as build variables (left as they are on the Worker): ${missing.join(', ')}`);
if (!names.length) process.exit(0);

const dir = mkdtempSync(join(tmpdir(), 'secrets-'));
const file = join(dir, 'secrets.json');
writeFileSync(file, JSON.stringify(found), { mode: 0o600 });
try {
  execFileSync('npx', ['wrangler', 'secret', 'bulk', file], { stdio: ['ignore', 'inherit', 'inherit'] });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
