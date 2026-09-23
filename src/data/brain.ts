/** The Brain tab's model — pure, no React, no network.
 *
 *  What this is: a DISC-style forced-choice assessment (24 items) with
 *  four Big Five items for conscientiousness and emotional stability,
 *  scored into a primary and secondary type and 1–5 tendencies; a plain-
 *  language results breakdown; a map from those tendencies onto the
 *  brain systems the traits are commonly associated with; an exercise
 *  library; and the maths behind the check-in patterns card.
 *
 *  What this is NOT, and must never be presented as: a scan, a measure
 *  of regional brain activity, a detector of trauma or history, or a
 *  diagnosis. The region labels are TENDENCIES derived from a
 *  questionnaire — a model for noticing patterns, stated as such in the
 *  UI (DISCLAIMER below). The genuinely valuable part is the check-ins:
 *  the user's own data, surfaced back over time. */

export type Disc = 'D' | 'I' | 'S' | 'C';
export type Trait = Disc | 'CON' | 'STAB';
export type Choice = 'a' | 'b';

export const ASSESSMENT_VERSION = 1;

export const DISCLAIMER = 'This maps your assessment to the systems these regions are associated with. It\'s a model for thinking about your patterns — not a scan.';

export interface Question {
  id: string;
  a: { text: string; trait: Trait };
  b: { text: string; trait: Trait };
}

/** 24 DISC pairs (each pair of letters appears four times, so every
 *  letter is tested twelve times) then four Big Five items. Forced
 *  choice: "which is more like you, most days at work". */
export const QUESTIONS: Question[] = [
  { id: 'q01', a: { text: 'I decide fast and fix it later', trait: 'D' }, b: { text: 'I get people on board before I decide', trait: 'I' } },
  { id: 'q02', a: { text: 'I push when someone stalls', trait: 'D' }, b: { text: 'I give people room and keep things calm', trait: 'S' } },
  { id: 'q03', a: { text: 'Good enough now beats perfect later', trait: 'D' }, b: { text: 'I want it right before it goes out', trait: 'C' } },
  { id: 'q04', a: { text: 'I talk my way through a problem', trait: 'I' }, b: { text: 'I work through it quietly and steadily', trait: 'S' } },
  { id: 'q05', a: { text: 'I sell the idea first, details second', trait: 'I' }, b: { text: 'I lay out the details so the idea sells itself', trait: 'C' } },
  { id: 'q06', a: { text: 'I keep the routine that works', trait: 'S' }, b: { text: 'I keep checking whether the routine is actually the best way', trait: 'C' } },
  { id: 'q07', a: { text: 'On a call I take control of the conversation', trait: 'D' }, b: { text: 'On a call I build rapport and let it flow', trait: 'I' } },
  { id: 'q08', a: { text: 'I set the pace and expect people to keep up', trait: 'D' }, b: { text: 'I match the pace of the people around me', trait: 'S' } },
  { id: 'q09', a: { text: 'I go with my gut on a number', trait: 'D' }, b: { text: 'I want the number to be checked', trait: 'C' } },
  { id: 'q10', a: { text: 'I get energy from new people', trait: 'I' }, b: { text: 'I get energy from familiar people', trait: 'S' } },
  { id: 'q11', a: { text: 'I improvise when the script stops working', trait: 'I' }, b: { text: 'I fix the script so it stops failing', trait: 'C' } },
  { id: 'q12', a: { text: 'I would rather be dependable than impressive', trait: 'S' }, b: { text: 'I would rather be precise than dependable', trait: 'C' } },
  { id: 'q13', a: { text: 'Losing a deal makes me want to hit the next one harder', trait: 'D' }, b: { text: 'Losing a deal makes me want to talk it through with someone', trait: 'I' } },
  { id: 'q14', a: { text: 'I say the hard thing in the room', trait: 'D' }, b: { text: 'I say the hard thing later, one on one', trait: 'S' } },
  { id: 'q15', a: { text: 'I start before the plan is finished', trait: 'D' }, b: { text: 'I finish the plan before I start', trait: 'C' } },
  { id: 'q16', a: { text: 'I would rather be liked than steady', trait: 'I' }, b: { text: 'I would rather be steady than liked', trait: 'S' } },
  { id: 'q17', a: { text: 'A rough plan and enthusiasm gets me going', trait: 'I' }, b: { text: 'A clear checklist gets me going', trait: 'C' } },
  { id: 'q18', a: { text: 'I avoid the argument to keep the peace', trait: 'S' }, b: { text: 'I avoid the argument until I have the facts', trait: 'C' } },
  { id: 'q19', a: { text: 'I want the win', trait: 'D' }, b: { text: 'I want the recognition', trait: 'I' } },
  { id: 'q20', a: { text: 'Change is a chance', trait: 'D' }, b: { text: 'Change is a cost', trait: 'S' } },
  { id: 'q21', a: { text: 'Rules are suggestions when they slow me down', trait: 'D' }, b: { text: 'Rules exist for a reason and I follow them', trait: 'C' } },
  { id: 'q22', a: { text: 'I fill silence', trait: 'I' }, b: { text: 'I am fine with silence', trait: 'S' } },
  { id: 'q23', a: { text: 'I trust a story more than a spreadsheet', trait: 'I' }, b: { text: 'I trust a spreadsheet more than a story', trait: 'C' } },
  { id: 'q24', a: { text: 'I finish what I started even when it stops being fun', trait: 'S' }, b: { text: 'I finish what I started even when it stops being efficient', trait: 'C' } },
  // Big Five reads — conscientiousness and emotional stability.
  { id: 'b01', a: { text: 'I do the boring part of the job on the day it is due', trait: 'CON' }, b: { text: 'I do the boring part of the job when I finally have to', trait: 'D' } },
  { id: 'b02', a: { text: 'When I say 4pm, it happens at 4pm', trait: 'CON' }, b: { text: 'When I say 4pm, it happens at some point that day', trait: 'I' } },
  { id: 'b03', a: { text: 'A bad call is gone from my head by the next dial', trait: 'STAB' }, b: { text: 'A bad call stays with me for the rest of the hour', trait: 'S' } },
  { id: 'b04', a: { text: 'Pressure makes me sharper', trait: 'STAB' }, b: { text: 'Pressure makes me scattered', trait: 'C' } },
];

