// Visual worker (brief §2.3 step 1): when Brand Lab files its three brand
// directions, plan ~6 images per direction (product hero, two lifestyle
// shots, a detail shot, the logo mark, packaging) and generate them with
// Higgsfield — images only, and every generation through checkSpend on the
// "visual" bucket. Video happens only after Marq picks a direction, also
// through checkSpend. Without a Higgsfield key the prompts are still saved
// ("planned"), so Marq sees exactly what would be made.
//
// Higgsfield's REST API: the adapter below posts to HIGGSFIELD_API_URL
// (default https://platform.higgsfield.ai) with the key in hf-api-key. The
// exact endpoint isn't verified from the build sandbox — see
// docs/BUILD_DECISIONS.md; tests mock it.
import { Sb } from './sb';
import { guardSpend, recordSpend } from './controls';
import { isDryRun } from './dryRun';
import type { DryRunEnv } from './dryRun';

export interface VisualEnv extends DryRunEnv { HIGGSFIELD_API_KEY?: string; HIGGSFIELD_API_SECRET?: string; HIGGSFIELD_API_URL?: string }
let visualEnv: VisualEnv = {};
export function setVisualEnv(env: VisualEnv): void { visualEnv = { HIGGSFIELD_API_KEY: env.HIGGSFIELD_API_KEY, HIGGSFIELD_API_SECRET: env.HIGGSFIELD_API_SECRET, HIGGSFIELD_API_URL: env.HIGGSFIELD_API_URL, DRY_RUN: env.DRY_RUN }; }

export const IMAGE_COST_USD = 0.03;
export const VIDEO_COST_USD: Record<'480p' | '720p', number> = { '480p': 2, '720p': 4.6 };

export type VisualKind = 'hero' | 'lifestyle' | 'detail' | 'logo' | 'packaging' | 'video';
export interface Direction { name: string; positioning?: string; voice?: string; palette?: { hex: string; name: string }[]; logo_direction?: string; type?: { heading?: string } }
export interface VisualPlan { direction: number; direction_name: string; kind: VisualKind; prompt: string }

/** Six image prompts per direction, in the direction's own palette and voice. Pure. */
export function planVisuals(product: string, options: Direction[]): VisualPlan[] {
  const out: VisualPlan[] = [];
  options.slice(0, 3).forEach((d, i) => {
    const palette = (d.palette ?? []).map((c) => `${c.name || ''} ${c.hex}`.trim()).join(', ') || 'a restrained, premium palette';
    const look = `Brand "${d.name}" — ${d.positioning ?? ''}. Voice: ${d.voice ?? 'calm, exact'}. Palette: ${palette}. Photographic, natural light, no text overlays, no watermark.`;
    const shots: [VisualKind, string][] = [
      ['hero', `Product hero shot of ${product} on a clean surface in the brand palette, centered, soft shadow, e-commerce hero framing.`],
      ['lifestyle', `${product} in use by the target buyer at home, candid, warm, phone-camera realism.`],
      ['lifestyle', `${product} close at hand in a daily routine moment (morning or evening), lifestyle editorial.`],
      ['detail', `Macro detail of ${product}'s texture, material and build quality.`],
      ['logo', `Logo mark for "${d.name}": ${d.logo_direction ?? 'simple geometric monogram'}. Flat vector on plain background, ${palette}.`],
      ['packaging', `Shipping box and insert card for "${d.name}" with ${product}, unboxing angle.`],
    ];
    for (const [kind, p] of shots) out.push({ direction: i, direction_name: d.name, kind, prompt: `${p} ${kind === 'logo' ? '' : look}`.trim().slice(0, 1200) });
  });
  return out;
}

export interface GenResult { ok: boolean; url?: string; jobId?: string; error?: string; dryRun?: boolean }
/** One Higgsfield generation. */
export async function generate(env: VisualEnv, prompt: string, kind: VisualKind, f: typeof fetch = fetch): Promise<GenResult> {
  if (isDryRun(env)) return { ok: true, dryRun: true, url: undefined, jobId: 'dry-run' };
  if (!env.HIGGSFIELD_API_KEY) return { ok: false, error: 'Higgsfield isn\'t connected. Add the API key in Setup → Higgsfield (the API wallet is separate from the website subscription).' };
  const base = env.HIGGSFIELD_API_URL || 'https://platform.higgsfield.ai';
  const path = kind === 'video' ? '/v1/image2video' : '/v1/text2image';
  const res = await f(`${base}${path}`, {
    method: 'POST',
    headers: { 'hf-api-key': env.HIGGSFIELD_API_KEY, ...(env.HIGGSFIELD_API_SECRET ? { 'hf-secret': env.HIGGSFIELD_API_SECRET } : {}), 'content-type': 'application/json' },
    body: JSON.stringify({ params: { prompt, ...(kind === 'video' ? { duration: 10, resolution: '480p' } : { width_and_height: kind === 'logo' ? '1024x1024' : '1152x1536', batch_size: 1 }) } }),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) }) as unknown as Response);
  const j = (await res.json().catch(() => ({}))) as { id?: string; jobs?: { id?: string; results?: { raw?: { url?: string } } }[]; url?: string; error?: string; detail?: string };
  if (!res.ok) return { ok: false, error: `Higgsfield ${res.status}: ${j.error ?? j.detail ?? 'request failed'}` };
  return { ok: true, jobId: j.id ?? j.jobs?.[0]?.id, url: j.url ?? j.jobs?.[0]?.results?.raw?.url };
}

