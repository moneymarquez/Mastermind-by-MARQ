// A small rule-based stand-in for /api/dispatch/extract, used only by Demo
// Mode (no paid calls there). It handles the way people actually talk on a
// job site well enough to demo: "Mikhail, get X out by Thursday, that's the
// big one. Probably Mikhail too. I'll do Y Friday." The real extraction is
// Claude on the Worker (worker/handlers/dispatch.ts).
import type { Extraction } from './model';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function resolveDate(phrase: string, today = new Date()): string | null {
  const p = phrase.toLowerCase();
  const d = new Date(today); d.setHours(12, 0, 0, 0);
  if (/\b(today|tonight|eod|end of (the )?day)\b/.test(p)) return iso(d);
  if (/\btomorrow\b/.test(p)) { d.setDate(d.getDate() + 1); return iso(d); }
  if (/\b(this week|end of (the )?week)\b/.test(p)) { d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return iso(d); }
  if (/\bnext week\b/.test(p)) { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return iso(d); }
  const m = p.match(/\b(next )?(sun|mon|tues|wednes|thurs|fri|satur)day\b/);
  if (m) {
    const want = DAYS.findIndex((x) => x.startsWith(m[2]));
    let add = (want - d.getDay() + 7) % 7; if (add === 0) add = 7; if (m[1]) add += add < 7 ? 7 : 0;
    d.setDate(d.getDate() + add); return iso(d);
  }
  return null;
}

const DATE_PHRASE = /\b(?:by |before |on |for |until )?(?:today|tonight|tomorrow|eod|end of (?:the )?(?:day|week)|this week|next week|(?:next )?(?:sun|mon|tues|wednes|thurs|fri|satur)day)\b/i;
const HEDGE = /\b(probably|maybe|might|or someone|not sure|i guess)\b/i;
const URGENT = /\b(big one|urgent|asap|right away|top priority|most important|critical)\b/i;
const NOTE = /\b(code is|is at|password|number is|remember that|fyi|note that)\b/i;
const FILLER = /^(?:okay|ok|so|and|also|then|um|uh|alright|right)[,\s]+/i;

export function localExtract(transcript: string, people: { id: string; name: string }[], today = new Date()): Extraction {
  const first = (n: string) => n.split(/\s+/)[0];
  const sentences = transcript.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\s+—\s+/).map((s) => s.trim()).filter(Boolean);
  const tasks: Extraction['tasks'] = [];
  const questions: Extraction['questions'] = [];
  const notes: string[] = [];
  let lastPerson: { id: string; name: string } | null = null;
  for (const raw of sentences) {
    let s = raw.replace(FILLER, '').replace(/[.!?]+$/, '').trim();
    if (!s || /^(okay|ok|so|um|alright)$/i.test(s)) continue;
    if (NOTE.test(s) && !/\b(call|send|get|book|check|sign|order|pick|fix|finish|email|text)\b/i.test(s)) { notes.push(s); continue; }
    const quote = s.slice(0, 120);
    const mentioned = people.find((p) => new RegExp(`\\b${first(p.name)}\\b`, 'i').test(s));
    const me = /^(i'll|i will|i need to|i've got to|i have to|let me|me:)\b/i.test(s) || /\b(i'll|i will)\b/i.test(s);
    const hedge = HEDGE.test(s);
    let person = mentioned ?? null;
    if (!person && /\b(too|also|as well)\b/i.test(s) && lastPerson) person = lastPerson;
    const dateM = s.match(DATE_PHRASE);
    const due = dateM ? resolveDate(dateM[0], today) : null;
    const urgent = URGENT.test(s);
    // Title: drop the name, the date, the hedges and the commentary.
    let title = s
      .replace(new RegExp(`^${person ? first(person.name) : '\\u0000'}[,:]?\\s*`, 'i'), '')
      .replace(/,?\s*(that's|that is|it's)\s+the big one/i, '')
      .replace(/,?\s*(probably|maybe)\s+\w+(\s+too)?$/i, '')
      .replace(/\b(i'll|i will|i need to|i have to|let me)\s+/i, '')
      .replace(DATE_PHRASE, '')
      .replace(/\b(please|can you|could you|make sure (to|you)|go ahead and)\s+/gi, '')
      .replace(/\s+,/g, ',').replace(/[,\s]+$/, '').trim();
    title = title.replace(/\babout the\b/i, 're:').replace(/\s{2,}/g, ' ');
    if (title.length < 3) continue;
    title = title.charAt(0).toUpperCase() + title.slice(1);
    const priority = urgent ? 1 : due && due <= resolveDate('friday', today)! ? 2 : 3;
    const who: { id: string; name: string } | null = me && !mentioned ? null : person;
    const low = hedge || (!who && !me);
    tasks.push({
      title: title.slice(0, 60), assignee_member_id: who?.id ?? null, assignee_name: who?.name ?? 'You', confidence: low ? 'low' : 'high',
      priority, priority_reason: urgent ? 'Called out as the big one' : due ? 'Has a date this week' : 'No date given', due_date: due, source_quote: quote,
    });
    if (low) questions.push({ task_index: tasks.length - 1, text: `Who should ${title.charAt(0).toLowerCase()}${title.slice(1)}?`, options: [...(who ? [first(who.name)] : people.slice(0, 2).map((p) => first(p.name))), 'me'] });
    if (who) lastPerson = who;
  }
  return { tasks, questions, notes };
}