export type Answers = Record<string, Choice>;

export interface Scores {
  D: number; I: number; S: number; C: number;
  /** 0–2 each: how many of the two items landed on the high side. */
  CON: number; STAB: number;
}

export function scoreAnswers(answers: Answers): Scores {
  const s: Scores = { D: 0, I: 0, S: 0, C: 0, CON: 0, STAB: 0 };
  for (const q of QUESTIONS) {
    const c = answers[q.id];
    if (!c) continue;
    const t = q[c].trait;
    // The Big Five items only count toward CON/STAB; their "low" side is
    // deliberately not credited to a DISC letter.
    if (q.id.startsWith('b')) { if (t === 'CON' || t === 'STAB') s[t] += 1; continue; }
    if (t === 'D' || t === 'I' || t === 'S' || t === 'C') s[t] += 1;
  }
  return s;
}

export function answeredCount(answers: Answers): number { return QUESTIONS.filter((q) => answers[q.id]).length; }
export function isComplete(answers: Answers): boolean { return answeredCount(answers) === QUESTIONS.length; }

/** Primary and secondary DISC type. Ties break toward the letter that
 *  reads as the more common sales profile (D, then I, S, C). */
export function types(s: Scores): { primary: Disc; secondary: Disc } {
  const order: Disc[] = ['D', 'I', 'S', 'C'];
  const sorted = [...order].sort((x, y) => s[y] - s[x] || order.indexOf(x) - order.indexOf(y));
  return { primary: sorted[0], secondary: sorted[1] };
}

/** 1–5 tendency from a 0–12 DISC score, or 0–2 Big Five score. */
export function tendency(trait: Trait, s: Scores): number {
  if (trait === 'CON' || trait === 'STAB') return 1 + s[trait] * 2;
  return Math.max(1, Math.min(5, Math.round(1 + (s[trait] * 4) / 12)));
}

