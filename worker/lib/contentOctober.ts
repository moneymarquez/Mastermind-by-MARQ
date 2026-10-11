// October build, Phase 3: Content.
//
//   Ideas engine      runIdeas → social_ideas (no approval: "Add to plan" is the tap)
//   Performance loop  afterGrades → content_briefs (winners) + social_posts.flop_reason
//   Variants          variantConflicts: no identical caption + media on two accounts the same day
//   Content kit       buildContentKit (ecom_brand_to_content handoff) → 'content_kit' approval
//   Own accounts      seedOwnAccounts: mastermind / madebymarq / personal on IG + TikTok
//
// Pure functions first (tests/content-october.test.ts), then the runtime.
import type { Sb } from './sb';
import { extractJson } from './scout';
import { brief } from './workers';
import type { BriefCtx } from './workers';
import { runWorker, accountsFor, measuredPosts, TZ } from './engine';
import { addDaysIso } from './sb';
import type { RunOutcome, Trigger } from './engine';
import type { AccountLite, MeasuredPost, PostDraft } from './contentWorkers';
import { gradeMeasured, scriptBody } from './contentWorkers';

const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strs = (v: unknown, n: number, max = 300): string[] => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const FORMATS = ['reel', 'carousel', 'story', 'image', 'video', 'short'];
const fmt = (v: unknown) => { const s = str(v, 20).toLowerCase(); return FORMATS.includes(s) ? s : 'reel'; };

/** Hour of day (0–23) in the owner's zone. */
export function localHour(iso: string, tz = TZ): number {
  const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date(iso));
  return Number(h) % 24;
}

// ── Performance loop ──────────────────────────────────────────────────
export interface PostFacts { id: string; account_id: string; hook: string | null; caption: string | null; type: string; length_sec: number | null; posted_at: string; views: number | null; saves?: number | null; shares?: number | null }
export interface WinnerBrief { hook: string; format: string; length_sec: number | null; topic: string; hour: number; multiple: number; what_worked: string; do_next: string }
/** "Do more like this" from a breakout: what worked, in plain facts. Pure. */
export function winnerBrief(p: PostFacts, avg: number, change = '', tz = TZ): WinnerBrief {
  const multiple = avg > 0 ? Math.round(((p.views ?? 0) / avg) * 10) / 10 : 0;
  const topic = (p.caption ?? '').split(/[\n.!?]/)[0].trim().slice(0, 120);
  const hour = localHour(p.posted_at, tz);
  const bits = [`hook "${(p.hook ?? '').slice(0, 100)}"`, `${p.type}${p.length_sec ? `, ${p.length_sec}s` : ''}`, `posted ${hour}:00`];
  if ((p.saves ?? 0) > 0 || (p.shares ?? 0) > 0) bits.push(`${p.saves ?? 0} saves, ${p.shares ?? 0} shares`);
  return { hook: p.hook ?? '', format: p.type, length_sec: p.length_sec, topic, hour, multiple, what_worked: `${multiple}× the account average — ${bits.join(' · ')}`, do_next: change || `Same format and length, same opening pattern, a new topic next to "${topic || 'this one'}".` };
}

/** A short, honest "why it probably missed" from the numbers alone. Pure. */
export function flopReason(p: PostFacts, avg: number, peers: PostFacts[], tz = TZ): string {
  const out: string[] = [];
  const share = avg > 0 ? Math.round(((p.views ?? 0) / avg) * 100) : 0;
  out.push(`${share}% of the account's average views`);
  const hookWords = (p.hook ?? '').split(/\s+/).filter(Boolean).length;
  if (hookWords > 12) out.push(`the hook runs ${hookWords} words (winners here open shorter)`);
  if (!p.hook) out.push('no hook was logged, so the first second probably didn\'t stop the scroll');
  const lens = peers.map((x) => x.length_sec).filter((n): n is number => n != null && n > 0).sort((a, b) => a - b);
  const med = lens.length ? lens[Math.floor(lens.length / 2)] : null;
  if (p.length_sec && med && p.length_sec > med * 1.6) out.push(`${p.length_sec}s is long for this account (median ${med}s)`);
  const best = [...peers].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5).map((x) => localHour(x.posted_at, tz));
  const h = localHour(p.posted_at, tz);
  if (best.length >= 3 && !best.some((b) => Math.abs(b - h) <= 2)) out.push(`posted at ${h}:00, away from the hours the best posts went out`);
  const fmts = peers.filter((x) => (x.views ?? 0) >= avg).map((x) => x.type);
  if (fmts.length >= 3 && !fmts.includes(p.type)) out.push(`${p.type} hasn't been a winning format here`);
  return `Probably missed: ${out.join('; ')}.`;
}

