// ~50-question deep profile, grouped into categories, filled in over one or
// more sessions (see useMentalHealthProfile). Not a mood check-in — this is
// meant to give Nova enough real context (personality, stress patterns,
// what drains/recharges, communication style, history, triggers, coping
// mechanisms, goals, relationships, work stress) that day-to-day check-in
// conversations land accurately instead of generically.
export interface ProfileQuestion {
  key: string;
  prompt: string;
}

export interface ProfileCategory {
  id: string;
  label: string;
  questions: ProfileQuestion[];
}

export const MENTAL_HEALTH_PROFILE: ProfileCategory[] = [
  {
    id: 'personality', label: 'Personality & self-understanding',
    questions: [
      { key: 'self_intro', prompt: "How would you describe yourself in a few sentences, like you're introducing yourself to someone who'll actually get it?" },
      { key: 'introvert_extrovert', prompt: 'Are you more introverted or extroverted, or does it depend on the day?' },
      { key: 'misunderstood', prompt: "What's something people misunderstand about you?" },
      { key: 'proud_of', prompt: 'What are you genuinely proud of?' },
      { key: 'working_on', prompt: "What's a flaw or pattern in yourself you're aware of but still working on?" },
      { key: 'outlook', prompt: 'Do you consider yourself an optimist, realist, or pessimist — and why?' },
    ],
  },
  {
    id: 'stress', label: 'Stress patterns',
    questions: [
      { key: 'stress_physical', prompt: 'What does stress actually feel like for you physically (tight chest, can\'t sleep, short temper, etc.)?' },
      { key: 'stress_first_signs', prompt: "What are the first signs you notice when you're starting to get overwhelmed?" },
      { key: 'stress_triggers', prompt: 'What situations reliably stress you out?' },
      { key: 'stress_reaction', prompt: 'How do you usually react under pressure — shut down, get sharp/short, push through, or something else?' },
      { key: 'stress_daily_vs_big', prompt: "What's your stress like day-to-day vs. when something big happens?" },
      { key: 'stress_timing', prompt: 'Is there a time of day/week when stress tends to hit hardest?' },
    ],
  },
  {
    id: 'drains', label: 'What drains you',
    questions: [
      { key: 'drains_situations', prompt: 'What kind of situations or people leave you feeling drained?' },
      { key: 'social_drain_or_energize', prompt: 'Does social interaction generally energize or drain you?' },
      { key: 'heaviest_tasks', prompt: 'What tasks or responsibilities feel heaviest to you right now?' },
      { key: 'known_bad_habit', prompt: "What's something you keep doing that you know isn't good for you?" },
      { key: 'at_your_lowest', prompt: "When you're at your lowest, what does that usually look like?" },
    ],
  },
  {
    id: 'recharge', label: 'What recharges you',
    questions: [
      { key: 'what_helps', prompt: 'What actually makes you feel better when you\'re having a rough day?' },
      { key: 'just_for_you', prompt: "What's something you do purely for yourself, no other reason?" },
      { key: 'who_calms_you', prompt: 'Who or what genuinely makes you feel calmer/lighter?' },
      { key: 'good_day', prompt: 'What does a genuinely good day look like for you?' },
      { key: 'alone_vs_people', prompt: 'How much do you need to be alone to recharge, versus around people?' },
    ],
  },
  {
    id: 'communication', label: 'Communication style',
    questions: [
      { key: 'talk_or_keep_in', prompt: "When something's bothering you, do you talk about it or keep it to yourself?" },
      { key: 'check_in_style', prompt: 'How do you like to be checked in on — direct questions, casual mention, just presence?' },
      { key: 'feedback_style', prompt: 'Do you prefer straight talk or a softer approach when someone\'s giving you feedback?' },
      { key: 'conflict_style', prompt: 'How do you usually handle conflict — avoid it, address it head-on, something else?' },
      { key: 'shuts_you_down', prompt: "What's the fastest way to shut you down in a conversation?" },
    ],
  },
  {
    id: 'history', label: 'History & background',
    questions: [
      { key: 'past_shapes_you', prompt: "What's something from your past that still shapes how you operate today?" },
      { key: 'hard_period', prompt: "What's a period of your life that was genuinely hard, and what got you through it?" },
      { key: 'overcome', prompt: "What's something you've overcome that you're proud of?" },
      { key: 'family_growing_up', prompt: 'How would you describe your relationship with your family growing up?' },
      { key: 'unfinished_business', prompt: "Is there unfinished business — something from your past you're still working through?" },
      { key: 'decision_changed_everything', prompt: "What's a decision you made that changed everything?" },
    ],
  },
  {
    id: 'triggers', label: 'Triggers',
    questions: [
      { key: 'gets_under_skin', prompt: 'What kinds of comments or situations genuinely get under your skin?' },
      { key: 'criticism_hits_harder', prompt: 'Is there a specific type of criticism that hits harder than others?' },
      { key: 'feels_disrespected', prompt: 'What makes you feel disrespected?' },
      { key: 'topics_to_avoid', prompt: "Are there topics you'd rather Nova not bring up casually?" },
      { key: 'needs_space_after', prompt: "What's something that, if it happens, you need space afterward rather than to talk about it right away?" },
    ],
  },
  {
    id: 'coping', label: 'Coping mechanisms',
    questions: [
      { key: 'go_to_coping', prompt: "When things get hard, what's your go-to (healthy or not) way of coping?" },
      { key: 'coping_moving_away_from', prompt: "What's a coping mechanism you're trying to move away from?" },
      { key: 'coping_that_works', prompt: "What's a coping mechanism that's actually worked for you?" },
      { key: 'process_in_moment_or_later', prompt: 'Do you deal with stuff in the moment, or process it later on your own?' },
      { key: 'calms_you_fastest', prompt: "What helps you calm down fastest when you're wound up?" },
    ],
  },
  {
    id: 'goals', label: 'Goals & motivation',
    questions: [
      { key: 'real_why', prompt: "What's actually driving you right now — what's the real \"why\" behind what you're building?" },
      { key: 'success_beyond_money', prompt: 'What does success look like to you, beyond the money?' },
      { key: 'biggest_fear', prompt: "What are you most afraid of if things don't work out?" },
      { key: 'motivated_on_hard_days', prompt: "What keeps you motivated on days you don't feel like it?" },
      { key: 'year_from_now', prompt: 'Where do you want to be a year from now, realistically?' },
    ],
  },
  {
    id: 'relationships', label: 'Relationships & work stress',
    questions: [
      { key: 'closest_relationships', prompt: 'How would you describe your closest relationships right now — solid, strained, complicated?' },
      { key: 'biggest_work_stress', prompt: "What's the biggest source of stress at work/business right now?" },
    ],
  },
];

export const TOTAL_PROFILE_QUESTIONS = MENTAL_HEALTH_PROFILE.reduce((sum, c) => sum + c.questions.length, 0);