export const TYPE_NAME: Record<Disc, string> = { D: 'Driver', I: 'Connector', S: 'Anchor', C: 'Analyst' };
export const TYPE_WORD: Record<Disc, string> = { D: 'Dominance', I: 'Influence', S: 'Steadiness', C: 'Conscientiousness' };

export interface Breakdown {
  title: string;
  what: string;
  helps: string[];
  costs: string[];
  product: { text: string; screen: string }[];
}

/** Plain language, second person, honest. Section 4 ties each weakness
 *  to a specific feature — that is what makes this part of the product. */
export function breakdown(primary: Disc, secondary: Disc, s: Scores): Breakdown {
  const con = s.CON >= 2 ? 'high' : s.CON === 1 ? 'mid' : 'low';
  const stab = s.STAB >= 2 ? 'high' : s.STAB === 1 ? 'mid' : 'low';
  const second = `Your second gear is ${TYPE_NAME[secondary]} (${TYPE_WORD[secondary].toLowerCase()}), which shows up when the first one isn't working.`;
  const conLine = con === 'low'
    ? 'Follow-through is the thing to watch: you answered that the boring part happens when it has to, not when it\'s due.'
    : con === 'high'
    ? 'You also read as high on follow-through — when you commit to a time, it happens.'
    : 'Follow-through is mixed — some days the commitment holds, some days it slides.';
  const stabCost = stab === 'low'
    ? 'A bad call stays with you into the next dial, which is where an hour of 35 turns into an hour of 20.'
    : 'Pressure doesn\'t knock you around much, so the risk isn\'t the bad call — it\'s the flat afternoon where nothing feels urgent.';

  const B: Record<Disc, Breakdown> = {
    D: {
      title: 'Driver',
      what: `You move first and adjust after. You want the outcome, you're comfortable with friction, and waiting on a plan feels like losing time. ${second} ${conLine}`,
      helps: [
        'You pick up the phone without warming up — the first dial of the hour is the hardest for most people and it isn\'t for you.',
        'You ask for the meeting. Most cold calls die because nobody asks; you ask early and plainly.',
        'Rejection bounces off you. A "not interested" costs you seconds, not the rest of the hour.',
      ],
      costs: [
        'You skip the boring setup — leads not loaded by 3:30 means an hour spent hunting numbers instead of dialing.',
        'You talk past the buying signal. Owners who were ready to book get pushed one sentence too far.',
        stabCost,
      ],
      product: [
        { text: 'The Daily Plan puts "move leads into the dialing list" at 3:30 as its own block, before the hour, so the setup you skip is done before you can skip it.', screen: 'daily-plan' },
        { text: 'The Dialing counter tracks dials, not deals, for the first two weeks — activity is the number you can actually control at your pace.', screen: 'dialing' },
        { text: 'The daily check-in asks how the hour felt. Over a few weeks it shows you which days you steamrolled and which days you were steady — and which closed more.', screen: 'brain' },
      ],
    },
    I: {
      title: 'Connector',
      what: `You lead with people. Conversation is where you're strongest, you read a room fast, and you'd rather build rapport than run a script. ${second} ${conLine}`,
      helps: [
        'You get owners talking. Gatekeepers soften, a two-minute call becomes ten, and the "why this lead" becomes a real conversation.',
        'You improvise when the script fails, which it does on every third call.',
        'People remember you. Callbacks and referrals are where you win over time.',
      ],
      costs: [
        'The conversation is the reward, so calls run long and the count runs short — 35 dials needs 35 endings.',
        'Rapport without an ask: you leave calls warm and unbooked.',
        stabCost,
      ],
      product: [
        { text: 'Every lead card ends in a structured outcome — callback, interested, not interested — so a warm call still gets closed to a next step before the next dial.', screen: 'dialing' },
        { text: 'The 35 ticks on the Overview light one per call, not per conversation. The bar rewards endings.', screen: 'home' },
        { text: 'The check-in\'s pattern card will show you the link between long-call days and dial counts — your own data, not a lecture.', screen: 'brain' },
      ],
    },
    S: {
      title: 'Anchor',
      what: `You're steady. You keep the routine, you keep your word, and you'd rather do the same good thing every day than chase the new thing. ${second} ${conLine}`,
      helps: [
        'The calling hour becomes a habit for you faster than for anyone — same time, same list, same script.',
        'Follow-ups actually happen. "Send me info" gets sent, and the callback gets called.',
        'Clients trust you quickly, because you don\'t oversell and you don\'t disappear.',
      ],
      costs: [
        'You avoid the hard call — the owner who was rude, the collection agency, the ask for the money.',
        'Change costs you: a new city, a new script, or a new offer takes a week to feel normal, and that week is quiet.',
        stabCost,
      ],
      product: [
        { text: 'Goals show days remaining in amber when the required pace goes up, so "later" has a visible cost before it becomes "never".', screen: 'goals' },
        { text: 'The Dialing queue sorts the next call to the top so the hard one can\'t be quietly skipped for ten easy ones.', screen: 'dialing' },
        { text: 'Exercises tagged to the threat-and-reaction region are the ones to run before a call you\'re avoiding.', screen: 'brain' },
      ],
    },
    C: {
      title: 'Analyst',
      what: `You want it right. You check the number, fix the script, and understand the system before you trust it. ${second} ${conLine}`,
      helps: [
        'Your lead list is clean — right city, right category, right owner name — and clean lists convert.',
        'You notice what the data says: which script line works, which hour dies, which category books.',
        'Clients get exact answers from you, which is rare and worth money.',
      ],
      costs: [
        'Ready is a moving target. The script gets one more revision and the hour starts at 4:20.',
        'A wrong number or a bad lead feels like a system failure, and you stop to fix the system mid-hour.',
        stabCost,
      ],
      product: [
        { text: 'The calling hour is a fixed block on the Daily Plan with a status strip counting down to it — the start time is not a decision you get to reopen at 3:55.', screen: 'daily-plan' },
        { text: 'The results panel on the cold-calling campaign reads dials, conversations and closes automatically, so the analysis you want happens after the hour, not during it.', screen: 'marketing' },
        { text: 'Exercises tagged to focus-and-planning are built to start before the plan is finished — practice for the thing that costs you.', screen: 'brain' },
      ],
    },
  };
  return B[primary];
}

