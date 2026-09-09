import fundamentals from './marketing101/fundamentals.md?raw';
import plays from './marketing101/plays.md?raw';

/** Cristopher's own marketing training material — the permanent-principles
 *  doc (Fundamentals) and the tactical/channel-specifics doc (Plays) he
 *  writes and maintains himself. Loaded as raw text at build time so the
 *  Marketing tab can show it as reference reading, and so Nova can be
 *  handed it as grounding when a conversation is happening in a
 *  marketing-relevant screen — not summarized or rewritten, used exactly
 *  as he wrote it. */
export const MARKETING_101 = { fundamentals, plays };
