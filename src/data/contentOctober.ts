// Content, October build: the bits both the app and the Worker need. Pure.

/** Instagram's and TikTok's posting APIs can't delete or archive a
 *  published post, so "Pull" is honest: open it, take it down in the app,
 *  then confirm in Masterminds. */
export function pullHelp(platform: string): string {
  if (platform === 'instagram') return 'Open the post in Instagram → ⋯ → Archive (keeps it, hides it) or Delete. Then tap "I pulled it" here.';
  if (platform === 'tiktok') return 'Open the video in TikTok → ⋯ → Privacy settings → Only me (hides it) or Delete. Then tap "I pulled it" here.';
  return 'Take the post down in the app, then tap "I pulled it" here.';
}

/** Content kit checklist item. */
export interface KitStep { key: string; label: string; done: boolean }
export const kitProgress = (c: KitStep[]) => ({ done: c.filter((x) => x.done).length, total: c.length });
