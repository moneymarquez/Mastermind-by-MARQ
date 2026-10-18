import { IMPORT_TEMPLATE } from './importFormat';

// "Set up Masterminds by talking" (brief §4.5). Editable: change the
// interview here; the import template is embedded from importFormat.ts so
// the two can never drift apart.

export const ONBOARDING_INTRO = 'Copy this prompt → paste it into ChatGPT, Claude, or any AI → turn on voice mode → just answer.';

export const VOICE_HOWTO: { app: string; steps: string }[] = [
  { app: 'ChatGPT', steps: 'Open the ChatGPT app, paste the prompt and send it, then tap the voice icon (the sound-wave button next to the message box) and talk.' },
  { app: 'Claude', steps: 'Open the Claude app, paste the prompt and send it, then tap the voice-mode button next to the message box and talk.' },
  { app: 'Anything else', steps: 'Paste the prompt and type your answers. Voice is faster, but typing works the same.' },
];

export const ONBOARDING_PROMPT = `You're helping me set up Masterminds by MARQ, my personal operating system app. Interview me out loud, one short question at a time, like a friendly coach, not a form.

Before asking anything, use everything you already know about me from our past conversations and your memory: my goals, routines, job, eating, training, money, the people in my life and work. Tell me in 3–4 sentences what you already know, ask me to correct anything wrong, and only ask about what's missing.

Cover: (1) my top 1–3 goals with real numbers and deadlines, and why they matter; (2) my weekly schedule: work hours, sleep, gym/runs; (3) how I eat and what my calorie/protein targets should be; (4) training; (5) my open to-dos, grouped by project; (6) people I need to follow up with and why; (7) my skills, free hours per week, starting budget, and city (for weekly money ideas); (8) anything I track like supplements or peptides (just record what I tell you, no dosing advice); (9) reminders I want.

Keep it moving: if I ramble, summarize and confirm. When we're done, say "Here's your Masterminds setup" and output ONLY the block below, filled in with what you learned, valid JSON, nothing invented:

${IMPORT_TEMPLATE}`;
