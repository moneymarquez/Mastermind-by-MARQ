import type { BuildOutVariant } from './marketingBuildOut';

// Pure text formatting only — no network call, no API posting. Rule 6 of
// the build prompt: "No API posting — export blocks only, copy-pasted by
// hand into Meta/Google." These just shape the same generated copy into
// the fields each platform's ad manager actually asks for.

export function buildMetaExportBlock(variants: BuildOutVariant[], caption: string | null): string {
  const lines: string[] = [];
  variants.forEach((v, i) => {
    lines.push(`Variant ${i + 1}`);
    lines.push(`Primary text: ${v.body}`);
    lines.push(`Headline: ${v.headline}`);
    lines.push('');
  });
  if (caption) {
    lines.push('Caption (for an organic/boosted post):');
    lines.push(caption);
  }
  return lines.join('\n').trim();
}

export function buildGoogleExportBlock(variants: BuildOutVariant[]): string {
  const lines: string[] = ['Headlines:'];
  variants.forEach((v) => lines.push(`- ${v.headline}`));
  lines.push('', 'Descriptions:');
  variants.forEach((v) => lines.push(`- ${v.body}`));
  return lines.join('\n').trim();
}
