// The canonical public audit question set, exactly as specified in the
// Made by Marq design.
//
// This lives in the Worker, not in the marketing site's bundle, for two
// reasons. First, the analysis engine builds its prompt from these
// questions — if the site sent them alongside the answers, a caller could
// rewrite the prompt by rewriting the questions, which is a prompt
// injection hole on an endpoint anyone on the internet can hit. Second, it
// means question copy can be edited and deployed without touching or
// redeploying the public site at all.
//
// The site fetches these from GET /api/audit/questions and renders one per
// screen. `category` doubles as the section label shown above the prompt
// AND as the grouping heading the analysis engine sees — one field, both
// jobs, so the two can never drift apart.
//
// Distinct from the internal `audit_questions` table (schema_039), which
// drives Cristopher's own discovery form. Those are seven open probes for a
// live conversation he's steering; these are twenty-three plain-English
// questions a stranger answers alone on a phone. Same engine downstream,
// deliberately different instruments.

export type PublicQuestionType = 'text' | 'long' | 'number' | 'choice' | 'contact';

export interface PublicAuditQuestion {
  key: string;
  category: string;
  prompt: string;
  type: PublicQuestionType;
  placeholder?: string;
  /** Rendered as a prefix inside the numeric field ($ or #). */
  prefix?: string;
  options?: string[];
  /** Shown once, when the section changes — used to set expectations
   *  before the run of money questions. */
  note?: string;
}

export const PUBLIC_AUDIT_QUESTIONS: PublicAuditQuestion[] = [
  { key: 'bizName', category: 'About the business', prompt: "What's the name of your business?", type: 'text', placeholder: 'Taqueria La Marq' },
  { key: 'bizType', category: 'About the business', prompt: 'What kind of business is it?', type: 'text', placeholder: 'Food truck, barbershop, auto shop…' },
  { key: 'howLong', category: 'About the business', prompt: 'How long have you been open?', type: 'text', placeholder: 'Two years this spring' },
  { key: 'location', category: 'About the business', prompt: 'Where are you located?', type: 'text', placeholder: 'City, or where you park' },
  { key: 'hours', category: 'About the business', prompt: 'What are your hours right now?', type: 'long', placeholder: 'Tue–Sat, 11am to 8pm…' },

  { key: 'vision', category: 'The vision', prompt: 'If this went amazingly over the next year, what would that look like for you?', type: 'long', placeholder: 'A hundred new customers, a thousand regulars, a second location — whatever it is.' },

  { key: 'different', category: 'What makes you different', prompt: 'What do you think makes you different from others around here?', type: 'long', placeholder: 'In your own words.' },
  { key: 'whyPick', category: 'What makes you different', prompt: "If someone's choosing between you and the place down the street, why do they pick you?", type: 'long' },

  { key: 'typicalCustomer', category: 'Customers', prompt: 'Who would you say is your typical customer?', type: 'long' },
  { key: 'busiest', category: 'Customers', prompt: 'What time of day is actually busiest for you?', type: 'text', placeholder: 'Lunch rush, after 6pm…' },
  { key: 'dailyCustomers', category: 'Customers', prompt: 'On a normal day, roughly how many customers do you get?', type: 'number', placeholder: '60', prefix: '#' },
  { key: 'driveDistance', category: 'Customers', prompt: 'How far do people seem willing to drive to get to you?', type: 'text', placeholder: 'Ten minutes, across the valley…' },

  { key: 'avgTicket', category: 'The numbers', prompt: "What's your average ticket — what does one customer usually spend?", type: 'number', placeholder: '14', prefix: '$', note: "Skip anything you're not sure about — rough is fine." },
  { key: 'cogs', category: 'The numbers', prompt: 'Roughly what does it cost you to make what you sell?', type: 'number', placeholder: '5', prefix: '$' },
  { key: 'fixedCosts', category: 'The numbers', prompt: 'What are your monthly costs outside of ingredients — rent, permits, utilities, payments?', type: 'number', placeholder: '2200', prefix: '$' },
  { key: 'staffing', category: 'The numbers', prompt: 'Is it just you running this, or do you have paid help?', type: 'choice', options: ['Just me', 'Me and family helping out', 'I have paid employees'] },

  { key: 'social', category: 'Marketing today', prompt: 'Do you have social media for the business right now?', type: 'choice', options: ['Yes, and it’s active', 'Yes, but it’s been quiet', 'No, nothing yet'] },
  { key: 'whoPosts', category: 'Marketing today', prompt: "Who's posting — you personally, someone else, or is nobody really keeping up with it?", type: 'choice', options: ['Me, personally', 'Someone else helps', 'Nobody’s really keeping up'] },
  { key: 'spentMoney', category: 'Marketing today', prompt: 'Have you spent any actual money on marketing — flyers, ads, boosted posts, anything?', type: 'choice', options: ['Yes', 'No', 'A little, a while ago'] },
  { key: 'spentDetail', category: 'Marketing today', prompt: 'If yes, roughly how much, and what happened when you did?', type: 'long', placeholder: 'Rough numbers are fine.' },

  { key: 'retention', category: 'Repeat business', prompt: 'Would you say most of your customers are coming back regularly, or mostly new faces?', type: 'choice', options: ['Mostly regulars coming back', 'A pretty even mix', 'Mostly new faces', 'Honestly, I’m not sure'] },

  { key: 'bottleneck', category: 'The bottleneck', prompt: 'What feels like the hardest part right now — getting people to know you exist, getting them to come back, or something else entirely?', type: 'choice', options: ['Getting people to know we exist', 'Getting people to come back', 'Standing out from the competition', 'Something else'] },

  { key: 'contact', category: 'Contact', prompt: 'Last one — how do I reach you?', type: 'contact' },
];

/** The question whose answer names the business. Used to title the CRM
 *  record and to address the diagnosis, so it's referenced by key rather
 *  than by position — reordering the set above must not silently change
 *  which answer becomes the business name. */
export const BUSINESS_NAME_KEY = 'bizName';

/** Only these accept a Tracked/Rough-guess tag in the UI. The engine
 *  treats an untagged answer as estimated regardless, so this is about
 *  which questions bother asking. */
export const CONFIDENCE_KEYS = PUBLIC_AUDIT_QUESTIONS.filter((q) => q.type === 'number').map((q) => q.key);
