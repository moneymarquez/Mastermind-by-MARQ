// People lists (brief §4.9). Pure defaults and the owner automations that
// Phase 5's Comms hub runs for each list.

export const DEFAULT_LISTS = ['Recruiting', 'Possible business', 'Masterminds lead', 'Made by Marq hire', 'Clients'];

/** Owner-only: what joining a list sets off (Comms, Phase 5). Solo users get lists + follow-ups only. */
export const LIST_AUTOMATIONS: Record<string, { kind: 'email_sequence' | 'research_packet' | 'follow_up'; label: string }> = {
  'Masterminds lead': { kind: 'email_sequence', label: 'Starts the Masterminds lead email sequence' },
  Recruiting: { kind: 'research_packet', label: 'Sends the research packet and a Loom interview link' },
  'Made by Marq hire': { kind: 'research_packet', label: 'Sends the research packet and a Loom interview link' },
  'Possible business': { kind: 'follow_up', label: 'Sets a follow-up reminder in 3 days' },
};

export function followUpTaskTitle(name: string, lists: string[]): string {
  return `Follow up with ${name}${lists.length ? ` (${lists.slice(0, 2).join(', ')})` : ''}`.slice(0, 300);
}