// ── Regions ────────────────────────────────────────────────────────────
export type RegionId = 'prefrontal' | 'amygdala' | 'hippocampus' | 'basal' | 'reward';
export interface Region { id: RegionId; name: string; handles: string; plain: string; x: number; y: number }

export const REGIONS: Region[] = [
  { id: 'prefrontal', name: 'Prefrontal cortex', handles: 'Focus and planning', plain: 'Holding a plan in mind, choosing what to do next, and not doing the other thing. The part that says "4pm means 4pm".', x: 92, y: 118 },
  { id: 'amygdala', name: 'Amygdala', handles: 'Threat and reaction', plain: 'The fast alarm. It fires on a rude owner, a bad call, an unknown number — and decides whether the next dial happens at all.', x: 214, y: 176 },
  { id: 'hippocampus', name: 'Hippocampus', handles: 'Memory', plain: 'Filing what happened so it can be used later: which line worked, which owner said call back Thursday.', x: 258, y: 198 },
  { id: 'basal', name: 'Basal ganglia', handles: 'Habit and repetition', plain: 'Routines that run without deciding. The calling hour becomes automatic here, or never does.', x: 192, y: 128 },
  { id: 'reward', name: 'Reward pathway', handles: 'Motivation and reward', plain: 'What feels worth doing. Why a booked call feels good, and why a flat afternoon feels like nothing is.', x: 150, y: 168 },
];

export type TendencyLabel = 'Runs hot' | 'Runs steady' | 'Underused';
export interface RegionRead { level: number; label: TendencyLabel; relate: string }

function label(level: number): TendencyLabel { return level >= 4 ? 'Runs hot' : level >= 3 ? 'Runs steady' : 'Underused'; }
const clamp5 = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

/** Tendency per region, 1–5, from the assessment. A model of which
 *  patterns to expect — each read explains the link in one line. */
