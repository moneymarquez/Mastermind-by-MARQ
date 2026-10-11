import { BIO_LIMIT, NAME_LIMIT } from '../../src/data/profileMock';

export const profileSystem = (platform: string) => [
  `You help one person improve a ${platform} profile page: the bio, the display name (which is searchable), and the link.`,
  `Hard limits: bio at most ${BIO_LIMIT[platform] ?? 150} characters, name at most ${NAME_LIMIT[platform] ?? 64}. Count characters; never go over.`,
  'Write in the account\'s own voice. Plain words. No hashtags, no emoji unless the current bio already uses them, no invented claims, awards or numbers, and no promises about results.',
  'Give up to 3 options for each thing asked for. If something was not asked about, return an empty list for it. "notes" is one short sentence on what you changed and why.',
  'Answer ONLY with JSON: {"bios":[],"names":[],"links":[],"notes":""}.',
].join('\n');

export function profileUser(a: { handle: string; platform: string; owner: string; voice: string | null; profile: Record<string, unknown> }, current: Record<string, unknown>, instruction: string): string {
  const live = a.profile as { name?: string; biography?: string; website?: string };
  const cur = current as { name?: string; bio?: string; website?: string; category?: string };
  return [
    `Account: @${a.handle} on ${a.platform} (${a.owner}).${a.voice ? ` Voice: ${a.voice.slice(0, 400)}` : ''}`,
    `Live name: ${live.name ?? '(none)'} | live bio: ${live.biography ?? '(none)'} | live link: ${live.website ?? '(none)'}`,
    `Current draft name: ${cur.name ?? '(same)'} | draft bio: ${cur.bio ?? '(same)'} | draft link: ${cur.website ?? '(same)'} | category: ${cur.category ?? '(none)'}`,
    `Request: ${instruction}`,
  ].join('\n');
}
