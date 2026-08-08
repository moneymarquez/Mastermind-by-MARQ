import { askClaude } from './ai';
import type { SobrietyCheckin } from '../data/types';

const NOVA_SOBRIETY_STANCE =
  "You are Nova, inside Cristopher's personal tracker. Important context: this is NOT a quit-drinking/quit-smoking " +
  'tool and Cristopher is not trying to reach abstinence — the goal is harm reduction, body regulation, and feeling ' +
  'better. Never moralize, never push sobriety as an end goal, never use recovery-app language ("relapse", ' +
  '"clean streak" as a virtue, etc). You are a realistic, non-judgmental coach, not a recovery program.';

function checkinsSummary(checkins: SobrietyCheckin[]): string {
  return checkins
    .slice(0, 21)
    .map((c) => {
      const flags = [c.drank && 'drank', c.weed && 'weed', c.nicotine && 'nicotine'].filter(Boolean).join(', ');
      return `${c.checkin_date}: ${flags || 'nothing logged'}${c.note ? ` — "${c.note}"` : ''}`;
    })
    .join('\n');
}

// Looks at the trailing ~3 weeks for a creeping pattern (worth a gentle
// nudge) vs. a stable one (worth asking "why" to understand the function it
// serves — productivity, unwinding, social, stress relief). Either way this
// is a single short message, not a report.
export async function checkSobrietyPattern(checkins: SobrietyCheckin[]): Promise<string> {
  return askClaude({
    system:
      NOVA_SOBRIETY_STANCE +
      ' Look at the trailing check-ins for a pattern. If something looks like it\'s creeping up (frequency ' +
      'increasing, more heavy days), flag it directly but gently — a nudge, not a lecture, e.g. offering to dial it ' +
      'back if he wants. If the pattern looks stable/fine, don\'t just say "looks good" — ask what function it\'s ' +
      'serving (productivity, unwinding, social, stress relief) so there\'s a real picture of it, not just a count. ' +
      '2-4 sentences, direct, conversational.',
    messages: [{ role: 'user', content: `Trailing check-ins:\n${checkinsSummary(checkins)}` }],
    maxTokens: 300,
  });
}

// On-demand factual explainer, not part of the automatic flow — surfaced
// behind a button since the spec calls for this only "if asked."
export async function explainDependencyVsModerateUse(): Promise<string> {
  return askClaude({
    system:
      NOVA_SOBRIETY_STANCE +
      ' Cristopher is asking you to explain the real, factual difference between dependency/problem use and normal ' +
      'moderate use (e.g. a couple beers here and there, occasional nicotine). Be factual and non-alarmist — this is ' +
      'to help him self-assess, not a diagnosis. Cover things like: frequency/quantity trends, whether use is tied ' +
      'to a specific function vs. compulsive, withdrawal/tolerance signs, impact on daily functioning, and control ' +
      '(can he skip it without difficulty). Plain language, 5-8 sentences.',
    messages: [{ role: 'user', content: "What's the real difference between dependency and normal moderate use?" }],
    maxTokens: 500,
  });
}
