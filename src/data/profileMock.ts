// A profile page as data: what the platform publicly shows (read by Sync), what Marq is
// drafting, and the merge between them. Pure, so it's tested.
import type { Platform } from './contentEngine';

export interface PublicProfile {
  name?: string; username?: string; biography?: string; website?: string; profile_picture_url?: string;
  followers_count?: number; follows_count?: number; media_count?: number; likes_count?: number; account_type?: string; is_verified?: boolean; profile_link?: string;
}
/** Things the platform's API never shows but a public page has. Entered by hand. */
export interface ProfileDraft {
  name?: string; bio?: string; website?: string; category?: string; email?: string; phone?: string; address?: string; highlights?: string[]; pinned_note?: string;
}
export const BIO_LIMIT: Record<string, number> = { instagram: 150, tiktok: 80, youtube: 1000, facebook: 101, x: 160, linkedin: 220 };
export const NAME_LIMIT: Record<string, number> = { instagram: 64, tiktok: 30, youtube: 100, facebook: 75, x: 50, linkedin: 100 };

export interface ProfileView {
  name: string; username: string; bio: string; website: string; category: string; email: string; phone: string; address: string; highlights: string[];
  avatar: string | null; followers: number | null; following: number | null; posts: number | null; likes: number | null; accountType: string; verified: boolean;
  changed: { name: boolean; bio: boolean; website: boolean; category: boolean; email: boolean; phone: boolean; address: boolean; highlights: boolean };
  hasDraft: boolean; bioLimit: number; bioOver: boolean;
}
const s = (v: unknown) => (typeof v === 'string' ? v : '');

/** What the page would look like: the draft where there is one, the live page otherwise. */
export function profileView(platform: Platform | string, handle: string, live: PublicProfile | null | undefined, draft: ProfileDraft | null | undefined, fallback: { avatar?: string | null; followers?: number | null; display?: string | null } = {}): ProfileView {
  const l = live ?? {}, d = draft ?? {};
  const pick = (dv: string | undefined, lv: string) => (dv !== undefined ? dv : lv);
  const name = pick(d.name, s(l.name) || s(fallback.display)), bio = pick(d.bio, s(l.biography)), website = pick(d.website, s(l.website));
  const limit = BIO_LIMIT[platform] ?? 150;
  const hl = d.highlights ?? [];
  return {
    name, username: s(l.username) || handle, bio, website, category: s(d.category), email: s(d.email), phone: s(d.phone), address: s(d.address), highlights: hl,
    avatar: l.profile_picture_url || fallback.avatar || null, followers: l.followers_count ?? fallback.followers ?? null, following: l.follows_count ?? null, posts: l.media_count ?? null, likes: l.likes_count ?? null,
    accountType: s(l.account_type), verified: !!l.is_verified,
    changed: {
      name: d.name !== undefined && d.name !== (s(l.name) || s(fallback.display)), bio: d.bio !== undefined && d.bio !== s(l.biography), website: d.website !== undefined && d.website !== s(l.website),
      category: !!d.category, email: !!d.email, phone: !!d.phone, address: !!d.address, highlights: hl.length > 0,
    },
    hasDraft: !!draft && Object.keys(draft).length > 0, bioLimit: limit, bioOver: bio.length > limit,
  };
}
export const draftHasChanges = (v: ProfileView) => Object.values(v.changed).some(Boolean);

/** AI answer → at most 3 bio options and an optional name, trimmed to the platform's limits. Pure. */
export function parseProfileSuggestions(text: string, platform: string): { bios: string[]; names: string[]; links: string[]; notes: string } {
  let o: Record<string, unknown> = {};
  const m = text.match(/\{[\s\S]*\}/);
  try { o = m ? (JSON.parse(m[0]) as Record<string, unknown>) : {}; } catch { o = {}; }
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v : []).map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 3).map((x) => x.slice(0, max));
  return { bios: list(o.bios, BIO_LIMIT[platform] ?? 150), names: list(o.names, NAME_LIMIT[platform] ?? 64), links: list(o.links, 200), notes: typeof o.notes === 'string' ? o.notes.trim().slice(0, 400) : '' };
}