export function regionRead(id: RegionId, s: Scores, primary: Disc): RegionRead {
  const t = (tr: Trait) => tendency(tr, s);
  switch (id) {
    case 'prefrontal': {
      const level = clamp5((t('CON') + t('C') + t('S')) / 3);
      return { level, label: label(level), relate: level >= 4 ? 'You plan and follow through — the risk is over-planning, not under.' : level >= 3 ? 'Planning holds most days; it slips when the day gets loud.' : `As a ${TYPE_NAME[primary]}, you start before the plan is done. Structure has to come from outside — the Daily Plan, not willpower.` };
    }
    case 'amygdala': {
      const level = clamp5(6 - t('STAB') + (t('D') >= 4 || t('I') >= 4 ? 0.5 : 0));
      return { level, label: label(level), relate: level >= 4 ? 'A bad call lands hard and stays. Recovery between dials is the skill to train.' : level >= 3 ? 'Pressure registers but doesn\'t run the hour.' : 'Pressure barely registers. Good for dialing; watch for flat afternoons where nothing feels urgent.' };
    }
    case 'hippocampus': {
      const level = clamp5((t('C') + t('S') + t('CON')) / 3);
      return { level, label: label(level), relate: level >= 4 ? 'You keep track — what worked, who said what. Use it: review before the hour, not after.' : level >= 3 ? 'You remember the big things; the small follow-ups need writing down.' : 'Details slide. Log outcomes on every call, because tomorrow-you won\'t have them.' };
    }
    case 'basal': {
      const level = clamp5((t('S') + t('CON') + (5 - t('D')) / 2) / 2.5);
      return { level, label: label(level), relate: level >= 4 ? 'Routines stick for you. Protect the calling hour and it becomes automatic within weeks.' : level >= 3 ? 'Habits form with a fixed time and a fixed trigger — keep both fixed.' : 'Habits don\'t form on their own for you; the same hour, every weekday, on the calendar, is how they get built.' };
    }
    case 'reward': {
      const level = clamp5((t('I') + t('D')) / 2);
      return { level, label: label(level), relate: level >= 4 ? 'You chase the win. Make the dial count the win, not just the close, or the quiet days go dark.' : level >= 3 ? 'Wins motivate you without running you.' : 'Wins don\'t move you much on their own. Streaks and the tick bar are there to make progress visible when it doesn\'t feel like anything.' };
    }
  }
}

// ── Exercises ──────────────────────────────────────────────────────────
export interface Exercise { id: string; name: string; region: RegionId; trains: string; how: string; minutes: number; difficulty: 1 | 2 | 3 }

/** Concept level only: a topic or a kind of practice, never a specific
 *  episode or link. */
