// Per-user account tokens (Instagram, TikTok, Shopify, GitHub, Cloudflare
// Pages), sealed with lib/vault.ts into ai_user_tokens. Only the Worker's
// service role reads that table; the browser never sees a token. Shared by
// the Setup page (connect/test) and the workers that act on an account
// (Publisher, Launcher).
import { Sb } from './sb';
import { seal, open } from './vault';
import type { VaultEnv } from './vault';

export type Token = Record<string, string>;

export async function loadToken(env: VaultEnv, sb: Sb, userId: string, provider: string): Promise<Token | null> {
  const [row] = await sb.get<{ ciphertext: string; iv: string }>(`ai_user_tokens?user_id=eq.${userId}&provider=eq.${provider}&select=ciphertext,iv`);
  if (!row) return null;
  try { return JSON.parse(await open(env, row.ciphertext, row.iv)) as Token; } catch { return null; }
}

export async function saveToken(env: VaultEnv, sb: Sb, userId: string, provider: string, tok: Token, meta: Record<string, unknown> = {}) {
  const sealed = await seal(env, JSON.stringify(tok));
  await sb.insert('ai_user_tokens', { user_id: userId, provider, ciphertext: sealed.ciphertext, iv: sealed.iv, meta, updated_at: new Date().toISOString() }, { upsert: 'user_id,provider' });
}

/** The scopes a token was granted, as saved at connect time ('' if the
 *  connection predates scope tracking). */
export const hasScope = (tok: Token, scope: string) => (tok.scope ?? '').split(/[\s,]+/).includes(scope);
