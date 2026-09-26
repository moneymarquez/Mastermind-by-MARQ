// Per-user token encryption (Appendix 5 Part 2: "store per-user tokens
// encrypted server-side, never in the browser"). AES-256-GCM with a key
// from the TOKEN_ENCRYPTION_KEY Worker secret; if that isn't set yet the
// key is derived (HKDF) from the service-role key, which is already a
// Worker-only secret. Setting TOKEN_ENCRYPTION_KEY later means reconnecting
// accounts once — the Setup page says so.
export interface VaultEnv { TOKEN_ENCRYPTION_KEY?: string; SUPABASE_SERVICE_ROLE_KEY: string }

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

async function rawKey(env: VaultEnv, purpose: string): Promise<ArrayBuffer> {
  if (env.TOKEN_ENCRYPTION_KEY) {
    const k = unb64(env.TOKEN_ENCRYPTION_KEY);
    if (k.length >= 32) { const base = await crypto.subtle.importKey('raw', k, 'HKDF', false, ['deriveBits']); return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('mastermind'), info: enc.encode(purpose) }, base, 256); }
  }
  const base = await crypto.subtle.importKey('raw', enc.encode(env.SUPABASE_SERVICE_ROLE_KEY), 'HKDF', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('mastermind-derived'), info: enc.encode(purpose) }, base, 256);
}

export async function seal(env: VaultEnv, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await crypto.subtle.importKey('raw', await rawKey(env, 'tokens'), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { ciphertext: b64(ct), iv: b64(iv) };
}
export async function open(env: VaultEnv, ciphertext: string, iv: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', await rawKey(env, 'tokens'), 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ciphertext));
  return new TextDecoder().decode(pt);
}
async function hmac(env: VaultEnv, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', await rawKey(env, 'oauth-state'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(data))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Signed OAuth state: who started the connect, for which provider, when. */
export async function signState(env: VaultEnv, payload: { u: string; p: string }): Promise<string> {
  const body = b64url(JSON.stringify({ ...payload, t: Date.now() }));
  return `${body}.${await hmac(env, body)}`;
}
export async function verifyState(env: VaultEnv, state: string): Promise<{ u: string; p: string } | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig || sig !== (await hmac(env, body))) return null;
  const v = JSON.parse(unb64url(body)) as { u: string; p: string; t: number };
  return Date.now() - v.t < 15 * 60 * 1000 ? { u: v.u, p: v.p } : null;
}