export const EXERCISES: Exercise[] = [
  { id: 'last-chapter', name: 'Read the last chapter first', region: 'hippocampus', trains: 'Reconstructing how something happened from where it ended.', how: 'Pick a book. Read the final chapter, then start from page one and notice how you keep working out what leads to that ending.', minutes: 20, difficulty: 1 },
  { id: 'film-ending', name: 'Watch the ending before the start', region: 'hippocampus', trains: 'Holding a known outcome while taking in the details that produced it.', how: 'Watch the last ten minutes of a film, then watch it from the beginning. Track which early moments you now catch.', minutes: 120, difficulty: 1 },
  { id: 'make-bed', name: 'Make the bed', region: 'basal', trains: 'One finished thing before the day starts deciding for you.', how: 'Every morning, before the phone. Same way each time. It takes ninety seconds and the day opens with something done.', minutes: 2, difficulty: 1 },
  { id: 'protected-hour', name: 'Protect the hour on the calendar', region: 'basal', trains: 'A habit needs a fixed time and a fixed trigger.', how: 'Put 4:00–5:00pm on the calendar every weekday as a real event, not a reminder. Decline anything that lands on it for two weeks.', minutes: 5, difficulty: 1 },
  { id: 'leads-by-330', name: 'Leads loaded by 3:30', region: 'prefrontal', trains: 'Separating setup from execution so the hour is only dialing.', how: 'At 3:30 open LeadFlow, pick the city, send 20 to Dialing. Then close it. The hour starts with a full queue and no hunting.', minutes: 10, difficulty: 1 },
  { id: 'first-dial-cold', name: 'First dial with no warm-up', region: 'amygdala', trains: 'Acting before the alarm has time to argue.', how: 'When the hour starts, dial the first number within sixty seconds. No reading the card twice, no coffee. The second call is easier because the first one happened.', minutes: 1, difficulty: 2 },
  { id: 'reset-breath', name: 'One breath between calls', region: 'amygdala', trains: 'Clearing a bad call before it becomes the next call.', how: 'After a hang-up or a rude one: one slow exhale, say the outcome out loud, log it, dial. Four seconds, every time.', minutes: 1, difficulty: 1 },
  { id: 'worst-call-first', name: 'Make the call you\'re avoiding first', region: 'amygdala', trains: 'Taking the avoided thing off the top of the pile.', how: 'Before the hour, name the one call you don\'t want to make — the callback, the collection agency, the ask. Make it first. Then the hour.', minutes: 5, difficulty: 3 },
  { id: 'outcome-every-call', name: 'Log an outcome on every call', region: 'hippocampus', trains: 'Turning what happened into something tomorrow can use.', how: 'No call ends without an outcome tapped and one line of note if anything was said. Not at the end of the hour — after each call.', minutes: 1, difficulty: 1 },
  { id: 'review-before-hour', name: 'Five-minute review before the hour', region: 'hippocampus', trains: 'Using yesterday instead of repeating it.', how: 'At 3:55, read yesterday\'s outcomes. Which line worked. Who said call back. Which category booked. Then dial.', minutes: 5, difficulty: 2 },
  { id: 'start-unfinished', name: 'Start before the plan is finished', region: 'prefrontal', trains: 'Acting on a plan that is 70% done instead of polishing it to 100%.', how: 'Set a ten-minute timer for planning. When it rings, start — whatever state the plan is in. Adjust as you go.', minutes: 10, difficulty: 2 },
  { id: 'one-thing', name: 'Write the one thing', region: 'prefrontal', trains: 'Picking the single outcome that makes today a win.', how: 'Each morning, one line: "Today is a win if ___." Put it where you\'ll see it at 3:30. That line decides what gets done.', minutes: 2, difficulty: 1 },
  { id: 'phone-away', name: 'Phone face down for the hour', region: 'prefrontal', trains: 'Holding one task against interruption.', how: 'During the calling hour the phone is used for dialing only. Notifications off. Everything else waits until 5:01.', minutes: 60, difficulty: 2 },
  { id: 'ask-plainly', name: 'Ask for the meeting in one sentence', region: 'reward', trains: 'Ending a conversation with an ask instead of a good feeling.', how: 'Every call that goes past a minute ends with one sentence: "Can I show you the three things for fifteen minutes Thursday?" Then stop talking.', minutes: 1, difficulty: 2 },
  { id: 'tick-count', name: 'Count dials, not deals, for two weeks', region: 'reward', trains: 'Rewarding the activity you control instead of the result you don\'t.', how: 'For fourteen days the only number that matters is dials. Watch the tick bar fill. Closes will come; this trains the habit that produces them.', minutes: 0, difficulty: 1 },
  { id: 'streak-visible', name: 'Keep the streak visible', region: 'reward', trains: 'Making progress feel like something on days it doesn\'t.', how: 'Look at the streak in the status strip before the hour. A running streak is worth protecting; a broken one restarts today, not Monday.', minutes: 1, difficulty: 1 },
  { id: 'same-time-workout', name: 'Train at the same time every day', region: 'basal', trains: 'Anchoring one routine so others can attach to it.', how: 'Same workout slot, every day it happens. Even ten minutes. The slot matters more than the workout.', minutes: 30, difficulty: 2 },
  { id: 'cold-shower', name: 'Cold finish to the shower', region: 'amygdala', trains: 'Choosing discomfort on purpose so it has less say later.', how: 'Last thirty seconds of the shower, cold. Breathe slow. It is practice for the first dial.', minutes: 1, difficulty: 2 },
  { id: 'script-freeze', name: 'Freeze the script for a week', region: 'prefrontal', trains: 'Running the same thing long enough to know whether it works.', how: 'No edits to the call script for five calling days. Log what happens. Edit on Friday with data, not feelings.', minutes: 0, difficulty: 2 },
  { id: 'say-no-once', name: 'Decline one thing a day', region: 'amygdala', trains: 'Saying no without the long explanation.', how: 'Once a day, decline something small in one sentence. No apology, no reasons. It gets easier, and the calling hour stays protected.', minutes: 1, difficulty: 2 },
  { id: 'recall-three', name: 'Recall three calls at 5:01', region: 'hippocampus', trains: 'Pulling the day back out of memory before it fades.', how: 'When the hour ends, without looking, name three calls: who, what they said, what happens next. Then check the log.', minutes: 3, difficulty: 2 },
  { id: 'reward-after', name: 'The reward comes after the hour', region: 'reward', trains: 'Putting the good thing on the far side of the work.', how: 'Pick the thing you\'d do at 4pm anyway — the show, the food, the scroll. It moves to 5:01. Not as punishment; as sequencing.', minutes: 0, difficulty: 2 },
  { id: 'listen-long-form', name: 'Listen to one long conversation a week', region: 'hippocampus', trains: 'Holding a long thread and noticing how experienced operators talk.', how: 'One long-form interview with an operator in your industry — a podcast or a talk, your pick. Write down one line you\'d steal for a call.', minutes: 60, difficulty: 1 },
  { id: 'walk-no-phone', name: 'Twenty-minute walk, no phone', region: 'prefrontal', trains: 'Letting the planning part run without input.', how: 'After the hour, walk twenty minutes with nothing in your ears. The next day\'s one thing usually shows up by the end.', minutes: 20, difficulty: 1 },
];