export { pullHelp as pullInstructions } from '../../src/data/contentOctober';

// ── Ideas engine ──────────────────────────────────────────────────────
export interface IdeaDraft { concept: string; hook: string; format: string; why: string; based_on: string[]; draft: Pick<PostDraft, 'hooks' | 'script' | 'shot_list' | 'on_screen_text' | 'cta' | 'caption' | 'hashtags'> }
export function ideasSystem(ctx: BriefCtx): string {
  return brief(
    'You are Idea & Script filling the Ideas tab: ready-to-shoot short-form ideas for one account, so the owner never faces a blank page.',
    [
      'Each idea: the concept, the exact first line (hook, under 12 words), the format, and WHY it should work — tied to this account\'s own past winners by their [id] when there are any.',
      'Include a quick draft: 3 hooks, a script to read aloud, a shot list one person can film, on-screen text, CTA, caption and 3–6 hashtags.',
      'Use the "do more like this" briefs as positive examples. Never copy a winner word for word; vary the topic.',
      'A new account with no history: test different formats and say so in why.',
    ],
    ctx,
    '{"ideas":[{"concept":"","hook":"","format":"reel|carousel|story|image|video|short","why":"","based_on":["post id"],"hooks":["","",""],"script":"","shot_list":[""],"on_screen_text":"","cta":"","caption":"","hashtags":""}],"summary":"one sentence"}',
  );
}
export function ideasUser(c: { account: AccountLite; count: number; winners: { id: string; hook: string | null; type: string; views: number | null }[]; briefs: WinnerBrief[]; existing: string[] }, instructions?: string | null): string {
  return [
    `Account: @${c.account.handle} on ${c.account.platform} (${c.account.owner})${c.account.voice ? ` — voice: ${c.account.voice.slice(0, 400)}` : ''}`,
    `Write ${c.count} ideas.`,
    c.winners.length ? `Its best posts:\n${c.winners.map((w) => `- [${w.id}] ${w.views?.toLocaleString('en-US') ?? '?'} views · ${w.type} · "${(w.hook ?? '').slice(0, 120)}"`).join('\n')}` : 'No measured posts yet.',
    c.briefs.length ? `"Do more like this" briefs:\n${c.briefs.map((b) => `- ${b.what_worked}. Next: ${b.do_next}`).join('\n')}` : '',
    c.existing.length ? `Already on the Ideas tab (don't repeat): ${c.existing.slice(0, 20).join('; ')}` : '',
    instructions ? `Extra instructions for this run: ${instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
export function parseIdeaBank(text: string, count: number, knownPostIds: string[]): { ideas: IdeaDraft[]; summary: string } {
  const o = extractJson(text) as { ideas?: unknown[]; summary?: unknown };
  const known = new Set(knownPostIds);
  const ideas: IdeaDraft[] = [];
  for (const raw of Array.isArray(o.ideas) ? o.ideas : []) {
    const r = raw as Record<string, unknown>;
    const concept = str(r.concept, 300), hook = str(r.hook, 200);
    if (!concept || !hook) continue;
    const hooks = strs(r.hooks, 3, 200);
    ideas.push({ concept, hook, format: fmt(r.format), why: str(r.why, 600), based_on: strs(r.based_on, 5, 60).filter((id) => known.has(id)), draft: { hooks: hooks.length ? hooks : [hook], script: str(r.script, 4000), shot_list: strs(r.shot_list, 15), on_screen_text: str(r.on_screen_text, 500), cta: str(r.cta, 300), caption: str(r.caption, 2200), hashtags: str(r.hashtags, 400) } });
  }
  if (!ideas.length) throw new Error('Idea & Script returned no usable ideas.');
  return { ideas: ideas.slice(0, Math.max(1, count)), summary: str(o.summary, 400) };
}

// ── Multiple accounts: unique variants ────────────────────────────────
export const ACCOUNT_GUIDANCE = { min: 3, max: 5, note: 'Run 3–5 accounts, and make every post a unique variant: a different hook, caption and cut. The same clip posted identically across many accounts from one person is what Instagram and TikTok flag as spam or inauthentic behavior, and it can get all of them restricted.' };
export const normCaption = (c: string | null | undefined) => (c ?? '').toLowerCase().replace(/#[\w-]+/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export interface VariantItem { id: string; account_id: string | null; scheduled_for: string | null; caption: string | null; media_key: string | null }
/** Pairs that would post the same caption AND the same media on two
 *  different accounts on the same day. Pure. */
export function variantConflicts(items: VariantItem[]): { a: string; b: string; day: string }[] {
  const out: { a: string; b: string; day: string }[] = [];
  const live = items.filter((i) => i.account_id && i.scheduled_for);
  for (let x = 0; x < live.length; x++) for (let y = x + 1; y < live.length; y++) {
    const a = live[x], b = live[y];
    if (a.account_id === b.account_id || a.scheduled_for !== b.scheduled_for) continue;
    const sameCaption = normCaption(a.caption) !== '' && normCaption(a.caption) === normCaption(b.caption);
    const sameMedia = !!a.media_key && a.media_key === b.media_key;
    if (sameCaption && sameMedia) out.push({ a: a.id, b: b.id, day: a.scheduled_for! });
  }
  return out;
}

// ── Content kit (ecom_brand_to_content) ───────────────────────────────
export interface BrandKit { brand_id: string; name: string; product?: string; voice?: string; palette?: unknown; positioning?: string; buyer?: string; angles?: string[]; live_url?: string | null; images?: { kind: string; url: string | null }[] }
export interface KitPost extends Pick<PostDraft, 'concept' | 'format' | 'hooks' | 'script' | 'shot_list' | 'on_screen_text' | 'cta' | 'caption' | 'hashtags'> { day: number; direction: 'A' | 'B' }
export interface KitPayload { brand_id: string; brand: string; handles: string[]; bio: { instagram: string; tiktok: string }; profile_image: string | null; posts: KitPost[]; plan: { day: number; post: number; platform: 'instagram' | 'tiktok' | 'both'; time: string }[]; look: string; summary: string }
export function kitSystem(ctx: BriefCtx): string {
  return brief(
    'You are the Content orchestrator building the launch content kit for a new e-commerce brand that just went live.',
    [
      'One Instagram and one TikTok page per product. Test TWO creative directions (A and B) on those same pages — not two stores.',
      'Give 5 handle ideas (lowercase, no spaces, 30 chars max, brand-led), a bio for each platform (Instagram ≤150 chars, TikTok ≤80 chars) that links to the store, and the first 9 posts fully scripted (concept, 3 hooks, script, shot list, on-screen text, CTA, caption, hashtags, direction A or B, day 0–13).',
      'Then a 2-week posting plan: which post on which day, which platform, what time (HH:MM, 24h, Denver). Visually matched to the store: say the look in one line (palette, framing, type).',
    ],
    ctx,
    '{"handles":[""],"bio":{"instagram":"","tiktok":""},"posts":[{"concept":"","format":"reel","hooks":["","",""],"script":"","shot_list":[""],"on_screen_text":"","cta":"","caption":"","hashtags":"","day":0,"direction":"A"}],"plan":[{"day":0,"post":0,"platform":"both","time":"18:00"}],"look":"","summary":"one sentence"}',
  );
}
export function kitUser(k: BrandKit): string {
  return [
    `Brand: ${k.name}${k.product ? ` — sells ${k.product}` : ''}`,
    k.positioning ? `Positioning: ${k.positioning}` : '', k.buyer ? `Buyer: ${k.buyer}` : '', k.voice ? `Voice: ${k.voice}` : '',
    k.palette ? `Palette: ${JSON.stringify(k.palette).slice(0, 300)}` : '', k.angles?.length ? `Angles: ${k.angles.join('; ')}` : '',
    k.live_url ? `Store: ${k.live_url}` : '',
  ].filter(Boolean).join('\n');
}
const handleOk = (h: string) => /^[a-z0-9._]{3,30}$/.test(h);
export function parseKit(text: string, k: BrandKit): KitPayload {
  const o = extractJson(text) as Record<string, unknown>;
  const posts: KitPost[] = (Array.isArray(o.posts) ? o.posts : []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const d = Number(r.day);
    return { concept: str(r.concept, 300), format: fmt(r.format) as PostDraft['format'], hooks: strs(r.hooks, 3, 200), script: str(r.script, 4000), shot_list: strs(r.shot_list, 15), on_screen_text: str(r.on_screen_text, 500), cta: str(r.cta, 300), caption: str(r.caption, 2200), hashtags: str(r.hashtags, 400), day: Number.isFinite(d) ? Math.max(0, Math.min(13, Math.round(d))) : 0, direction: r.direction === 'B' ? 'B' as const : 'A' as const };
  }).filter((p) => p.concept && p.hooks.length && p.script).slice(0, 9);
  if (!posts.length) throw new Error('The content kit came back without usable posts.');
  const bio = (o.bio ?? {}) as Record<string, unknown>;
  const plan = (Array.isArray(o.plan) ? o.plan : []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const t = str(r.time, 5);
    return { day: Math.max(0, Math.min(13, Math.round(Number(r.day) || 0))), post: Math.max(0, Math.min(posts.length - 1, Math.round(Number(r.post) || 0))), platform: (r.platform === 'instagram' || r.platform === 'tiktok' ? r.platform : 'both') as 'instagram' | 'tiktok' | 'both', time: /^\d{2}:\d{2}$/.test(t) ? t : '18:00' };
  }).slice(0, 28);
  return {
    brand_id: k.brand_id, brand: k.name,
    handles: strs(o.handles, 5, 40).map((h) => h.toLowerCase().replace(/^@/, '').replace(/\s+/g, '')).filter(handleOk),
    bio: { instagram: str(bio.instagram, 150), tiktok: str(bio.tiktok, 80) },
    profile_image: k.images?.find((i) => i.kind === 'logo' && i.url)?.url ?? k.images?.find((i) => i.url)?.url ?? null,
    posts, plan: plan.length ? plan : posts.map((p, i) => ({ day: p.day, post: i, platform: 'both' as const, time: '18:00' })),
    look: str(o.look, 300), summary: str(o.summary, 300),
  };
}
/** The manual steps: there's no API to create an Instagram or TikTok account. */
export function kitChecklist(k: Pick<KitPayload, 'handles' | 'brand'>): { key: string; label: string; done: boolean }[] {
  const h = k.handles[0] ? `@${k.handles[0]}` : `a handle for ${k.brand}`;
  return [
    { key: 'ig_create', label: `Create the Instagram account ${h} (needs a phone or email you can verify), switch it to a Professional account`, done: false },
    { key: 'tt_create', label: `Create the TikTok account ${h} (phone or email verification)`, done: false },
    { key: 'profile', label: 'Add the profile image and bio from this kit to both', done: false },
    { key: 'connect', label: 'Connect both in Setup → Accounts so the Publisher can post', done: false },
  ];
}

// ── Masterminds' own accounts ─────────────────────────────────────────
export const OWN_ACCOUNTS: { owner: 'mastermind' | 'madebymarq' | 'personal'; handle: string; display: string; voice: string }[] = [
  { owner: 'mastermind', handle: 'mastermindsbymarq', display: 'Masterminds by MARQ', voice: 'The app\'s own voice: calm, exact, a little dry. Shows the product doing real work (screens, before/after), never hype. Talks to solo founders and side-hustlers who want one place to run their life and business.' },
  { owner: 'madebymarq', handle: 'madebymarq', display: 'Made by Marq', voice: 'The studio: confident, plain-spoken, proof-first. Case studies, behind-the-build, client results with numbers and permission. Talks to small-business owners who need a site, a brand or a system built.' },
  { owner: 'personal', handle: 'cristophermarquez', display: 'Cristopher (Marq)', voice: 'Marq himself, first person: building in public, honest about what\'s working and what isn\'t, short and direct. Lifestyle and founder life, not a brand account.' },
];

// ── Runtime ───────────────────────────────────────────────────────────
const now = () => new Date().toISOString();

/** Fill the Ideas tab for one account (or the one with the fewest open ideas). */
export function runIdeas(apiKey: string | undefined, sb: Sb, u: string, input: { accountId?: string; count?: number; instructions?: string | null; trigger?: Trigger } = {}): Promise<RunOutcome> {
  return runWorker(apiKey, sb, u, {
    key: 'idea_script', task: 'Filling the Ideas tab', input: { account_id: input.accountId ?? null, mode: 'ideas' }, instructions: input.instructions, trigger: input.trigger, entityType: 'account', entityId: input.accountId ?? null,
    async execute(ctx) {
      const accounts = await accountsFor(sb, u, input.accountId);
      if (!accounts.length) return { summary: 'No accounts yet. Add one on the Accounts tab and ideas appear here.', skipped: true };
      const open = await sb.get<{ account_id: string | null; concept: string }>(`social_ideas?user_id=eq.${u}&status=eq.new&select=account_id,concept&limit=500`).catch(() => [] as { account_id: string | null; concept: string }[]);
      const account = input.accountId ? accounts[0] : [...accounts].sort((a, b) => open.filter((o) => o.account_id === a.id).length - open.filter((o) => o.account_id === b.id).length)[0];
      const count = Math.max(1, Math.min(8, input.count ?? 5));
      const [posts, briefs, liked] = await Promise.all([
        measuredPosts(sb, u, { accountId: account.id, sinceIso: `${addDaysIso(ctx.date, -90)}T00:00:00` }),
        sb.get<{ brief: WinnerBrief }>(`content_briefs?user_id=eq.${u}&account_id=eq.${account.id}&order=created_at.desc&limit=6&select=brief`).catch(() => [] as { brief: WinnerBrief }[]),
        sb.get<{ entity_id: string }>(`ai_feedback?user_id=eq.${u}&entity_type=eq.social_post&vote=eq.1&order=created_at.desc&limit=20&select=entity_id`).catch(() => [] as { entity_id: string }[]),
      ]);
      const likedSet = new Set(liked.map((l) => l.entity_id));
      const winners = [...posts].filter((p) => p.views != null).sort((a, b) => Number(likedSet.has(b.id)) - Number(likedSet.has(a.id)) || (b.views ?? 0) - (a.views ?? 0)).slice(0, 8);
      const res = await ctx.ask({ maxTokens: 9000, system: ideasSystem(ctx.brief), user: ideasUser({ account, count, winners, briefs: briefs.map((b) => b.brief), existing: open.filter((o) => o.account_id === account.id).map((o) => o.concept) }, input.instructions) });
      const p = parseIdeaBank(res.text, count, posts.map((x) => x.id));
      await sb.insert('social_ideas', p.ideas.map((i) => ({ user_id: u, account_id: account.id, run_id: ctx.runId, concept: i.concept, hook: i.hook, format: i.format, why: i.why || null, based_on_post_ids: i.based_on, draft: i.draft })));
      return { summary: p.summary || `${p.ideas.length} ideas for @${account.handle}`, count: p.ideas.length, output: { account_id: account.id } };
    },
  });
}

/** One idea → a scripted card on the Plan. */
export async function ideaToPlan(sb: Sb, u: string, ideaId: string, day: string | null): Promise<{ item_id: string }> {
  const [i] = await sb.get<{ id: string; account_id: string | null; brand_id: string | null; concept: string; format: string; draft: IdeaDraft['draft']; status: string }>(`social_ideas?id=eq.${ideaId}&user_id=eq.${u}&select=id,account_id,brand_id,concept,format,draft,status`);
  if (!i) throw new Error('That idea is gone.');
  const d = i.draft ?? ({} as IdeaDraft['draft']);
  const [item] = await sb.insert<{ id: string }>('content_items', { user_id: u, account_id: i.account_id, brand_id: i.brand_id, status: d.script ? 'script' : 'idea', concept: i.concept, hooks: d.hooks ?? [], script: d.script ? scriptBody({ script: d.script, on_screen_text: d.on_screen_text ?? '', cta: d.cta ?? '' }) : null, shot_list: d.shot_list ?? [], caption: d.caption || null, hashtags: d.hashtags || null, format: FORMATS.includes(i.format) ? i.format : 'reel', scheduled_for: day });
  await sb.patch('social_ideas', `id=eq.${i.id}&user_id=eq.${u}`, { status: 'planned', content_item_id: item.id, updated_at: now() });
  return { item_id: item.id };
}

/** After grades are applied: winners become briefs, flops get a reason. */
export async function afterGrades(sb: Sb, u: string, items: { post_id: string; avg: number; change: string; flag: 'breakout' | 'flop' | null }[]): Promise<{ briefs: number; flops: number }> {
  const flagged = items.filter((i) => i.flag);
  if (!flagged.length) return { briefs: 0, flops: 0 };
  const rows = await sb.get<PostFacts>(`social_posts?id=in.(${flagged.map((f) => f.post_id).join(',')})&user_id=eq.${u}&select=id,account_id,hook,caption,type,length_sec,posted_at`);
  const accts = [...new Set(rows.map((r) => r.account_id))];
  const peersAll: MeasuredPost[] = [];
  for (const a of accts) peersAll.push(...await measuredPosts(sb, u, { accountId: a, sinceIso: new Date(Date.now() - 60 * 86400000).toISOString() }));
  let briefs = 0, flops = 0;
  for (const f of flagged) {
    const r = rows.find((x) => x.id === f.post_id);
    if (!r) continue;
    const m = peersAll.find((p) => p.id === r.id);
    const facts: PostFacts = { ...r, views: m?.views ?? null, saves: m?.saves ?? null, shares: m?.shares ?? null };
    if (f.flag === 'breakout') {
      await sb.insert('content_briefs', { user_id: u, account_id: r.account_id, post_id: r.id, kind: 'winner', brief: winnerBrief(facts, f.avg, f.change) }, { upsert: 'post_id,kind', ignore: true }).catch(() => {});
      briefs++;
    } else {
      await sb.patch('social_posts', `id=eq.${r.id}&user_id=eq.${u}`, { flop_reason: flopReason(facts, f.avg, peersAll.filter((p) => p.account_id === r.account_id && p.id !== r.id)), updated_at: now() }).catch(() => {});
      flops++;
    }
  }
  return { briefs, flops };
}

/** 👍 on a post = a "liked" brief the next ideas run reads. */
export async function likedPostBrief(sb: Sb, u: string, postId: string): Promise<void> {
  const [r] = await sb.get<PostFacts>(`social_posts?id=eq.${postId}&user_id=eq.${u}&select=id,account_id,hook,caption,type,length_sec,posted_at`);
  if (!r) return;
  const posts = await measuredPosts(sb, u, { accountId: r.account_id, sinceIso: new Date(Date.now() - 60 * 86400000).toISOString() });
  const { graded } = gradeMeasured(posts);
  const g = graded.find((x) => x.id === postId);
  const m = posts.find((x) => x.id === postId);
  await sb.insert('content_briefs', { user_id: u, account_id: r.account_id, post_id: r.id, kind: 'liked', brief: winnerBrief({ ...r, views: m?.views ?? null }, g?.avg ?? 0, 'Marq liked this one — keep its feel.') }, { upsert: 'post_id,kind', ignore: true }).catch(() => {});
}

/** The ecom_brand_to_content handoff → a content kit for Marq to approve. */
export function buildContentKit(apiKey: string | undefined, sb: Sb, u: string, input: { handoffId?: string; trigger?: Trigger } = {}): Promise<RunOutcome> {
  return runWorker(apiKey, sb, u, {
    key: 'content_orchestrator', task: 'Building a launch content kit', input: { handoff_id: input.handoffId ?? null }, trigger: input.trigger, entityType: 'handoff', entityId: input.handoffId ?? null,
    async execute(ctx) {
      const q = input.handoffId ? `id=eq.${input.handoffId}` : 'status=eq.open&order=created_at.asc&limit=1';
      const [h] = await sb.get<{ id: string; payload: BrandKit }>(`ai_handoffs?user_id=eq.${u}&kind=eq.ecom_brand_to_content&${q}&select=id,payload`).catch(() => [] as { id: string; payload: BrandKit }[]);
      if (!h) return { summary: 'No new brand waiting for a content kit.', skipped: true };
      await sb.patch('ai_handoffs', `id=eq.${h.id}`, { status: 'working' }).catch(() => {});
      const res = await ctx.ask({ maxTokens: 9000, system: kitSystem(ctx.brief), user: kitUser(h.payload) });
      const kit = parseKit(res.text, h.payload);
      const checklist = kitChecklist(kit);
      const [row] = await sb.insert<{ id: string }>('content_kits', { user_id: u, brand_id: kit.brand_id, handoff_id: h.id, kit, checklist, status: 'draft' });
      return { summary: kit.summary || `Content kit for ${kit.brand}: ${kit.posts.length} posts, 2-week plan`, count: kit.posts.length, approval: { type: 'content_kit', title: `Content kit: ${kit.brand} — ${kit.posts.length} posts, 2 directions, 2-week plan`, payload: { ...kit, kit_id: row?.id ?? null, handoff_id: h.id, checklist }, principle: 'One store, one IG + one TikTok, two creative directions on the same pages.', entity_type: 'brand', entity_id: kit.brand_id } };
    },
  });
}

/** Approving the kit: the 9 posts land on the Plan (unassigned until the
 *  accounts exist), the kit is approved, the handoff is done. */
export async function applyContentKit(sb: Sb, u: string, raw: Record<string, unknown>): Promise<{ added: number }> {
  const k = raw as unknown as KitPayload & { kit_id?: string | null; handoff_id?: string | null };
  const start = addDaysIso(new Date().toISOString().slice(0, 10), 1);
  const accts = await sb.get<{ id: string; platform: string }>(`social_accounts?user_id=eq.${u}&brand_id=eq.${k.brand_id}&select=id,platform`).catch(() => [] as { id: string; platform: string }[]);
  const rows = k.posts.map((p, i) => {
    const slot = k.plan.find((s) => s.post === i);
    const acct = slot && slot.platform !== 'both' ? accts.find((a) => a.platform === slot.platform) : accts[0];
    return { user_id: u, account_id: acct?.id ?? null, brand_id: k.brand_id, status: 'script', concept: `[${p.direction}] ${p.concept}`, hooks: p.hooks, script: scriptBody(p), shot_list: p.shot_list, caption: p.caption || null, hashtags: p.hashtags || null, format: p.format, scheduled_for: addDaysIso(start, slot?.day ?? p.day), scheduled_time: slot?.time ?? null };
  });
  if (rows.length) await sb.insert('content_items', rows);
  if (k.kit_id) await sb.patch('content_kits', `id=eq.${k.kit_id}&user_id=eq.${u}`, { status: 'approved', updated_at: now() }).catch(() => {});
  if (k.handoff_id) await sb.patch('ai_handoffs', `id=eq.${k.handoff_id}`, { status: 'done', done_at: now() }).catch(() => {});
  return { added: rows.length };
}

/** Adds the six own-account rows (3 owners × IG/TikTok) that don't exist yet. */
export async function seedOwnAccounts(sb: Sb, u: string): Promise<{ added: number }> {
  const have = await sb.get<{ owner: string; platform: string }>(`social_accounts?user_id=eq.${u}&owner=in.(mastermind,madebymarq,personal)&select=owner,platform`);
  const rows = OWN_ACCOUNTS.flatMap((a) => (['instagram', 'tiktok'] as const).filter((p) => !have.some((h) => h.owner === a.owner && h.platform === p)).map((platform) => ({ user_id: u, platform, handle: a.handle, display_name: a.display, owner: a.owner, voice: a.voice, posts_per_week_goal: 3, connected: false })));
  if (rows.length) await sb.insert('social_accounts', rows);
  return { added: rows.length };
}

/** Drop the second of each identical caption+media pair from the publish queue. */
export async function holdDuplicates(sb: Sb, u: string, day: string): Promise<number> {
  const items = await sb.get<{ id: string; account_id: string | null; scheduled_for: string | null; caption: string | null }>(`content_items?user_id=eq.${u}&scheduled_for=eq.${day}&publish_status=eq.queued&select=id,account_id,scheduled_for,caption`);
  if (items.length < 2) return 0;
  const clips = await sb.get<{ content_item_id: string; storage_path: string | null; rendered_path: string | null }>(`content_clips?user_id=eq.${u}&content_item_id=in.(${items.map((i) => i.id).join(',')})&select=content_item_id,storage_path,rendered_path`).catch(() => [] as { content_item_id: string; storage_path: string | null; rendered_path: string | null }[]);
  const media = (id: string) => { const c = clips.find((x) => x.content_item_id === id); return c?.rendered_path ?? c?.storage_path ?? null; };
  const conflicts = variantConflicts(items.map((i) => ({ ...i, media_key: media(i.id) })));
  const hold = [...new Set(conflicts.map((c) => c.b))];
  for (const id of hold) await sb.patch('content_items', `id=eq.${id}&user_id=eq.${u}`, { publish_status: 'failed', publish_error: 'Held: the same caption and video is going out on another account today. Change the hook, caption or cut so it\'s a unique variant.', updated_at: now() });
  return hold.length;
}
