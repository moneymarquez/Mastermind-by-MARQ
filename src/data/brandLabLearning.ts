import type { BrandLabBrief, Niche } from './types';

// Step 8 — the learning loop, computed rather than stored. Every
// approved brief already carries: rounds_to_approval, the benchmarks
// that were in the prompt (benchmarks_used), the operator's verdict on
// each (benchmark_feedback), what made it land (approval_notes), and
// what the niche research got wrong (niche_feedback). Aggregating those
// per niche is the whole loop — no model, no extra table, and it can't
// drift from the source rows.

export interface BenchmarkStat {
  url: string;
  note: string;
  /** Briefs whose prompt referenced this benchmark. */
  used: number;
  helpful: number;
  unhelpful: number;
}

export interface NicheLearning {
  slug: string;
  name: string;
  briefs: number;
  approved: number;
  avgRounds: number | null;
  /** Approved briefs, fewest rounds first (up to 3). */
  fastest: BrandLabBrief[];
  benchmarks: BenchmarkStat[];
  feedback: { business: string; text: string }[];
  /** One plain sentence, e.g. "Plumbing briefs average 4 rounds…". */
  insight: string;
}

function nicheNameFor(slug: string, niches: Niche[]): string {
  if (slug === 'other') return 'Other (freeform)';
  return niches.find((n) => n.slug === slug)?.name ?? slug;
}

export function benchmarkStats(briefs: BrandLabBrief[]): BenchmarkStat[] {
  const map = new Map<string, BenchmarkStat>();
  for (const b of briefs) {
    for (const bm of b.benchmarks_used ?? []) {
      const key = bm.url.trim().toLowerCase();
      if (!key) continue;
      const stat = map.get(key) ?? { url: bm.url, note: bm.note, used: 0, helpful: 0, unhelpful: 0 };
      stat.used += 1;
      const fb = (b.benchmark_feedback ?? []).find((f) => f.url.trim().toLowerCase() === key);
      if (fb) {
        if (fb.helpful) stat.helpful += 1;
        else stat.unhelpful += 1;
      }
      map.set(key, stat);
    }
  }
  return [...map.values()].sort((a, b) => b.helpful - a.helpful || b.used - a.used);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function learnByNiche(briefs: BrandLabBrief[], niches: Niche[]): NicheLearning[] {
  const groups = new Map<string, BrandLabBrief[]>();
  for (const b of briefs) {
    const slug = b.niche_slug ?? 'other';
    groups.set(slug, [...(groups.get(slug) ?? []), b]);
  }
  const out: NicheLearning[] = [];
  for (const [slug, list] of groups) {
    const approved = list.filter((b) => b.rounds_to_approval !== null && b.rounds_to_approval !== undefined);
    const avg = approved.length ? Math.round((approved.reduce((s, b) => s + (b.rounds_to_approval ?? 0), 0) / approved.length) * 10) / 10 : null;
    const fastest = [...approved].sort((a, b) => (a.rounds_to_approval ?? 0) - (b.rounds_to_approval ?? 0)).slice(0, 3);
    const name = nicheNameFor(slug, niches);
    const feedback = list.filter((b) => b.niche_feedback?.trim()).map((b) => ({ business: b.business || b.direction, text: b.niche_feedback!.trim() }));

    let insight: string;
    if (approved.length === 0) {
      insight = `${name}: ${plural(list.length, 'brief')} started, none approved yet — nothing to learn from until a design is locked.`;
    } else {
      const minRounds = fastest[0].rounds_to_approval ?? 0;
      const quick = approved.filter((b) => b.rounds_to_approval === minRounds);
      const tones = [...new Set(quick.map((b) => b.tone).filter((t): t is string => !!t))];
      const helpfulUrls = [...new Set(quick.flatMap((b) => (b.benchmark_feedback ?? []).filter((f) => f.helpful).map((f) => f.url)))];
      const notes = quick.map((b) => b.approval_notes?.trim()).filter((n): n is string => !!n);
      const parts: string[] = [`${name} briefs average ${avg} ${avg === 1 ? 'round' : 'rounds'} to approval (${approved.length} of ${list.length} approved).`];
      const quickDesc = `The ${quick.length === 1 ? 'one' : quick.length} that approved in ${plural(minRounds, 'round')}`;
      const what: string[] = [];
      if (tones.length) what.push(`used tone “${tones.join('” / “')}”`);
      if (helpfulUrls.length) what.push(`leaned on ${helpfulUrls.slice(0, 3).join(', ')}`);
      if (notes.length) what.push(`noted: “${notes[0].slice(0, 140)}${notes[0].length > 140 ? '…' : ''}”`);
      if (what.length) parts.push(`${quickDesc} ${what.join('; ')}.`);
      insight = parts.join(' ');
    }

    out.push({ slug, name, briefs: list.length, approved: approved.length, avgRounds: avg, fastest, benchmarks: benchmarkStats(list), feedback, insight });
  }
  return out.sort((a, b) => b.briefs - a.briefs || a.name.localeCompare(b.name));
}
