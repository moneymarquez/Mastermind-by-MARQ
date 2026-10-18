// MailerLite (Addendum 2 §1): the "Masterminds Waitlist" group and its
// subscribers. Plain REST (connect.mailerlite.com/api) with MAILERLITE_API_KEY
// — a Build variable, never in code. Adding someone to the group is what
// triggers the "You're in" automation, which stays disabled in MailerLite
// until test mode is off. Every call here is DRY_RUN-aware at the caller.
const BASE = 'https://connect.mailerlite.com/api';
export const WAITLIST_GROUP = 'Masterminds Waitlist';

export interface MailerLiteEnv { MAILERLITE_API_KEY?: string }
const hdr = (env: MailerLiteEnv) => ({ Authorization: `Bearer ${env.MAILERLITE_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' });
type Json = Record<string, unknown>;
const errOf = (j: Json, status: number) => String((j.message as string) ?? ((j.errors && JSON.stringify(j.errors).slice(0, 200)) as string) ?? `HTTP ${status}`);

let groupCache: { name: string; id: string } | null = null;
/** The group's ID, creating the group if it isn't there yet. */
export async function ensureGroup(env: MailerLiteEnv, name = WAITLIST_GROUP, f: typeof fetch = fetch): Promise<string> {
  if (groupCache?.name === name) return groupCache.id;
  const found = await f(`${BASE}/groups?filter[name]=${encodeURIComponent(name)}&limit=25`, { headers: hdr(env) });
  const fj = (await found.json().catch(() => ({}))) as { data?: { id: string; name: string }[] } & Json;
  if (!found.ok) throw new Error(`MailerLite: ${errOf(fj, found.status)}`);
  const hit = (fj.data ?? []).find((g) => g.name === name);
  if (hit) { groupCache = { name, id: hit.id }; return hit.id; }
  const made = await f(`${BASE}/groups`, { method: 'POST', headers: hdr(env), body: JSON.stringify({ name }) });
  const mj = (await made.json().catch(() => ({}))) as { data?: { id: string } } & Json;
  if (!made.ok || !mj.data?.id) throw new Error(`MailerLite: could not create group — ${errOf(mj, made.status)}`);
  groupCache = { name, id: mj.data.id };
  return mj.data.id;
}

export interface WaitlistSubscriber { email: string; name?: string | null; founding: boolean; code?: string | null }
/** Add (or update) one subscriber in the waitlist group. Pure body builder + one call. */
export function subscriberBody(s: WaitlistSubscriber, groupId: string): Json {
  const fields: Record<string, string> = { founding_member: s.founding ? 'yes' : 'no' };
  if (s.name?.trim()) fields.name = s.name.trim().slice(0, 80);
  if (s.code) fields.referral_code = s.code;
  return { email: s.email, fields, groups: [groupId], status: 'active' };
}
export async function upsertSubscriber(env: MailerLiteEnv, s: WaitlistSubscriber, f: typeof fetch = fetch): Promise<void> {
  if (!env.MAILERLITE_API_KEY) throw new Error('MAILERLITE_API_KEY is not set (Cloudflare → Build variables).');
  const groupId = await ensureGroup(env, WAITLIST_GROUP, f);
  const res = await f(`${BASE}/subscribers`, { method: 'POST', headers: hdr(env), body: JSON.stringify(subscriberBody(s, groupId)) });
  if (!res.ok) throw new Error(`MailerLite: ${errOf((await res.json().catch(() => ({}))) as Json, res.status)}`);
}

/** The launch-day campaign: one draft to the whole waitlist (never sent from here). Pure. */
export function launchCampaignBody(opts: { groupId: string; fromEmail: string; link: string; fromName?: string }): Json {
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px"><p>Masterminds is open.</p><p>If you were one of the first 100 on the list, your founding price is locked: <strong>$19.99/month for life</strong>, and your first month is free. It applies on its own when you sign up with the email you used for the waitlist.</p><p><a href="${opts.link}" style="display:inline-block;background:#5266eb;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Open Masterminds</a></p><p>Thanks for being early.<br>Marq</p></div>`;
  return { name: 'Masterminds is open', type: 'regular', emails: [{ subject: 'Masterminds is open — your founding price is locked', from_name: opts.fromName ?? 'Marq at Masterminds', from: opts.fromEmail, content: html }], groups: [opts.groupId] };
}
export async function createLaunchDraft(env: MailerLiteEnv, opts: { fromEmail: string; link: string }, f: typeof fetch = fetch): Promise<{ id: string }> {
  if (!env.MAILERLITE_API_KEY) throw new Error('MAILERLITE_API_KEY is not set (Cloudflare → Build variables).');
  const groupId = await ensureGroup(env, WAITLIST_GROUP, f);
  const res = await f(`${BASE}/campaigns`, { method: 'POST', headers: hdr(env), body: JSON.stringify(launchCampaignBody({ groupId, ...opts })) });
  const j = (await res.json().catch(() => ({}))) as { data?: { id: string } } & Json;
  if (!res.ok || !j.data?.id) throw new Error(`MailerLite: could not create the campaign draft — ${errOf(j, res.status)}`);
  return { id: j.data.id };
}