/** After Brand Lab files its options: plan and (budget permitting) generate the images. */
export async function afterBrandOptions(sb: Sb, u: string, approvalId: string, payload: Record<string, unknown>): Promise<{ planned: number; generated: number; blocked: string | null }> {
  const options = (payload.options ?? []) as Direction[];
  const brandId = (payload.brand_id as string | undefined) ?? null;
  if (!options.length) return { planned: 0, generated: 0, blocked: null };
  let product = 'the product';
  if (brandId) { const [b] = await sb.get<{ name: string; steps: Record<string, { fields?: Record<string, string> }> }>(`ecom_brands?id=eq.${brandId}&user_id=eq.${u}&select=name,steps`); product = b?.steps?.['1']?.fields?.product_name || b?.name || product; }
  const plan = planVisuals(product, options);
  const rows = await sb.insert<{ id: string; prompt: string; kind: VisualKind }>('ecom_visuals', plan.map((p) => ({ user_id: u, brand_id: brandId, approval_id: approvalId, direction: p.direction, direction_name: p.direction_name, kind: p.kind, prompt: p.prompt, status: 'planned' }))).catch(() => [] as { id: string; prompt: string; kind: VisualKind }[]);
  if (!rows.length || (!visualEnv.HIGGSFIELD_API_KEY && !isDryRun(visualEnv))) return { planned: rows.length, generated: 0, blocked: visualEnv.HIGGSFIELD_API_KEY ? null : 'Higgsfield not connected' };
  const total = rows.length * IMAGE_COST_USD;
  const v = await guardSpend(sb, u, { bucket: 'visual', label: `Brand images (${rows.length})` }, total, 'ecommerce');
  if (v.verdict !== 'allow') {
    await sb.patch('ecom_visuals', `approval_id=eq.${approvalId}&user_id=eq.${u}`, { status: v.verdict === 'block' ? 'blocked' : 'needs_approval', error: v.reason, updated_at: new Date().toISOString() });
    return { planned: rows.length, generated: 0, blocked: v.reason };
  }
  let generated = 0;
  for (const r of rows) {
    const g = await generate(visualEnv, r.prompt, r.kind);
    await sb.patch('ecom_visuals', `id=eq.${r.id}`, g.ok ? { status: g.url || g.dryRun ? 'ready' : 'generating', url: g.url ?? null, job_id: g.jobId ?? null, cost_usd: g.dryRun ? 0 : IMAGE_COST_USD, error: g.dryRun ? 'dry run — nothing generated' : null, updated_at: new Date().toISOString() } : { status: 'failed', error: g.error ?? 'failed', updated_at: new Date().toISOString() });
    if (g.ok) generated++;
    else break;
  }
  if (generated && !isDryRun(visualEnv)) await recordSpend(sb, u, { bucket: 'visual', label: `Higgsfield: ${generated} brand image${generated === 1 ? '' : 's'}` }, generated * IMAGE_COST_USD, { type: 'approval', id: approvalId });
  return { planned: rows.length, generated, blocked: null };
}

/** "Make a video" on the picked direction: always through checkSpend. */
export async function makeVideo(sb: Sb, u: string, brandId: string, prompt: string, resolution: '480p' | '720p' = '480p'): Promise<{ ok: boolean; status: string; reason: string }> {
  const cost = VIDEO_COST_USD[resolution];
  const v = await guardSpend(sb, u, { bucket: 'visual', label: `Brand video (${resolution})` }, cost, 'ecommerce');
  const [row] = await sb.insert<{ id: string }>('ecom_visuals', { user_id: u, brand_id: brandId, kind: 'video', prompt: prompt.slice(0, 1200), status: v.verdict === 'allow' ? 'generating' : v.verdict === 'block' ? 'blocked' : 'needs_approval', error: v.verdict === 'allow' ? null : v.reason });
  if (v.verdict !== 'allow') return { ok: false, status: v.verdict, reason: v.reason };
  const g = await generate(visualEnv, prompt, 'video');
  await sb.patch('ecom_visuals', `id=eq.${row.id}`, g.ok ? { status: g.url || g.dryRun ? 'ready' : 'generating', url: g.url ?? null, job_id: g.jobId ?? null, cost_usd: g.dryRun ? 0 : cost } : { status: 'failed', error: g.error });
  if (g.ok && !g.dryRun) await recordSpend(sb, u, { bucket: 'visual', label: `Higgsfield video (${resolution})` }, cost, { type: 'ecom_visual', id: row.id });
  return { ok: g.ok, status: g.ok ? 'generating' : 'failed', reason: g.error ?? (g.dryRun ? 'dry run' : 'started') };
}
