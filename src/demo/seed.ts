// Demo Mode seed (13-demo-mode-spec §3). Realistic, internally consistent,
// clearly fictional: no real client, lead or business names. Dates are
// relative to "now" so the demo always looks like today.
//
// Identity: "Marq" running Made by Marq (agency), a store called Northline
// Goods, and a side hustle. The demo user id is the owner's id so every
// module renders — which is only safe because in demo mode the Supabase
// client is the in-memory copy in ./client.ts, never the real database.
type Row = Record<string, unknown>;

export const DEMO_USER = { id: 'a4b89df9-7122-424a-afb5-fc4871e0963b', email: 'marq@madebymarq.demo', name: 'Marq' };
const U = DEMO_USER.id;
/** A second workspace where the demo identity is a member (explore mode). */
export const JAMES_TEAM = { ownerId: 'downer00-0000-4000-8000-000000000001', memberId: 'dmemjame-0000-4000-8000-000000000001' };

const pad = (n: number) => String(n).padStart(2, '0');
const dayStr = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const iso = (offsetDays = 0, hour = 12, min = 0) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); d.setHours(hour, min, 0, 0); return d.toISOString(); };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
let seq = 0;
const uid = (p: string) => `${p.padEnd(8, '0').slice(0, 8)}-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const isWeekend = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.getDay() === 0 || d.getDay() === 6; };

export const DEMO_DIGEST_TEXT = [
  'Sat 5:30a · Marq',
  'Today: 8a build block · 12p content · 4p dial hour (35)',
  'Yday: 36/35 dials · 4 convos · 1 meeting ✓',
  '#1: Approve Northline hero video → store goes live',
  'MbM: 2 proposals out, $3.8k pipeline',
  'Northline: 11 orders, $412 · margin 58%',
  'Content: reel 4/4 — hook held 71%',
  'Reply "36" to log dials.',
].join('\n');

export function buildSeed(): Record<string, Row[]> {
  seq = 0;
  const db: Record<string, Row[]> = {};
  const T = (table: string, rows: Row[]) => { db[table] = rows.map((r) => ({ user_id: U, created_at: iso(-3), updated_at: iso(-1), ...r })); };

  // ── Account ────────────────────────────────────────────────────────
  T('profiles', [{ id: U, role: 'owner', client_id: null }]);
  T('nova_preferences', [{ id: uid('pref'), tone: 'direct', assistant_name: 'Nova', theme: 'dark', skin: 'cyberpunk', sound_fx: false }]);
  T('business_profile', [{ id: uid('bizp'), business_name: 'Made by Marq', business_email: 'hello@madebymarq.demo', business_phone: '(555) 010-2030', business_address: '120 Main St, Salt Lake City, UT', website: 'madebymarq.demo' }]);
  T('subscriptions', [{ id: uid('subs'), status: 'active', current_period_end: iso(20) }]);

  // ── Home: dials (12 today, 23-day streak), sobriety 23d, a workout ──
  const dialContacts = Array.from({ length: 40 }, (_, i) => ({ id: uid('cont'), name: ['Rosa Diaz', 'Ben Ortiz', 'Kim Tran', 'Leo Park', 'Ava Cole'][i % 5] + ` ${i + 1}`, phone: `(555) 01${pad(i)}-40${pad(i)}`, email: null, business_name: ['Juniper Tacos', 'Blue Door Bakery', 'Summit Auto Spa', 'Pine & Pour', 'Red Rock Barbers'][i % 5], source: 'dialing', status: 'active', notes: null, details: {} }));
  T('contacts', dialContacts);
  const outcomes: Row[] = [];
  let back = 0, days = 0;
  while (days < 24) { back -= 1; if (isWeekend(back)) continue; days++; for (let k = 0; k < 36; k++) outcomes.push({ id: uid('outc'), contact_id: dialContacts[k % 40].id, outcome: k % 9 === 0 ? 'appointment_set' : k % 3 === 0 ? 'voicemail' : 'no_answer', call_date: dayStr(back), callback_date: null, logged_at: iso(back, 16, k) }); }
  for (let k = 0; k < 12; k++) outcomes.push({ id: uid('outc'), contact_id: dialContacts[k].id, outcome: k === 4 ? 'appointment_set' : k % 3 === 0 ? 'voicemail' : 'no_answer', call_date: dayStr(0), callback_date: null, logged_at: hoursAgo(1 - k / 20) });
  T('call_outcomes', outcomes);
  T('goals', [
    { id: uid('goal'), title: 'Make 35 dials a day', category: 'business', target_metric: 'daily_calls', target_metric_value: 35, target_unit: 'calls', priority_score: 9, deadline: dayStr(60), progress_pct: 62, why: 'Pipeline for Made by Marq', check_in_cadence: 'daily' },
    { id: uid('goal'), title: 'Northline Goods to $5k/mo', category: 'business', target_metric: 'revenue', target_metric_value: 5000, target_unit: 'usd', priority_score: 8, deadline: dayStr(90), progress_pct: 34, why: 'First store to profit' },
  ]);
  T('sobriety_checkins', Array.from({ length: 23 }, (_, i) => ({ id: uid('sobr'), checkin_date: dayStr(-i), drank: false, weed: false, nicotine: false, heavy: false, note: null, ai_insight: null })));
  T('fitness_workouts', [{ id: uid('work'), workout_date: dayStr(0), workout_type: 'Strength — push', duration_min: 48, distance_mi: null, notes: 'Bench 185×5' }, { id: uid('work'), workout_date: dayStr(-1), workout_type: 'Run', duration_min: 32, distance_mi: 3.1, notes: null }, { id: uid('work'), workout_date: dayStr(-3), workout_type: 'Strength — pull', duration_min: 45, distance_mi: null, notes: null }]);
  T('nutrition_targets', [{ id: uid('nutr'), active: true, daily_calories: 2400, daily_protein_g: 190, daily_carbs_g: 240, daily_fat_g: 75, start_date: dayStr(-30), rationale: 'Lean bulk while training 4×/week.' }]);
  T('meals', [
    { id: uid('meal'), meal_date: dayStr(0), meal_type: 'breakfast', source: 'home', calories: 540, protein_g: 42, carbs_g: 55, fat_g: 16, note: 'Eggs, oats, berries', log_method: 'photo' },
    { id: uid('meal'), meal_date: dayStr(0), meal_type: 'lunch', source: 'restaurant', restaurant_name: 'Cafe Juniper', calories: 720, protein_g: 58, carbs_g: 70, fat_g: 22, note: 'Chicken bowl', log_method: 'photo' },
    { id: uid('meal'), meal_date: dayStr(0), meal_type: 'snack', source: 'home', calories: 420, protein_g: 33, carbs_g: 44, fat_g: 12, note: 'Protein shake + banana', log_method: 'barcode' },
  ]);
  T('water_logs', [{ id: uid('watr'), log_date: dayStr(0), amount_oz: 64 }]);
  T('reminders', [
    { id: uid('remi'), title: 'Send Blue Door proposal', due_date: dayStr(0), due_time: '10:00', done: false },
    { id: uid('remi'), title: 'Film Northline unboxing', due_date: dayStr(0), due_time: '12:30', done: false },
    { id: uid('remi'), title: 'Approve hero video', due_date: dayStr(0), due_time: '15:00', done: true },
  ]);
  const blocks = [
    { time: '08:00', duration: 90, title: 'Build block — Northline store', detail: 'Approve the preview, swap hero video', type: 'goal', module: 'client-work', source: null },
    { time: '12:00', duration: 45, title: 'Film 3 clips', detail: 'Hooks from Idea & Script', type: 'ai_suggested', module: 'manual', source: null },
    { time: '16:00', duration: 60, title: 'Dial hour — 35 calls', detail: 'Friendly opener · single-location list', type: 'goal', module: 'goal', source: null },
    { time: '18:00', duration: 50, title: 'Gym — push day', detail: 'Plan week 3', type: 'fitness', module: 'fitness', source: null },
  ];
  T('daily_plans', [{ id: uid('plan'), plan_date: dayStr(0), status: 'confirmed', blocks, generated_at: iso(0, 5, 0), notified_at: iso(0, 5, 30), nudged_at: null, confirmed_at: iso(0, 6, 10) }]);

  // ── Morning Digest ─────────────────────────────────────────────────
  T('digest_settings', [{ id: uid('dige'), enabled: true, send_time: '05:30:00', timezone: 'America/Denver', channel: 'sms', desks: { ecom: true, mbm: true, mm: true, content: true, marketing: true }, separate_texts: false, last_sent_date: dayStr(0) }]);
  T('schedule_blocks', [1, 2, 3, 4, 5].flatMap((d) => [
    { id: uid('schb'), day_of_week: d, start_time: '08:00', end_time: '09:30', label: 'Build block', kind: 'build', active: true },
    { id: uid('schb'), day_of_week: d, start_time: '16:00', end_time: '17:00', label: 'Dial hour', kind: 'dials', active: true },
  ]));
  T('plan_targets', [{ id: uid('plnt'), key: 'dials', label: 'Dials', period: 'day', target: 35, unit: 'calls' }, { id: uid('plnt'), key: 'posts', label: 'Posts', period: 'day', target: 2, unit: 'posts' }]);
  T('daily_log', [{ id: uid('dlog'), date: dayStr(-1), dials: 36, conversations: 4, meetings: 1, inbound_leads: 2, posts: 2, cash_in: 412, top_done: true }]);
  T('digest_log', [{ id: uid('dgl'), date: dayStr(0), kind: 'master', desk: null, channel: 'sms', body: DEMO_DIGEST_TEXT, status: 'sent', error: null, created_at: iso(0, 5, 30) }]);

  // ── The Brain: 5 playbooks, versions v3 v2 v4 v1 v2 ────────────────
  const pb = (name: string, domain: string, version: number, body: string) => ({ id: uid('play'), name, domain, version, body, change_reason: version > 1 ? 'Corrected via orchestrator' : 'first version', updated_at: iso(-version) });
  const playbooks = [
    pb('Psychology', 'all', 3, '- Anchor every price against a crossed-out higher one.\n- Social proof beats features for impulse buys.\n- Loss aversion: say what they lose by waiting, never fake scarcity.\n- Cite the principle behind every recommendation.'),
    pb('E-commerce', 'ecom', 2, '- Price ≥ 3× landed cost or it doesn\'t get tested.\n- Skip anything fragile, seasonal, or under $15.\n- Ships in 12 days or less.\n- Kill a product after 14 days under 1% cart rate.'),
    pb('Content', 'content', 4, '- Hook in the first 1.5 seconds; show the product in the first 3.\n- 9:16, captions always, no stock music over voice.\n- Post 2×/day for 14 days before judging a product.'),
    pb('Marketing', 'marketing', 1, '- Quote the package, never a custom number.\n- Call single-location owners 4–6pm; operators before 10am.\n- One ask per script.'),
    pb('Website design', 'ecom', 2, '- One hero, one promise, one button above the fold.\n- Real product photos only; no AI people.\n- Lighthouse ≥ 90 before a preview goes out.'),
  ];
  T('ai_playbooks', playbooks);
  T('ai_playbook_versions', playbooks.flatMap((p) => Array.from({ length: Number(p.version) }, (_, i) => ({ id: uid('pbv'), playbook_id: p.id, version: i + 1, body: p.body, change_reason: i === 0 ? 'first version' : i === Number(p.version) - 1 && p.name === 'Psychology' ? 'Corrected via orchestrator — "never use countdown timers" (from Raise with orchestrator)' : 'Added from a send-back note', thread_id: null, created_at: iso(-(Number(p.version) - i) * 3) }))));

  // ── The Office (e-comm): orchestrator + 6 workers, mixed states ─────
  const W = (key: string, name: string, role: string, model: string, status: string, current_task: string | null, domain = 'ecom') => ({ id: uid('wrkr'), domain, key, name, role, model, autonomy_level: 0, status, current_task, enabled: true, playbook_name: null });
  const workers = [
    W('orchestrator', 'Orchestrator', 'Assign work, read outputs, score, route your notes, write the daily summary.', 'claude-fable-5-1', 'running', 'Delegating tonight\'s plan', 'all'),
    W('scout', 'Product Scout', 'Fill Product Sheets per channel; take snapshots.', 'claude-haiku-4-5', 'running', 'Scouting TikTok Shop (top 10)'),
    W('analyst', 'Audience Analyst', 'Who buys, why, the angle, the margin math.', 'claude-sonnet-5', 'running', 'Analysing Cloud Neck Pillow'),
    W('teardown', 'Competitor Teardown', 'Dossiers on the top sellers; 3 unclaimed angles.', 'claude-sonnet-5', 'idle', null),
    W('supplier', 'Supplier Finder', 'Suppliers, sample order draft, inspection sheet.', 'claude-haiku-4-5', 'idle', null),
    W('brandlab', 'Brand Lab', 'Three brand options from the buyer profile.', 'claude-sonnet-5', 'idle', null),
    W('builder', 'Store Builder', 'Site code to a GitHub branch; quality gate.', 'claude-sonnet-5', 'idle', null),
    W('content', 'Content Producer', 'Hooks, scripts, captions, visuals.', 'claude-sonnet-5', 'running', 'Scripting 3 hooks for Northline', 'content'),
    W('script_copy', 'Script & Copy', 'Openers, voicemails, emails — 3 tones × 2 audiences.', 'claude-sonnet-5', 'idle', null, 'marketing'),
    W('campaign_scorer', 'Campaign Scorer', 'Grades each campaign out of 4.', 'claude-sonnet-5', 'idle', null, 'marketing'),
  ];
  T('ai_workers', workers);
  const wk = (key: string) => workers.find((w) => w.key === key)!.id;
  const runs = [
    { id: uid('run'), worker_id: wk('scout'), status: 'done', input: { channel: 'tiktok', count: 10 }, summary: 'Neck and desk gadgets are rising on TikTok Shop.', cost_usd: 0.071, created_at: hoursAgo(5), started_at: hoursAgo(5), finished_at: hoursAgo(4.98), trigger: 'cron' },
    { id: uid('run'), worker_id: wk('analyst'), status: 'done', input: { product_id: 'p' }, summary: 'Cloud Neck Pillow passes Validate — 3.4× landed.', cost_usd: 0.034, created_at: hoursAgo(4), started_at: hoursAgo(4), finished_at: hoursAgo(3.99), trigger: 'cron' },
    { id: uid('run'), worker_id: wk('teardown'), status: 'done', input: { product_id: 'p' }, summary: '4 sellers torn down, 3 open angles.', cost_usd: 0.182, created_at: hoursAgo(3), started_at: hoursAgo(3), finished_at: hoursAgo(2.97), trigger: 'cron' },
    { id: uid('run'), worker_id: wk('brandlab'), status: 'done', input: {}, summary: 'Three brand directions for Northline.', cost_usd: 0.09, created_at: hoursAgo(26), started_at: hoursAgo(26), finished_at: hoursAgo(25.9), trigger: 'manual' },
    { id: uid('run'), worker_id: wk('builder'), status: 'done', input: {}, summary: 'Preview deployed: northline-goods.pages.dev · Lighthouse 94.', cost_usd: 0.21, created_at: hoursAgo(20), started_at: hoursAgo(20), finished_at: hoursAgo(19.8), trigger: 'manual' },
    { id: uid('run'), worker_id: wk('orchestrator'), status: 'done', input: {}, summary: 'Overnight: 2 scouts, 1 analysis, 1 teardown. Approve the hero video first.', cost_usd: 0.045, created_at: hoursAgo(2), started_at: hoursAgo(2), finished_at: hoursAgo(1.99), trigger: 'cron' },
  ].map((r) => ({ domain: 'ecom', output: {}, error: null, tokens_in: 12000, tokens_out: 1800, instructions: null, entity_type: null, entity_id: null, ...r }));
  T('ai_worker_runs', runs);
  T('ai_tasks', [
    { id: uid('task'), domain: 'ecom', body: 'daily:scout:tiktok', worker_id: wk('scout'), instructions: 'Scout TikTok Shop', status: 'done', note: 'Scout tiktok: 10 products → Approvals', run_id: runs[0].id, created_at: hoursAgo(5) },
    { id: uid('task'), domain: 'ecom', body: 'daily:analyst', worker_id: wk('analyst'), instructions: 'Analyse the top new products', status: 'done', note: 'Analyst: 2/2 analyses → Approvals', run_id: runs[1].id, created_at: hoursAgo(4) },
    { id: uid('task'), domain: 'ecom', body: 'daily:teardown', worker_id: wk('teardown'), instructions: 'Tear down a watched product', status: 'done', note: 'Teardown: 4 sellers, 3 angles → Approvals', run_id: runs[2].id, created_at: hoursAgo(3) },
    { id: uid('task'), domain: 'ecom', body: 'Find 10 desk products over $30 that are easy to film', worker_id: wk('scout'), instructions: 'TikTok Shop, over $30, easy phone demo', status: 'running', note: 'Gave it to Product Scout.', run_id: null, created_at: hoursAgo(0.3) },
    { id: uid('task'), domain: 'ecom', body: 'Swap the Northline hero video', worker_id: wk('builder'), instructions: 'Use the 4/4 reel as the hero', status: 'waiting', note: 'Waiting on your approval.', run_id: null, created_at: hoursAgo(1) },
  ]);
  T('ai_approvals', [
    { id: uid('appr'), domain: 'ecom', type: 'analysis', entity_type: 'product', entity_id: null, title: 'Analyst: Cloud Neck Pillow — passes Validate', payload: { summary: 'Desk workers 28–45, easy phone demo, 3.4× landed.', verdict: 'pass', numbers: { note: 'Supplier and shipping are typical CJ numbers — estimate.' }, validate: { rules: [{ name: 'Price ≥ 3× landed', pass: true, detail: '$39.00 vs $11.40 landed = 3.4×' }, { name: 'Ships in ≤ 12 days', pass: true, detail: '8 days' }, { name: 'Trend early or rising', pass: true, detail: 'rising' }] }, detail: { buyer: 'Women 28–45 who work from a kitchen-table desk', angle: 'The 3pm neck crunch, fixed in 10 seconds' } }, principle: 'Loss aversion', source_url: null, confidence: 'estimate', is_money: false, status: 'pending', my_note: null, worker_id: wk('analyst'), run_id: runs[1].id, created_at: hoursAgo(4) },
    { id: uid('appr'), domain: 'ecom', type: 'brand_options', entity_type: 'brand', entity_id: null, title: 'Brand Lab: Stillwater · Halfnine · Easy Hour (2 .com free)', payload: { summary: 'Three bets on the same buyer: calm, playful, premium.', options: [
      { name: 'Stillwater', domain: 'stillwaterdesk.com', domain_status: 'available', handles: '@stillwaterdesk', positioning: 'Quiet comfort for people who work from the kitchen table.', voice: 'Calm, exact, warm', palette: [{ hex: '#1f2a44', name: 'Deep navy', why: 'Trust for 30+ buyers' }, { hex: '#e8dccb', name: 'Warm sand', why: 'Softens the navy' }, { hex: '#c0583a', name: 'Rust', why: 'The one button' }], type: { heading: 'Fraunces', body: 'Inter', why: 'Warm serif + plain sans reads grown-up' }, logo_direction: 'A single wave line under a lowercase wordmark.', principle: 'Halo effect', why_this_buyer: 'They want their desk to feel like a choice, not a compromise.' },
      { name: 'Halfnine', domain: 'halfnine.com', domain_status: 'taken', handles: '@halfnine.co', positioning: 'For the 9:30 slump — playful, fast relief.', voice: 'Bright, quick, kind', palette: [{ hex: '#ffcf4a', name: 'Sun', why: 'Energy' }, { hex: '#1b1b1b', name: 'Ink', why: 'Contrast' }], type: { heading: 'Space Grotesk', body: 'Inter', why: 'Friendly geometric' }, logo_direction: 'A clock face at 9:30 as the "o".', principle: 'Specificity', why_this_buyer: 'Names the exact moment they feel it.' },
      { name: 'Easy Hour', domain: 'easyhourgoods.com', domain_status: 'available', handles: '@easyhourgoods', positioning: 'Small upgrades for long workdays.', voice: 'Relaxed, assured, simple', palette: [{ hex: '#2f4a3a', name: 'Pine', why: 'Calm, natural' }, { hex: '#f4efe6', name: 'Linen', why: 'Soft background' }], type: { heading: 'DM Serif Display', body: 'DM Sans', why: 'Matched family' }, logo_direction: 'Rounded wordmark, an hourglass in the "o".', principle: 'Reciprocity', why_this_buyer: 'Feels like a gift to yourself.' },
    ] }, principle: 'Halo effect', source_url: null, confidence: 'ai', is_money: false, status: 'pending', my_note: null, worker_id: wk('brandlab'), run_id: null, created_at: hoursAgo(2) },
  ]);
  T('ai_alerts', []);
  T('ai_cost_ledger', [{ id: uid('cost'), date: dayStr(0), domain: 'ecom', worker_id: wk('scout'), cost_usd: 0.071 }, { id: uid('cost'), date: dayStr(0), domain: 'ecom', worker_id: wk('analyst'), cost_usd: 0.034 }, { id: uid('cost'), date: dayStr(0), domain: 'ecom', worker_id: wk('teardown'), cost_usd: 0.182 }, { id: uid('cost'), date: dayStr(0), domain: 'ecom', worker_id: wk('builder'), cost_usd: 0.21 }, { id: uid('cost'), date: dayStr(0), domain: 'ecom', worker_id: wk('orchestrator'), cost_usd: 0.125 }]);
  T('ai_domain_caps', ['ecom', 'content', 'marketing', 'digest', 'assistant'].map((d) => ({ id: uid('capx'), domain: d, daily_cap_usd: 3 })));
  const thread = { id: uid('thrd'), run_id: runs[0].id, worker_id: wk('scout'), domain: 'ecom', title: 'Scout: 10 TikTok Shop products', status: 'open', created_at: hoursAgo(4.5) };
  T('ai_threads', [thread]);
  T('ai_thread_messages', [
    { id: uid('tmsg'), thread_id: thread.id, role: 'user', body: 'Half of these are under $20. I said nothing cheap.', proposal: [], cost_usd: 0, created_at: hoursAgo(4.5) },
    { id: uid('tmsg'), thread_id: thread.id, role: 'orchestrator', body: 'Scout had no price floor in its playbook, so it ranked by velocity alone. I\'d add the floor so it sticks, and re-run tonight.', proposal: [{ kind: 'playbook', playbook: 'E-commerce', before: '', after: '- Skip anything under $25 sell price.', why: 'Marq: nothing cheap' }, { kind: 'rerun', instructions: 'Only products over $25.', why: 'Apply the floor now' }], cost_usd: 0.004, created_at: hoursAgo(4.49) },
  ]);
  T('ai_daily_summaries', [{ id: uid('summ'), date: dayStr(0), domain: 'orchestrator', summary_text: 'Approve the Northline hero video first — the store goes live after it. Overnight: 20 products scouted, 2 analysed, 1 teardown. Spend today $0.62.', numbers: { steps: 6, done: 6 } }]);

  // ── Product Sheets: 12 products across TikTok / Amazon / Rising ─────
  const P = (name: string, channel: string, rank: number, sell: number, supplier: number, score: number, img: string, category: string, velocity = 'rising') => {
    const landed = supplier + 3 + sell * 0.105;
    return { id: uid('prod'), name, category, images: [`/demo/${img}.svg`], channel, rank, sell_price: sell, supplier_cost: supplier, landed_cost: Math.round(landed * 100) / 100, margin_pct: Math.round((1 - landed / sell) * 100), days_trending: 6 + rank * 2, velocity, score, content_difficulty: rank % 3 === 0 ? 'medium' : 'easy', source: 'Product Scout', source_url: 'https://example.com/trend', as_of: hoursAgo(5), confidence: 'estimate', watched: rank === 1,
      detail: { buyer: 'Women 28–45 who work from home and already own a standing mat', problem: 'Neck and shoulder ache by 3pm', why_emotional: 'Looking tired on video calls', why_practical: 'Cheaper than one massage', principle: 'Loss aversion', angle: 'Before/after side profile at the desk', competition: '14 sellers, 2 with real content', fail_risks: 'Returns if sizing runs small · seasonal dip in summer · copycats in 30 days', success_metrics: '10k views by day 5 · first sale by day 7 · 2% cart rate', ship_cost: 3, analysis: rank <= 2 ? { verdict: 'pass', rules: [{ name: 'Price ≥ 3× landed', pass: true, detail: `$${sell.toFixed(2)} vs $${landed.toFixed(2)} landed = ${(sell / landed).toFixed(1)}×` }, { name: 'Ships in ≤ 12 days', pass: true, detail: '8 days' }, { name: 'Trend early or rising', pass: true, detail: 'rising' }], ship_days: 8, trend: 'rising', note: 'Typical CJ numbers — estimate.', at: hoursAgo(4) } : undefined } };
  };
  const products = [
    P('Cloud Neck Pillow', 'tiktok', 1, 42, 6.2, 9, 'neck-pillow', 'Health'),
    P('Magnetic Desk Lamp', 'tiktok', 2, 44, 8.5, 8, 'desk-lamp', 'Home office'),
    P('Silicone Stretch Lids', 'tiktok', 3, 24, 3.1, 7, 'lids', 'Kitchen'),
    P('Posture Trainer Band', 'tiktok', 4, 29, 4.4, 7, 'posture', 'Health'),
    P('Mini Label Printer', 'amazon', 1, 49, 11.8, 8, 'printer', 'Office'),
    P('Cable Organizer Box', 'amazon', 2, 32, 5.6, 7, 'cable-box', 'Home office'),
    P('Weighted Sleep Mask', 'amazon', 3, 27, 4.9, 6, 'sleep-mask', 'Sleep'),
    P('Pet Hair Roller', 'amazon', 4, 26, 3.8, 6, 'pet-roller', 'Pets', 'flat'),
    P('Car Seat Gap Filler', 'rising', 1, 34, 5.2, 8, 'gap-filler', 'Auto'),
    P('Glass Water Bottle', 'rising', 2, 36, 7.1, 7, 'bottle', 'Fitness'),
    P('LED Closet Lights', 'rising', 3, 31, 6.0, 7, 'closet-light', 'Home'),
    P('Foldable Phone Stand', 'rising', 4, 22, 2.9, 5, 'phone-stand', 'Tech', 'fading'),
  ];
  T('ecom_products', products);
  T('ecom_product_snapshots', products.flatMap((p) => Array.from({ length: 6 }, (_, i) => ({ id: uid('snap'), product_id: p.id, channel: p.channel, rank: Math.max(1, Number(p.rank) + 5 - i), price: p.sell_price, captured_at: iso(i - 6) }))));
  T('ecom_competitors', [{ id: uid('comp'), product_id: products[0].id, name: 'NeckEase Co', url: 'https://example.com/neckease', dossier: { hero_product: 'Memory foam pillow', price: 44, angle: 'Doctor-recommended', weaknesses: 'Looks medical; no real-desk content' }, images: [], links: [] }]);
  T('ecom_angles', [{ id: uid('angl'), product_id: products[0].id, angle: 'Look awake on your 9am call', buyer: 'Remote workers 28–45', principle: 'Self-image', why_unclaimed: 'Every seller leads with pain, none with appearance', how_to_film: 'Laptop-camera POV: slump, pillow, straighten', chosen: true }]);

  // ── Brand: Northline Goods at step 8, health Testing ────────────────
  const stepDone = (fields: Record<string, string>) => ({ status: 'done', fields, done_at: iso(-10) });
  T('ecom_brands', [{ id: uid('brnd'), name: 'Northline Goods', owner_type: 'mine', client_id: null, current_step: 8, health: 'testing', positioning: 'Calm, well-made desk and travel comfort for people who work from anywhere.', logo_url: null, identity: { palette: ['#1F3A5F', '#E9DCC3', '#C9713D'], voice: 'Calm, exact, warm' }, domain: 'northlinegoods.demo', repo: null, pages_project: 'northline-goods', shopify_store: null, last_activity_at: hoursAgo(3),
    steps: {
      '1': stepDone({ product_name: 'Cloud Neck Pillow', channel: 'TikTok Shop', why: '3 sellers over 10k units in 30 days' }),
      '2': stepDone({ sell_price: '42', supplier_cost: '6.20', ship_cost: '3', ship_days: '8', trend: 'rising' }),
      '3': stepDone({ angle: 'Look awake on your 9am call', principle: 'Self-image' }),
      '4': stepDone({ supplier_name: 'Harbor Supply Co', unit_cost: '6.20', ship_days: '8', sample_status: 'passed' }),
      '5': stepDone({ buyer: 'Remote workers 28–45 who already own a standing mat', positioning: 'Comfort for people who work from anywhere', voice: 'Calm, exact, warm', palette: 'Deep navy — trust. Warm sand — softens it. Rust — the one button.', domain: 'northlinegoods.demo' }),
      '6': stepDone({ preview_url: 'https://northline-goods.pages.dev', checkout: 'Shopify backend + custom storefront' }),
      '7': stepDone({ hooks: 'Your 3pm neck, fixed in 10 seconds\nI stopped looking tired on Zoom', shots_done: 'yes' }),
      '8': { status: 'in_progress', fields: { start_date: dayStr(-4), posts_per_day: '2', platforms: 'TikTok, IG Reels' } },
      '9': { status: 'in_progress', fields: { views: '38400', clicks: '612', add_to_carts: '58', purchases: '18', diagnosis: 'working' } },
      '10': { fields: { reason: 'Analytics recommends scale: 18 sales at 1.6% CTR, 31% cart-to-sale. Next: make 3 more posts on the 3pm-neck angle.' } },
    } }]);
  T('ecom_brand_products', []);
  T('ecom_orders', Array.from({ length: 11 }, (_, i) => ({ id: uid('ordr'), brand_id: null, total: 39, placed_at: hoursAgo(i * 5) })));

  // ── Content: 7-day plan, one clip pair, grades 4/3/2/1 ──────────────
  const acct = (platform: string, handle: string, owner: string, followers: number) => ({ id: uid('acct'), platform, handle, display_name: null, avatar_url: null, owner, brand_id: null, client_id: null, voice: 'Short, direct, no fluff.', posts_per_week_goal: 10, connected: false, followers });
  const accounts = [acct('tiktok', 'northlinegoods', 'ecom', 8400), acct('instagram', 'madebymarq', 'madebymarq', 2140), acct('tiktok', 'marq.builds', 'personal', 11900)];
  T('social_accounts', accounts);
  T('social_account_snapshots', accounts.flatMap((a) => [0, 7, 14, 21, 28].map((d) => ({ id: uid('asnp'), account_id: a.id, captured_at: iso(-d), followers: Math.round(Number(a.followers) * (1 - d / 120)), avg_views: null, source: 'manual' }))));
  const hooks = ['Your 3pm neck, fixed in 10 seconds', 'I stopped looking tired on Zoom', 'The $42 thing my chiropractor asked about', 'POV: your desk finally fits you', 'Three trucks, one menu', 'Cold calling a taco truck at 9am', 'I deleted every app but one'];
  const items = hooks.map((h, i) => ({ id: uid('item'), account_id: accounts[i < 4 ? 0 : i < 6 ? 1 : 2].id, brand_id: null, status: i < 4 ? 'posted' : i === 4 ? 'approved' : 'scripted', concept: h, hooks: [h, `${h}?`, `Nobody told me: ${h.toLowerCase()}`], script: 'Open on the problem, show the product in 3s, end on the face.', shot_list: ['Slump at desk', 'Pillow on', 'Straighten, smile'], caption: `${h} #wfh`, hashtags: '#wfh #desksetup', visual_prompt: null, format: 'reel', thumbnail_url: null, scheduled_for: dayStr(i - 3), scheduled_time: '12:00', posted_post_id: null, grade: [4, 3, 2, 1][i] ?? null, grade_note: ['Hook held 71% — repeat this format.', 'Good hold, weak CTA.', 'Product showed at 6s — too late.', 'No face, no hook: redo.'][i] ?? null }));
  T('content_items', items);
  const segs = [[0, 4.2, 'Okay so, um, let me show you this thing.'], [4.2, 9.8, 'I sit at a desk for like ten hours a day.'], [9.8, 16, 'And by three o\'clock my neck is just done.'], [16, 22.5, 'This is the pillow, it clips onto any chair.'], [22.5, 30, 'Wait, let me, let me do that again.'], [30, 38.4, 'Ten seconds. That\'s it. My neck stopped hurting.'], [38.4, 46, 'Link\'s in the bio if you want one.']].map(([start, end, text]) => ({ start, end, text }));
  T('content_clips', [{ id: uid('clip'), content_item_id: items[0].id, account_id: accounts[0].id, storage_path: null, file_name: 'neck-pillow-raw.mov', duration_s: 46, raw_url: null, edited_url: null, higgsfield_job_id: null, status: 'approved', notes: null, transcript: segs.map((x) => x.text).join(' '), segments: segs, created_at: iso(-3), updated_at: iso(-2),
    edit_plan: { hook: { start: 30, end: 33.5, text: 'Ten seconds. That\'s it.', why: 'The result first — the setup can wait 3 seconds.' }, cuts: [{ start: 9.8, end: 16, why: 'The 3pm pain everyone recognises' }, { start: 16, end: 22.5, why: 'The product, in hand' }, { start: 33.5, end: 38.4, why: 'The payoff line' }, { start: 38.4, end: 42, why: 'CTA, trimmed' }], captions: [{ start: 30, end: 33.5, text: 'Ten seconds. That\'s it.' }, { start: 9.8, end: 16, text: 'by 3pm my neck is done' }, { start: 16, end: 22.5, text: 'clips onto any chair' }, { start: 33.5, end: 38.4, text: 'my neck stopped hurting' }, { start: 38.4, end: 42, text: 'link in bio' }],
      broll: [{ at: 16, prompt: 'Close-up: pillow clipping onto an office chair' }], higgsfield: ['Cinematic macro of a navy neck pillow on a walnut desk, soft window light, 9:16'], on_screen_text: 'Your 3pm neck, fixed', title: 'Neck pillow — 10-second fix', edited_length_s: 25.5, aspect: '9:16', principle: 'Show the outcome first (peak-end).', notes: 'Dropped the restart at 22s and the ums.' } }]);
  T('content_inspiration', [
    { id: uid('insp'), account_id: accounts[0].id, url: 'https://ads.tiktok.com/business/creativecenter/inspiration/topads', platform: 'tiktok', title: 'Desk-pain POV with the fix at second 2', hook: 'POV: it\'s 3pm and your neck has left the chat', format: 'POV + product reveal', why_it_worked: 'Names a feeling everyone at a desk has, then shows the fix before they scroll.', principle: 'Problem–agitate–solve, compressed', our_version: 'POV: it\'s 3pm on a Zoom day — clip the pillow on mid-call, cut to you smiling.', tags: ['wfh', 'pov'], source: 'trend_researcher', created_at: iso(-1) },
    { id: uid('insp'), account_id: accounts[1].id, url: 'https://www.youtube.com/shorts/demo', platform: 'youtube', title: 'Website before/after in 7 seconds', hook: 'This taco truck had no way to order online.', format: 'Before/after screen record', why_it_worked: 'A visual transformation with a clear stake (lost orders) and no talking needed.', principle: 'Contrast effect', our_version: 'Screen-record a local shop\'s page, then swipe to the mock you built for them.', tags: ['before-after'], source: 'trend_researcher', created_at: iso(-1) },
    { id: uid('insp'), account_id: null, url: 'https://later.com/blog/instagram-reels-trends/', platform: 'other', title: 'Reels trend report: “one thing I’d change”', hook: 'If I could change one thing about your…', format: 'Talking head list', why_it_worked: 'Feels like free advice from an expert; viewers save it.', principle: 'Reciprocity', our_version: 'One thing I\'d change about your website — 3 local businesses, 10 seconds each.', tags: ['talking-head'], source: 'manual', created_at: iso(-4) },
  ]);
  T('content_audits', [{ id: uid('audt'), account_id: accounts[0].id, period_start: dayStr(-14), period_end: dayStr(0), posts_count: 4, summary: 'Growing — the problem-first hooks carry it.', created_at: iso(-1),
    repeat: [{ point: 'Open on the result, not the setup', evidence: '“3pm neck” hit 48k (4/4) with the fix in the first 2s.' }, { point: 'Show a face by second 3', evidence: 'Both 3+ posts had a face early; the 1/4 had none.' }, { point: 'Keep it under 20 seconds', evidence: 'The two best were 14s and 18s.' }],
    stop: [{ point: 'Product reveal after 5 seconds', evidence: 'The 2/4 showed it at 6s — half the hold.' }, { point: 'Hooks that are questions with no stake', evidence: '“POV: your desk finally fits you” — 2.3k views.' }, { point: 'Captions with no CTA', evidence: 'Saves dropped 4× on the two without one.' }] }]);
  const posts = items.slice(0, 4).map((it, i) => ({ id: uid('post'), account_id: it.account_id, external_id: null, url: null, type: 'reel', caption: it.caption, hook: it.concept, format: 'demo', length_sec: 14 + i * 4, thumbnail_url: null, posted_at: iso(i - 4), content_item_id: it.id, grade: it.grade, grade_note: it.grade_note }));
  T('social_posts', posts);
  T('social_post_metrics', posts.map((p, i) => ({ id: uid('pmet'), post_id: p.id, captured_at: iso(-1), views: [48200, 21400, 9100, 2300][i], reach: null, likes: [3900, 1500, 420, 60][i], comments: [210, 80, 22, 3][i], shares: [640, 190, 40, 2][i], saves: [1200, 380, 90, 10][i], follows: [310, 90, 18, 1][i], source: 'manual' })));

  // ── Marketing: 2 campaigns (3 and 1), scripts, touches, inbound ─────
  const script = (tone: string, audience: string, title: string, principle: string, body: string) => ({ id: uid('scrp'), venture: 'madebymarq', audience, tone, channel: 'call', title, body, principle, version: 2, parent_id: null, active: true });
  const scripts = [
    script('friendly', 'single', 'Opener — friendly', 'Liking + reciprocity', 'Hey {first}, Marq here — I\'m local, I do websites and ordering for food trucks and small shops around {city}.\n\nI was looking at {business} and noticed there\'s no way to order from your page. So I figured I\'d just call.\n\nI can send you a quick mock of what it could look like — no charge. If you like it, it\'s $1,500–2,000 to build and $500–600 a month after.\n\nWant me to send that over?'),
    script('straight', 'single', 'Opener — straight', 'Specificity', 'Hi, is this {owner}? Marq with Made by Marq in {city}. I pulled up {business} before I called — you\'re getting found, but people can\'t order from what they see. $1,500–2,000 to build, $500–600 to run. Ten minutes this week?'),
    script('straight', 'multi', 'Opener — straight (operator)', 'Loss aversion', '{owner}? Marq, Made by Marq. Each of your locations is its own page and orders leak between them. One system runs all of them. $5,000–6,000 to build. Twenty minutes?'),
  ];
  T('mkt_scripts', scripts);
  const campaigns = [
    { id: uid('camp'), name: 'Sandy food trucks', venture: 'madebymarq', channel: 'call', audience: 'single', list_id: null, script_id: scripts[0].id, start_date: dayStr(-9), end_date: dayStr(-2), targets: { calls: 120, conversations: 14, meetings: 3, closes: 1 }, status: 'done', grade: 3, grade_note: 'Weak: Meeting → close. Add the Juniper Tacos case study to the follow-up.' },
    { id: uid('camp'), name: 'Operators, early calls', venture: 'madebymarq', channel: 'call', audience: 'multi', list_id: null, script_id: scripts[2].id, start_date: dayStr(-16), end_date: dayStr(-10), targets: { calls: 60, conversations: 6, meetings: 2, closes: 1 }, status: 'done', grade: 1, grade_note: 'Weak: Answer rate. Operators don\'t pick up at 4pm — call before 10am.' },
  ];
  T('mkt_campaigns', campaigns);
  const outcomesMkt = ['no_answer', 'answered', 'conversation', 'no_answer', 'meeting', 'no_answer', 'conversation', 'not_interested', 'no_answer', 'answered', 'closed', 'no_answer'];
  T('mkt_touches', outcomesMkt.map((o, i) => ({ id: uid('tuch'), campaign_id: campaigns[0].id, script_id: scripts[0].id, contact_id: null, contact_name: String(dialContacts[i].business_name), contact_phone: String(dialContacts[i].phone), channel: 'call', outcome: o, source_status: null, notes: null, at: hoursAgo(i * 3) })));
  const inb = (name: string, src: string, detail: string, hrs: number, replied: number | null, status: string, extra: Record<string, unknown> = {}) => ({ id: uid('inbd'), contact_id: null, name, phone: null, email: null, source: src, source_detail: detail, source_by: 'rule', first_touch_at: hoursAgo(hrs), responded_at: replied == null ? null : hoursAgo(replied), status, notes: null, message: null, page_url: null, utm: {}, alerted_at: null, venture: 'madebymarq', ...extra });
  T('mkt_inbound', [
    inb('Pine & Pour', 'website', 'Website form', 0.4, null, 'new', { phone: '(555) 014-2200', email: 'hello@pineandpour.demo', message: 'We need online ordering before patio season. What does it cost?', page_url: 'https://madebymarquez.com/contact' }),
    inb('Copper Kettle Catering', 'google', 'Search: google.com', 1.6, null, 'new', { email: 'events@copperkettle.demo', message: 'Saw your site on Google — can you redo ours?', alerted_at: hoursAgo(0.6) }),
    inb('Red Rock Barbers', 'ig_dm', 'Meta: instagram', 5, 4.6, 'conversation', { phone: '(555) 015-9910', notes: 'Wants booking + a gallery. Call Thursday.' }),
    inb('Sam\'s Smash Burgers', 'referral', 'Mentions a referral', 30, 29.2, 'meeting', { phone: '(555) 017-3321', message: 'Pine & Pour said you built theirs.' }),
    inb('Basin Yoga', 'tiktok', 'utm_source=tiktok', 80, 78.5, 'client', { email: 'basin@yoga.demo' }),
  ]);
  T('mkt_inbound_keys', [{ user_id: 'demo', key: 'demo0000000000000000000000000000demo', created_at: iso(-10) }]);
  T('mkt_lists', [
    { id: uid('list'), name: 'Salt Lake independents', venture: 'madebymarq', filters: { city: 'Salt Lake', state: 'UT', excludeChains: true, excludeDuplicates: true, size: 'single' }, counts: { total: 412, callable: 318, filtered: 388, chain_excluded: 36, duplicates: 22, sized: 360, called: 74 }, notes: null, created_at: iso(-6), updated_at: iso(-1) },
    { id: uid('list'), name: 'Food trucks · not called', venture: 'madebymarq', filters: { category: 'food truck', excludeChains: true, excludeDuplicates: true, uncalledOnly: true }, counts: { total: 96, callable: 61, filtered: 96, chain_excluded: 4, duplicates: 7, sized: 90, called: 24 }, notes: null, created_at: iso(-3), updated_at: iso(0) },
  ]);
  T('mkt_foundation', ['gbp', 'legal', 'site', 'email'].map((k, i) => ({ venture: 'madebymarq', item_key: k, done: i < 3, proof_url: null, note: null, done_at: iso(-i) })));
  T('mkt_sites', []);

  // ── Budgeting: 3 "accounts" as categories per venture ──────────────
  const cat = (name: string, monthly: number, icon: string) => ({ id: uid('bcat'), name, monthly_amount: monthly, icon });
  const cats = [cat('Made by Marq', 900, 'briefcase'), cat('Northline Goods', 650, 'storefront'), cat('Personal', 1800, 'house')];
  T('budget_categories', cats);
  const tx = (c: number, type: string, amount: number, description: string, d: number) => ({ id: uid('btx'), category_id: cats[c].id, recurring_id: null, type, amount, description, occurred_on: dayStr(d) });
  T('budget_transactions', [
    tx(0, 'income', 1800, 'Blue Door Bakery — build deposit', -2), tx(0, 'income', 550, 'Summit Auto Spa — retainer', -5), tx(0, 'expense', 120, 'Hosting + domains', -6),
    tx(1, 'income', 412, 'Northline — 11 orders', -1), tx(1, 'expense', 69, 'Samples + shipping', -4), tx(1, 'expense', 39, 'Shopify', -8),
    tx(2, 'expense', 1450, 'Rent', -10), tx(2, 'expense', 212, 'Groceries', -3), tx(2, 'expense', 60, 'Gym', -12),
  ]);
  T('budget_recurring', [{ id: uid('brec'), category_id: cats[2].id, type: 'expense', name: 'Rent', amount: 1450, cadence: 'monthly', next_occurrence: dayStr(20), active: true }]);
  T('budget_settings', [{ current_balance: 6240, mastermind_monthly_cost: 19.99 }]);
  T('tracked_subscriptions', []);

  // ── Brand Lab: 3 options with the why behind every colour ───────────
  const concepts = [
    { id: 'c1', name: 'Harbor', archetype: 'The Caregiver', palette: { bg: '#F4EFE6', surface: '#FFFFFF', primary: '#1F3A5F', text: '#14202E', muted: '#6B7684' }, headingFont: 'Playfair Display', mood: ['calm', 'trusted', 'soft'], blurb: 'Deep navy for trust — the buyer is 30+ and wary of gimmicks. Warm sand keeps it from reading corporate.' },
    { id: 'c2', name: 'Ember', archetype: 'The Everyman', palette: { bg: '#1C1A18', surface: '#27231F', primary: '#C9713D', text: '#F2EAE0', muted: '#A69A8C' }, headingFont: 'Space Grotesk', mood: ['warm', 'direct', 'modern'], blurb: 'Rust on charcoal: one warm colour for the button, so the only thing that pops is "Add to cart".' },
    { id: 'c3', name: 'Tide', archetype: 'The Explorer', palette: { bg: '#EAF3F3', surface: '#FFFFFF', primary: '#1C7C7D', text: '#10292A', muted: '#5E7B7C' }, headingFont: 'DM Sans', mood: ['fresh', 'light', 'travel'], blurb: 'Sea teal says travel and fresh air — for the "work from anywhere" half of the buyer.' },
  ];
  T('brand_lab_briefs', [{ id: uid('brbf'), direction: 'Comfort for people who work from anywhere', business: 'Northline Goods', audience: 'Remote workers 28–45', tone: 'Calm, exact, warm', color_pref: 'Nothing neon', concepts, pinned_concept_id: 'c1', steps: {}, intake_source: 'form', transcript: null, client_id: null, niche_slug: null, niche_custom: 'Desk & travel comfort', bottleneck_verbatim: null, budget: null, services: null, geography: 'US', wants: 'Premium but friendly', dont_wants: 'Medical look', competitors: 'NeckEase Co', quotes: [], extracted_fields: [], functional_spec: null, spec_approved_at: null, prompts: null, design_locked_round_id: null, design_locked_at: null, rounds_to_approval: null, benchmarks_used: null, benchmark_feedback: null, approval_notes: null, niche_feedback: null, reference_url_1: null, reference_url_2: null, reference_url_3: null, ai_copy: null }]);
  T('brand_lab_rounds', []);

  // ── Montage screens: invoices, client CRM ───────────────────────────
  const crm = (business_name: string, contact_name: string, stage: string) => ({ id: uid('crmc'), business_name, contact_name, contact_email: `${contact_name.split(' ')[0].toLowerCase()}@example.com`, contact_phone: null, stage, reveal_full_schedule: false, source: 'cold call', notes: null, stripe_customer_id: null, last_activity_at: hoursAgo(10), public_token: uid('tokn'), client_type: 'client', transcript: null });
  const clients = [crm('Blue Door Bakery', 'Nina Brooks', 'active'), crm('Summit Auto Spa', 'Dev Patel', 'active'), crm('Juniper Tacos', 'Rosa Diaz', 'proposal')];
  T('crm_clients', clients);
  T('client_documents', [
    { id: uid('cdoc'), doc_type: 'invoice', contact_id: null, label: 'Blue Door Bakery — Invoice', status: 'sent', paid_at: null, data: { client_name: 'Nina Brooks', client_company: 'Blue Door Bakery', invoice_number: 'INV-0042', line_items: [{ type: 'Build', description: 'Website + online ordering', qty: '1', rate: '1800', amount: '1800' }, { type: 'Retainer', description: 'Monthly care plan', qty: '1', rate: '550', amount: '550' }] } },
    { id: uid('cdoc'), doc_type: 'proposal', contact_id: null, label: 'Juniper Tacos — Project Brief', status: 'draft', paid_at: null, data: {} },
  ]);
  T('client_invoices', [{ id: uid('cinv'), client_id: clients[0].id, amount_cents: 235000, status: 'paid', description: 'Build + first month', created_at: iso(-6), paid_at: iso(-4) }]);
  T('services', []); T('client_pricing_items', []); T('pricing_template_items', []);

  // ── Dispatch: a two-person crew, this morning's run, one overdue ─────
  const mk = (name: string, role: string, phone: string, extra: Row = {}) => ({ id: uid('dmem'), owner_id: U, user_id: null, name, role, phone, email: null, notify: 'sms', color: null, invite_token: null, invited_at: iso(-9), joined_at: iso(-8), last_active_at: hoursAgo(1.5), ...extra });
  const mikhail = mk('Mikhail Petrov', 'manager', '+1 555 010 4471', { user_id: 'dmikhail-0000-4000-8000-000000000001' });
  const sam = mk('Sam Ortega', 'member', '+1 555 010 8812', { last_active_at: hoursAgo(20) });
  T('dispatch_members', [mikhail, sam]);
  const s1 = { id: uid('dses'), owner_id: U, created_by: U, created_at: iso(0, 10, 42), duration_s: 48, notes: ['Johnson site gate code is 4471'], extraction: {},
    transcript: "Okay — Mikhail, get the Johnson bid out by Thursday, that's the big one. Call the supplier about the pallets, probably Mikhail too. Mikhail, double-check the Ridgeline punch list before Friday. I'll sign the lease Friday. Johnson site gate code is 4471." };
  const s2 = { id: uid('dses'), owner_id: U, created_by: U, created_at: iso(-1, 16, 5), duration_s: 21, notes: [], extraction: {},
    transcript: 'Sam, send the Ridgeline invoice today and book the dumpster pickup for Monday.' };
  T('dispatch_sessions', [s1, s2]);
  const task = (session: Row, assignee: Row | null, title: string, priority: number, due: string | null, quote: string, extra: Row = {}) => ({
    id: uid('dtsk'), owner_id: U, session_id: session.id, created_by: U, assignee_member_id: assignee ? assignee.id : null, title, priority, priority_reason: priority === 1 ? 'Called "the big one" — money on the line' : priority === 2 ? 'Has a hard date this week' : 'Normal', due_date: due, source_quote: quote, status: 'open', needs_help: false, done_at: null, nudged_at: null, sort_order: 0, created_at: session.created_at, updated_at: session.created_at, ...extra });
  const bid = task(s1, mikhail, 'Johnson bid out', 1, dayStr(1), "get the Johnson bid out by Thursday, that's the big one");
  T('dispatch_tasks', [
    bid,
    task(s1, mikhail, 'Call supplier re: pallets', 3, null, 'Call the supplier about the pallets, probably Mikhail too'),
    task(s1, mikhail, 'Check the Ridgeline punch list', 2, dayStr(-1), 'double-check the Ridgeline punch list before Friday'),
    task(s1, null, 'Sign the lease', 2, dayStr(2), "I'll sign the lease Friday"),
    task(s2, sam, 'Send the Ridgeline invoice', 2, dayStr(-1), 'send the Ridgeline invoice today', { status: 'done', done_at: iso(0, 9, 15) }),
    task(s2, sam, 'Book the dumpster pickup', 3, dayStr(4), 'book the dumpster pickup for Monday', { status: 'done', done_at: iso(0, 8, 40) }),
  ]);
  // Overview shows the Dispatch widget (medium) after the default widgets.
  T('home_widget_prefs', [{ widget_key: 'dispatch', hidden: false, sort_order: null, size: 'M' }]);

  // Marq on James's crew — what the member side ("From James") looks like.
  const J = JAMES_TEAM.ownerId;
  db.dispatch_members.push({ id: JAMES_TEAM.memberId, owner_id: J, user_id: U, name: 'Marq', role: 'member', phone: null, email: null, notify: 'push', color: null, invite_token: null, invited_at: iso(-20), joined_at: iso(-20), last_active_at: hoursAgo(1), created_at: iso(-20) });
  const js = { id: uid('dses'), owner_id: J, created_by: J, created_at: iso(0, 7, 55), duration_s: 30, notes: [], extraction: {}, transcript: "Marq — the Johnson bid out by Thursday, that's the big one. And send me the Ridgeline photos." };
  db.dispatch_sessions.push(js);
  db.dispatch_tasks.push(
    { ...task(js, null, 'Johnson bid out', 1, dayStr(1), "that's the big one"), owner_id: J, created_by: J, assignee_member_id: JAMES_TEAM.memberId },
    { ...task(js, null, 'Send James the Ridgeline photos', 3, null, 'send me the Ridgeline photos'), owner_id: J, created_by: J, assignee_member_id: JAMES_TEAM.memberId },
  );
  T('dispatch_comments', [{ id: uid('dcom'), task_id: bid.id, owner_id: U, author_id: 'dmikhail-0000-4000-8000-000000000001', body: 'Need the final window count from Sam before I can price it.', created_at: iso(0, 11, 30) }]);

  // Everything else a screen might ask for starts empty (never undefined).
  return db;
}