export function exercisesFor(region: RegionId): Exercise[] { return EXERCISES.filter((e) => e.region === region); }

/** This week's three: from the regions that read weakest, one each,
 *  easiest first. Deterministic for a given result. */
export function weeklyExercises(s: Scores, primary: Disc, weekSeed: number): Exercise[] {
  const ranked = REGIONS.map((r) => ({ r, read: regionRead(r.id, s, primary) }))
    .sort((a, b) => a.read.level - b.read.level || a.r.name.localeCompare(b.r.name));
  // The amygdala reads inverted — "runs hot" is the thing to train — so
  // it ranks by distance from steady in either direction.
  const pick: Exercise[] = [];
  const order = [...ranked].sort((a, b) => {
    const da = a.r.id === 'amygdala' ? Math.abs(a.read.level - 3) : 5 - a.read.level;
    const db = b.r.id === 'amygdala' ? Math.abs(b.read.level - 3) : 5 - b.read.level;
    return db - da;
  });
  for (const { r } of order) {
    const list = exercisesFor(r.id).sort((a, b) => a.difficulty - b.difficulty);
    if (list.length) pick.push(list[weekSeed % list.length]);
    if (pick.length === 3) break;
  }
  return pick;
}

// ── Check-ins and patterns ─────────────────────────────────────────────
export interface Checkin { date: string; score: number; note: string | null; hour_happened: boolean; dials: number }

