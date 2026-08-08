import { askClaude, extractJson } from './ai';

export interface ParsedShift {
  person_name: string;
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM 24h
  end_time: string; // HH:MM 24h
}

interface ParsedSchedule {
  shifts: ParsedShift[];
}

// Same Claude vision path Macros uses for photo meal logging (image passed
// through the Netlify AI proxy) — here reading a posted work-schedule photo
// covering everyone's shifts, not just Cristopher's own. year is passed in
// since handwritten/printed schedules usually only show month + day.
export async function parseSchedulePhoto(image: { mediaType: string; data: string }, referenceYear: number): Promise<ParsedShift[]> {
  const text = await askClaude({
    system:
      'You are reading a photo of a posted work schedule (a gas station shift schedule) that covers a whole team, ' +
      'not just one person. Extract every shift you can read: who it belongs to (as written on the schedule), what ' +
      'date, and start/end time. Normalize times to 24-hour HH:MM. If a year is not shown, assume ' +
      `${referenceYear}. If you can't read something confidently, skip that entry rather than guessing wildly. ` +
      'Respond with ONLY JSON: {"shifts": [{"person_name": string, "shift_date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM"}]}',
    messages: [{ role: 'user', content: "Extract every shift from this schedule photo." }],
    image,
    maxTokens: 2000,
  });
  const parsed = extractJson<ParsedSchedule>(text);
  return parsed.shifts ?? [];
}