// ── /api answers for Worker-backed screens ──────────────────────────
export function demoLeads(): Row[] {
  const names = ['Juniper Tacos', 'Blue Door Bakery', 'Summit Auto Spa', 'Pine & Pour', 'Red Rock Barbers', 'Canyon Coffee Co', 'Lucky Wok', 'Alta Pet Grooming'];
  const cats = ['Food truck', 'Bakery', 'Auto detailing', 'Bar', 'Barber', 'Coffee shop', 'Restaurant', 'Pet grooming'];
  return names.map((n, i) => ({
    id: `leaddemo-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, business_name: n, owner_name: ['Rosa Diaz', 'Nina Brooks', 'Dev Patel', 'Sam Reyes', 'Ty Moore', 'Ana Lima', 'Jin Wu', 'Kay Ford'][i], phone: `(555) 02${i}-11${i}0`, email: null,
    industry: cats[i], category: cats[i], website_status: i % 3 === 0 ? 'none' : 'outdated', social_media: i % 2 === 0, revenue: null, years_in_business: `${3 + i}`, automation_status: null,
    pain_points: 'No online ordering; site not mobile-friendly', competitive_advantage: null, notes: null, tag: i < 3 ? 'hot' : i < 6 ? 'warm' : 'cold', created_at: hoursAgo(48 + i), state: 'UT', address: `${100 + i * 10} Main St`, rating: 4.1 + (i % 5) / 10, review_count: 40 + i * 13, website: i % 3 === 0 ? null : `https://example.com/${i}`, pooled: true,
    place_id: `demo-place-${i}`, city: ['Sandy', 'Draper', 'Murray', 'Salt Lake City'][i % 4], lat: null, lng: null, search_category: cats[i], summary: 'Busy lunch rush, no way to order ahead.', days_since_last_review: 3 + i, fizzle_score: 90 - i * 6, tier: i < 3 ? 'A' : i < 6 ? 'B' : 'C', fizzle_reasons: ['No online ordering', 'Old website'],
    maps_url: null, streetview_url: null, streetview_path: null, photo_path: null, photo_paths: [], owner_is_agent_only: false, registered_agent: null, registry_legal_name: `${n} LLC`, registry_confidence: 0.9, registry_note: null, registry_url: null,
    status: i === 0 ? 'interested' : i === 1 ? 'callback' : null, owner_phone: i < 4 ? `(555) 03${i}-2200` : null, owner_email: null, flagged: false, flag_note: null, call_notes: i === 0 ? 'Wants a mock by Friday.' : null, call_count: i < 3 ? 2 : 0, last_called_at: i < 3 ? hoursAgo(20) : null, dialing_queued: i < 5, dialing_queued_at: hoursAgo(30),
    is_chain: false, chain_name: null, business_size: 'single', duplicate_of: null, filter_note: 'One location in the list', filtered_at: hoursAgo(10),
  }));
}
