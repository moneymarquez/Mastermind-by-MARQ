// Starter Ideas Bank content — loaded via the "Load starter ideas" button
// on the Streaming screen (client-side bulk insert through the signed-in
// Supabase client, same reasoning as fastFoodSeed.ts/workoutLibrarySeed.ts:
// SQL Editor sessions aren't authenticated as a user, so auth.uid()-
// defaulted rows can't be seeded via SQL directly).
import type { StreamFormat } from './types';

export interface StreamingIdeaSeedItem {
  title: string;
  format: StreamFormat;
  vibe: string;
  description: string;
}

export const STREAMING_IDEAS_SEED: StreamingIdeaSeedItem[] = [
  // Solo
  { title: 'Late Night Horror Run', format: 'solo', vibe: 'Horror', description: 'Slow-burn horror game, lights off, minimal commentary, let the game do the work.' },
  { title: 'Blind Horror Reactions', format: 'solo', vibe: 'Horror', description: 'First-time playthrough of a horror game picked by chat, no research beforehand.' },
  { title: 'Horror Game Ranking Series', format: 'solo', vibe: 'Horror', description: 'Play through a list of indie horror titles back to back, rank them at the end of each stream.' },
  { title: 'Speedrun Attempts', format: 'solo', vibe: 'Challenge', description: 'Comfort game speedrun practice, casual chat vibe, low stakes.' },
  { title: 'Build Something Live', format: 'solo', vibe: 'Talk', description: 'Screen-share building a feature for Mastermind or ABMARQ, dev-stream style for anyone into the business/tech side.' },
  { title: 'Late Night Q&A + Chill Game', format: 'solo', vibe: 'Talk', description: 'Low-key hangout stream, answer chat questions about the agency/solar/streaming while playing something background-friendly.' },
  { title: 'War Games Night', format: 'solo', vibe: 'Challenge', description: 'Squad-based shooter or strategy game, competitive but casual, chat picks the loadout/strategy.' },
  { title: 'Retro Replay', format: 'solo', vibe: 'Horror', description: 'Revisit a childhood horror or action game, nostalgia-driven commentary.' },

  // Duo (with girlfriend)
  { title: 'iCarly-Style Variety Hour', format: 'duo', vibe: 'Talk', description: 'Loose, bit-based variety stream — games, random skits, chat games, no fixed format, just personality-driven like an internet talk show.' },
  { title: 'Couples Horror Co-op', format: 'duo', vibe: 'Horror', description: 'Co-op horror game, reactions are the whole point, camera-forward.' },
  { title: 'Cook-Off Challenge', format: 'duo', vibe: 'Cooking', description: 'Mystery basket or recipe challenge cooked live, judged by chat.' },
  { title: 'Recipe Redo', format: 'duo', vibe: 'Cooking', description: 'Recreate a viral recipe live, react to how it actually turns out.' },
  { title: 'This or That: Couples Edition', format: 'duo', vibe: 'Talk', description: 'Rapid-fire relationship/opinion games, chat submits the questions.' },
  { title: 'Horror Game, She Plays / He Reacts', format: 'duo', vibe: 'Horror', description: 'Role-swap format — one plays, one only watches/reacts on camera, swap halfway.' },
  { title: 'Build a Stream Setup Live', format: 'duo', vibe: 'Talk', description: 'Behind-the-scenes stream improving the actual streaming setup/overlay, meta and fun for new viewers.' },
  { title: 'Taste Test Roulette', format: 'duo', vibe: 'Cooking', description: 'Blind taste-test challenge, loser does a dare, low production, high chaos.' },
  { title: 'Podcast-Style Ramble', format: 'duo', vibe: 'Talk', description: 'Sit-down, mic-forward, talk-show format — react to news, agency stuff, relationship stories, no game running.' },
  { title: 'Couples Challenge Series', format: 'duo', vibe: 'Challenge', description: 'Physical or trivia challenge series with a running scoreboard across multiple streams.' },
  { title: 'Cooking Fails Only', format: 'duo', vibe: 'Cooking', description: 'Deliberately pick recipes above skill level, lean into the chaos and mess-ups.' },
  { title: 'Fan-Picked Chaos Night', format: 'duo', vibe: 'Challenge', description: 'Chat votes live between three activity options (game / cook / challenge), format changes every 10 minutes.' },
];