export interface Patterns {
  count: number;
  bestDay: { day: string; avg: number } | null;
  worstDay: { day: string; avg: number } | null;
  /** Pearson r between score and dials over check-ins; null under 5 points. */
  correlation: number | null;
  correlationRead: string;
  checkinStreak: number;
  hourStreak: number;
  hourStreakBroken: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function weekday(date: string): number { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
export function shiftDate(date: string, n: number): string { const [y, m, d] = date.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 5) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function computePatterns(checkins: Checkin[], today: string): Patterns {
  const sorted = [...checkins].sort((a, b) => a.date.localeCompare(b.date));
  const byDay = new Map<number, number[]>();
  for (const c of sorted) byDay.set(weekday(c.date), [...(byDay.get(weekday(c.date)) ?? []), c.score]);
  const avgs = [...byDay.entries()].map(([d, arr]) => ({ day: DAYS[d], avg: arr.reduce((a, b) => a + b, 0) / arr.length })).sort((a, b) => b.avg - a.avg);
  const withHour = sorted.filter((c) => c.hour_happened);
  const r = pearson(withHour.map((c) => c.score), withHour.map((c) => c.dials));
  const correlationRead = r === null
    ? 'Not enough calling days yet to see whether the good-feeling hours are the high-dial hours.'
    : r > 0.4 ? 'The hours that felt good were the hours with more dials. Feeling follows doing, for you.'
    : r < -0.4 ? 'The hours that felt best had fewer dials — worth watching: comfortable might mean slow.'
    : 'How the hour felt and how many dials happened don\'t track each other much. Feelings aren\'t a good gauge of output for you; the tick bar is.';
  // Streaks: consecutive days checked in, ending today or yesterday.
  const dates = new Set(sorted.map((c) => c.date));
  let checkinStreak = 0;
  let cursor = dates.has(today) ? today : shiftDate(today, -1);
  while (dates.has(cursor)) { checkinStreak++; cursor = shiftDate(cursor, -1); }
  // Hour streak: consecutive weekdays where the hour happened, skipping weekends.
  const hourByDate = new Map(sorted.map((c) => [c.date, c.hour_happened]));
  let hourStreak = 0;
  cursor = hourByDate.has(today) ? today : shiftDate(today, -1);
  for (let guard = 0; guard < 200; guard++) {
    const wd = weekday(cursor);
    if (wd === 0 || wd === 6) { cursor = shiftDate(cursor, -1); continue; }
    if (!hourByDate.get(cursor)) break;
    hourStreak++;
    cursor = shiftDate(cursor, -1);
  }
  const lastWeekday = sorted.filter((c) => weekday(c.date) !== 0 && weekday(c.date) !== 6).slice(-1)[0];
  return {
    count: sorted.length,
    bestDay: avgs[0] ?? null,
    worstDay: avgs.length > 1 ? avgs[avgs.length - 1] : null,
    correlation: r,
    correlationRead,
    checkinStreak,
    hourStreak,
    hourStreakBroken: hourStreak === 0 && !!lastWeekday && !lastWeekday.hour_happened,
  };
}

/** Cross-module hook: how many weekdays in a row, ending with the most
 *  recent weekday whose hour is over, had no dials at all. Reads the
 *  same history Dialing keeps; nothing new is tracked. */
export function missedHourRun(history: { date: string; total: number }[], today: string, hourOver: boolean): number {
  const byDate = new Map(history.map((h) => [h.date, h.total]));
  let cursor = hourOver ? today : shiftDate(today, -1);
  let run = 0;
  for (let guard = 0; guard < 60; guard++) {
    const wd = weekday(cursor);
    if (wd === 0 || wd === 6) { cursor = shiftDate(cursor, -1); continue; }
    if ((byDate.get(cursor) ?? 0) > 0) break;
    run++;
    cursor = shiftDate(cursor, -1);
  }
  return run;
}

// ── Onboarding ─────────────────────────────────────────────────────────
export const ROLE_OPTIONS = ['Owner', 'Sales', 'Operator', 'Side hustle', 'Other'] as const;
export const INDUSTRY_SUGGESTIONS = ['Home services', 'Restaurant / food', 'Auto', 'Beauty / salon', 'Real estate', 'Fitness', 'Retail', 'Agency / marketing'];

/** Which modules to pre-tick in the picker for a role. Everything stays
 *  selectable; this only sets the starting point. */
export function modulesForRole(role: string | undefined): string[] | null {
  switch ((role ?? '').toLowerCase()) {
    case 'sales': return ['daily-plan', 'dialing', 'goals', 'brain', 'schedule', 'weekly-review', 'patterns', 'call-recordings'];
    case 'operator': return ['daily-plan', 'opening-closing', 'schedule', 'goals', 'brain', 'budgeting', 'weekly-review'];
    case 'side hustle': return ['daily-plan', 'goals', 'brain', 'budgeting', 'schedule', 'decisions', 'weekly-review', 'sticky-spot'];
    default: return null;
  }
}
