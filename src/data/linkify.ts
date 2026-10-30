/** Splits message text into plain pieces and links, so a verification link or a phone number in the inbox can be tapped.
 *  Only http(s) links, bare www. links and email addresses become links; nothing else (no javascript:, no data:). Pure. */
export type LinkPart = { text: string; href?: string };

const URL_RE = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
// Sentence punctuation right after a link isn't part of it.
const TRAIL = /[.,;:!?]+$/;

export function linkify(text: string): LinkPart[] {
  const out: LinkPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0];
    const start = m.index ?? 0;
    const trail = raw.match(TRAIL)?.[0] ?? '';
    if (trail) raw = raw.slice(0, -trail.length);
    if (!raw) continue;
    if (start > last) out.push({ text: text.slice(last, start) });
    const href = /^https?:\/\//i.test(raw) ? raw : raw.startsWith('www.') ? `https://${raw}` : `mailto:${raw}`;
    out.push({ text: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}
