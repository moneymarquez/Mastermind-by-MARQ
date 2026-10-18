// An approved product gets 5 short-video drafts in the Content plan, one a
// day for the next 5 days, built from what the Analyst already found (hooks,
// angle, competitors' complaints, why it suits AI video). No AI call, so it
// costs nothing; each draft carries a Higgsfield prompt, and generating the
// clip stays a deliberate tap because every generation is billed.
//
// Drafts are status 'script' with no publish_status, and the Publisher only
// touches publish_status queued/publishing/processing, so nothing posts until
// Marq approves and queues it.
import type { Sb } from './sb';

interface ProductLike { name: string; detail?: { angle?: string; problem?: string; buyer?: string; card?: { hooks?: string[]; film?: string; signals?: { complaints?: string[]; ai_video_why?: string } } } | null }
export interface VideoDraft { concept: string; hooks: string[]; script: string; shot_list: string[]; caption: string; visual_prompt: string; format: 'short'; scheduled_for: string }

const clean = (s: string | undefined | null) => (s ?? '').trim();
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Five distinct angles for one product. Pure. */
export function videoDrafts(p: ProductLike, startYmd: string): VideoDraft[] {
  const name = clean(p.name);
  const d = p.detail ?? {};
  const card = d.card ?? {};
  const hooks = (card.hooks ?? []).map(clean).filter(Boolean);
  const complaint = clean(card.signals?.complaints?.[0]);
  const problem = clean(d.problem) || `the problem ${name} solves`;
  const angle = clean(d.angle);
  const buyer = clean(d.buyer);
  const style = 'Vertical 9:16, 8–12 seconds, natural light, clean background, no on-screen brand names or logos, show only what the product really does.';
  const plans: Omit<VideoDraft, 'format' | 'scheduled_for'>[] = [
    { concept: `Launch: the 3-second reveal of ${name}`, hooks: [hooks[0] || `Wait, why didn't anyone make this sooner?`], script: `Open on the product in use, no intro. Text: "${hooks[0] || 'Why didn\'t anyone make this sooner?'}" Cut to the result. End on the product alone.`, shot_list: ['Close-up in use', 'The result', 'Product alone, slow push-in'], caption: `${angle || `Meet ${name}.`}`, visual_prompt: `Cinematic product reveal of ${name} on a clean surface, slow push-in, soft light. ${style}` },
    { concept: `Before / after with ${name}`, hooks: [hooks[1] || `Before vs after. Same 10 seconds.`], script: `Split the screen or cut hard: the problem (${problem}), then the same moment with ${name}. No talking, let the difference land.`, shot_list: ['Before: the problem', 'Hard cut', 'After: with the product'], caption: `Before and after. ${problem.charAt(0).toUpperCase()}${problem.slice(1)}, fixed.`, visual_prompt: `Before-and-after sequence showing ${problem}, then ${name} solving it, matching camera angle. ${style}` },
    { concept: `Who it's for: ${buyer || 'the exact person who needs it'}`, hooks: [hooks[2] || `If you're ${buyer || 'this person'}, this is for you.`], script: `Call out the buyer in the first line. Show their everyday moment, then ${name} in it. One line on why it fits.`, shot_list: ['Everyday moment', 'Product enters', 'Satisfied result'], caption: `${buyer ? `For ${buyer}.` : 'Made for one person. Is it you?'}`, visual_prompt: `Lifestyle scene: ${buyer || 'a person at home'} using ${name} naturally in their routine, warm light. ${style}` },
    { concept: complaint ? `The fix nobody else made: "${complaint}"` : `What the cheap versions get wrong`, hooks: [complaint ? `Everyone complains about "${complaint.slice(0, 50)}". Not this one.` : `I tried the cheap ones so you don't have to.`], script: `Name the common complaint, show the moment it fails on a generic version, then show ${name} doing it right.`, shot_list: ['The usual failure', 'Our version', 'Detail close-up'], caption: complaint ? `Fixed what everyone complains about.` : `Not all of these are the same.`, visual_prompt: `Detail macro shots of ${name} highlighting build quality and the part that matters, studio light. ${style}` },
    { concept: `Satisfying loop: ${name}`, hooks: ['Watch it one more time.'], script: `A seamless loop of the most satisfying moment of using ${name}. No text until the last second: the price or "link in bio".`, shot_list: ['The satisfying moment', 'Loop point', 'End card'], caption: `This is oddly satisfying.`, visual_prompt: `Seamless looping clip of the most satisfying moment of using ${name}, smooth motion, ASMR feel. ${card.signals?.ai_video_why ? card.signals.ai_video_why + ' ' : ''}${style}` },
  ];
  return plans.map((x, i) => ({ ...x, format: 'short', scheduled_for: addDays(startYmd, i + 1) }));
}

/** Create the 5 drafts for a brand's product, once. Returns how many were made. */
export async function queueProductVideos(sb: Sb, u: string, brandId: string, todayYmd: string): Promise<number> {
  const existing = await sb.get<{ id: string }>(`content_items?user_id=eq.${u}&brand_id=eq.${brandId}&select=id&limit=1`);
  if (existing.length) return 0;
  const [link] = await sb.get<{ product_id: string }>(`ecom_brand_products?user_id=eq.${u}&brand_id=eq.${brandId}&order=created_at.asc&limit=1&select=product_id`);
  if (!link) return 0;
  const [p] = await sb.get<ProductLike>(`ecom_products?id=eq.${link.product_id}&user_id=eq.${u}&select=name,detail`);
  if (!p) return 0;
  const [acct] = await sb.get<{ id: string }>(`social_accounts?user_id=eq.${u}&brand_id=eq.${brandId}&select=id&limit=1`);
  const rows = videoDrafts(p, todayYmd).map((v) => ({ user_id: u, brand_id: brandId, account_id: acct?.id ?? null, status: 'script', ...v }));
  await sb.insert('content_items', rows);
  return rows.length;
}
