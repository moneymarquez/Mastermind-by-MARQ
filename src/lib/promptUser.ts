// Bug inventory B-07: many AI prompts were written for the owner and name
// him ("Cristopher's tracker… he just logged…"). Every prompt passes
// through askClaude/askNova, so they are personalised here once: for the
// owner nothing changes; for anyone else the name — and the pronouns
// that refer to him — become the account's first name, or "the user".
// Using the name for pronouns too keeps the grammar right ("if Sam
// wants", "Sam's notes") without guessing anyone's pronouns.
let current: { owner: boolean; name: string } = { owner: true, name: '' };

export function setPromptUser(owner: boolean, displayName: string | null | undefined): void {
  const first = (displayName ?? '').trim().split(/\s+/)[0] ?? '';
  current = { owner, name: first };
}

export function personalizePrompt(system: string, who = current): string {
  if (who.owner) return system;
  const name = who.name || 'the user';
  const poss = who.name ? `${who.name}'s` : "the user's";
  return system
    .replace(/\bCristopher's\b/g, poss)
    .replace(/\bCristopher\b/g, name)
    .replace(/\b[Hh]e's\b/g, `${name}'s`)
    .replace(/\b[Hh]e'd\b/g, `${name} would`)
    .replace(/\b[Hh]imself\b/g, name)
    .replace(/\b[Hh]is\b/g, poss)
    .replace(/\b[Hh]im\b/g, name)
    .replace(/\b[Hh]e\b/g, name)
    .replace(/\bMarq's\b/g, poss)
    // A sentence that now starts with "the user" reads better capitalised.
    .replace(/(^|[.!?]\s+)the user/g, (_m, p: string) => `${p}The user`);
}
