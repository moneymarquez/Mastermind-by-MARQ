-- Mastermind by MARQ — Phase 54 schema (Client Delivery Portal, Part 2).
-- Run once, after schema_053_brand_lab_rounds.sql. Safe to re-run in
-- full — the module seed is guarded on "no rows yet for this owner".
--
-- The client-role account (schema_045) already lands on ClientPortal.tsx
-- with RLS-scoped reads of its own crm_clients row, audit, and invoices.
-- This adds what the portal shows on top of that: owner-authored welcome
-- content, the deliverables ("what we built, and why it matters for
-- you"), an operating-manual module library assigned per client, a
-- message thread, handoff mode, and client visibility into PUBLISHED
-- monthly reports for the numbers section. Every client-side policy is
-- SELECT-only except the two things a client legitimately writes: its
-- own messages and its own module progress.

-- ── client_portal — one row per client, the owner's portal copy ────────
create table if not exists client_portal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null unique references crm_clients(id) on delete cascade,
  welcome_text text,
  logo_url text,
  -- [{ "label": "Discovery call", "date": "2026-09-01", "done": true }]
  timeline jsonb not null default '[]',
  next_steps text,
  handoff_mode boolean not null default false,
  handoff_started_at timestamptz,
  handoff_checkin_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table client_portal enable row level security;
drop policy if exists "owner only" on client_portal;
create policy "owner only" on client_portal for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
drop policy if exists "client reads own portal" on client_portal;
create policy "client reads own portal" on client_portal for select
  using (client_id = my_client_id());

-- ── client_deliverables — "what we built" cards ─────────────────────────
-- brief_id links back to the Brand Lab brief so the why-it-matters copy
-- can be pulled from the functional spec + round rationale already
-- written there, instead of typed twice.
create table if not exists client_deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  brief_id uuid references brand_lab_briefs(id) on delete set null,
  kind text not null default 'other' check (kind in ('website', 'brand', 'gbp', 'social', 'payments', 'content', 'other')),
  title text not null,
  what_it_is text,
  why_it_matters text,
  link_url text,
  status text not null default 'in_progress' check (status in ('in_progress', 'review', 'live')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table client_deliverables enable row level security;
drop policy if exists "owner only" on client_deliverables;
create policy "owner only" on client_deliverables for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
drop policy if exists "client reads own deliverables" on client_deliverables;
create policy "client reads own deliverables" on client_deliverables for select
  using (client_id = my_client_id());
create index if not exists client_deliverables_client_idx on client_deliverables(client_id, sort_order);

-- ── portal_modules — the operating-manual library (owner-owned) ─────────
-- applies_to lists deliverable kinds; a module with an empty list applies
-- to every client. Assignment is per client (next table) so a client
-- without a website never sees website modules.
create table if not exists portal_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug text not null,
  title text not null,
  applies_to text[] not null default '{}',
  what_it_is text not null default '',
  why_it_matters text not null default '',
  steps text[] not null default '{}',
  done_when text not null default '',
  video_url text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);
alter table portal_modules enable row level security;
drop policy if exists "owner only" on portal_modules;
create policy "owner only" on portal_modules for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- ── client_module_assignments — which modules a client sees + progress ──
create table if not exists client_module_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  module_id uuid not null references portal_modules(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  opened_at timestamptz,
  completed_at timestamptz,
  unique (client_id, module_id)
);
alter table client_module_assignments enable row level security;
drop policy if exists "owner only" on client_module_assignments;
create policy "owner only" on client_module_assignments for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
drop policy if exists "client reads own assignments" on client_module_assignments;
create policy "client reads own assignments" on client_module_assignments for select
  using (client_id = my_client_id());
-- The one client write on this table: opened_at / completed_at on its
-- own rows. with check keeps the row pinned to its own client_id.
drop policy if exists "client tracks own progress" on client_module_assignments;
create policy "client tracks own progress" on client_module_assignments for update
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create index if not exists client_module_assignments_client_idx on client_module_assignments(client_id);

-- A client can read a module only through an assignment to it.
drop policy if exists "client reads assigned modules" on portal_modules;
create policy "client reads assigned modules" on portal_modules for select
  using (exists (select 1 from client_module_assignments a where a.module_id = portal_modules.id and a.client_id = my_client_id()));

-- ── client_messages — the thread ────────────────────────────────────────
-- user_id here is whoever wrote the row (owner or the client's own auth
-- user), so the owner policy is is_owner() alone — the owner sees every
-- thread regardless of who authored a message.
create table if not exists client_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  sender text not null check (sender in ('owner', 'client')),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table client_messages enable row level security;
drop policy if exists "owner all" on client_messages;
create policy "owner all" on client_messages for all
  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));
drop policy if exists "client reads own thread" on client_messages;
create policy "client reads own thread" on client_messages for select
  using (client_id = my_client_id());
drop policy if exists "client writes own thread" on client_messages;
create policy "client writes own thread" on client_messages for insert
  with check (client_id = my_client_id() and sender = 'client');
drop policy if exists "client marks read" on client_messages;
create policy "client marks read" on client_messages for update
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create index if not exists client_messages_client_idx on client_messages(client_id, created_at);

-- ── Numbers: a client may read its own PUBLISHED monthly reports ─────────
-- Baseline = the earliest published report, current = the latest. No
-- report → the portal shows an honest empty state, never a made-up tile.
drop policy if exists "client reads own published reports" on client_reports;
create policy "client reads own published reports" on client_reports for select
  using (client_id = my_client_id() and published);

-- ── Seed: the starting module library ───────────────────────────────────
do $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from app_owner limit 1;
  if v_user_id is null then
    select id into v_user_id from auth.users order by created_at asc limit 1;
  end if;
  if v_user_id is null then
    return;
  end if;
  if exists (select 1 from portal_modules where user_id = v_user_id) then
    return;
  end if;

  insert into portal_modules (user_id, slug, title, applies_to, what_it_is, why_it_matters, steps, done_when, sort_order) values
  (v_user_id, 'stripe-payments', 'Taking payments with Stripe', array['payments','website'],
    'Your Stripe dashboard is where every card payment lands, where payouts to your bank are scheduled, and where refunds happen.',
    'Money you cannot see is money you cannot manage. Knowing where a payout is, what a fee was, and how to refund someone in 30 seconds is the difference between a calm customer and a chargeback.',
    array['Open dashboard.stripe.com on your phone and sign in with the email you gave me.','Home shows today, this week, and the next payout — the payout date is when it hits your bank.','Tap Payments to see every charge. Tap one to see the fee (about 2.9% + 30c) and the net amount.','To refund: open the payment, tap Refund, choose full or partial, confirm. It takes 5-10 days to appear on their card.','Tap Balance → Payouts to change your bank account or payout schedule if you ever need to.'],
    'You can find last week''s payout, tell me what the fee on one payment was, and refund a test charge without asking.', 1),
  (v_user_id, 'gbp-posting', 'Posting to Google Business Profile', array['gbp'],
    'Google Business Profile is the listing that shows up when someone searches your business name or "near me". Posts are short updates that appear right on it.',
    'A profile that posted this week ranks and converts better than one that went quiet in March. One post a week, two minutes, from your phone, keeps the listing alive.',
    array['Open the Google Maps app, tap your profile picture → Your Business Profile (or search your business and tap Manage).','Tap Add update (or Posts → Add). Choose Update for news, Offer for a deal, Event for a date.','Write 2-3 sentences in plain language. Say what changed and why a customer should care. Add one real photo.','Add a button (Call, Book, Learn more) pointing to your site or phone number.','Tap Publish. It goes live in minutes and expires after about a week — that is fine, post again next week.'],
    'You have published one post with a real photo and a button, and it shows on your listing when you search yourself.', 2),
  (v_user_id, 'reviews', 'Responding to reviews — good and bad', array['gbp'],
    'Every Google review can get a public reply from you. Customers read the replies as much as the reviews.',
    'A thoughtful reply to a bad review wins more customers than ten good reviews with no reply — it shows the next person exactly how you handle problems.',
    array['Open your Business Profile → Reviews. Reply within 48 hours; Google shows how fast you respond.','Good review: thank them by name, mention the specific thing they praised, invite them back. Two sentences.','Bad review: do not argue publicly. Template: "I am sorry this happened. That is not the experience we want anyone to have. Please call me directly at [number] so I can make it right." Then actually call.','Fake or abusive review: reply calmly once, then tap the three dots → Report review.','Ask happy customers for a review the same day, in person, by sending them your review link (I put it in your Welcome page).'],
    'Every review on your profile has a reply, and the newest one was answered within two days.', 3),
  (v_user_id, 'hours', 'Updating hours, holiday hours, and temporary closures', array['gbp','website'],
    'Your hours live in two places: Google Business Profile and the website. Google is the one people trust when they are deciding whether to drive over.',
    'Wrong hours are the fastest way to earn a one-star review from someone standing at a locked door.',
    array['Business Profile → Edit profile → Hours. Set regular hours once; they persist.','For a holiday: Edit profile → Hours → Add special hours, pick the date, set the hours or mark closed. Do this a week ahead.','Closing for a stretch (vacation, remodel): Edit profile → Hours → Mark as temporarily closed. Reopen the same way — do not delete the listing.','Website hours: they are on the contact section. If I built you an admin, change them there; if not, message me and I will update them within a day.'],
    'Your next holiday already has special hours set on Google, and the website matches.', 4),
  (v_user_id, 'social-scheduling', 'Scheduling social posts', array['social'],
    'Batch-writing a week of posts in one sitting and scheduling them, instead of remembering to post every day.',
    'Consistency beats cleverness. Three scheduled posts a week that actually go out outperform a brilliant post that never happens.',
    array['Pick one 30-minute slot a week. Shoot 5-6 photos or short clips of real work, real people, real product that day.','Open the scheduling tool I set you up with (or Instagram → Create → Advanced settings → Schedule).','Write one line per post: what it is, who it is for, one thing to do (call, come in, book).','Schedule across the week — mornings 7-9am or evenings 6-8pm are the reliable windows.','Check comments and DMs once a day; reply to every one, even with a thumbs-up.'],
    'A week of posts is scheduled and you did not think about social media for six days.', 5),
  (v_user_id, 'analytics', 'Reading the numbers that matter (and ignoring the rest)', array[]::text[],
    'Your portal Numbers section shows a small set of figures against the baseline from when we started. Everything else is noise.',
    'Followers and likes do not pay rent. Calls, direction requests, form submissions, and paid customers do. Watching the right four numbers keeps you from chasing the wrong ones.',
    array['Open Your numbers in this portal. Baseline is the month we started; current is the latest published month.','Watch: profile views → calls and direction requests (Google), site leads, and paid invoices. Those are the funnel.','Ignore: follower counts, impressions, and reach on their own. Only care if calls and leads move with them.','A dip in one month is weather; a dip in three months is a signal. Message me on the second one.'],
    'You can say which of your numbers moved this month and which one you would ignore.', 6),
  (v_user_id, 'photos', 'Adding photos properly', array['gbp','social','website'],
    'Real photos of your work, your place, and your team — added to Google and the site regularly.',
    'Listings with recent real photos get more direction requests and calls than ones with a logo and a stock image. Customers can tell the difference instantly.',
    array['Shoot in daylight or under the brightest light you have. Wipe the lens first. Landscape for the site, portrait for social.','Get the thing, not just the sign: the finished job, the plate, the chair, the truck in front of the house.','Google: Business Profile → Photos → Add. Aim for 2-4 new photos a month. Google favors recent uploads.','Website: send me the photos or use the admin if you have one. I will place them properly; do not stretch or crop them yourself.','Never post a customer''s face or address without asking.'],
    'Your Google listing has photos from this month, and none of them are stock.', 7),
  (v_user_id, 'website-content', 'Updating website content (only what you should touch)', array['website'],
    'The parts of your site you can change yourself — hours, prices, a special, a new photo — and the parts you should send to me.',
    'Small edits should not wait on me. Structural edits should, because the site was built to convert and moving one thing can quietly break that.',
    array['You can change: hours, phone number, prices on the services list, the current offer, photos in the gallery.','Send to me: new pages, new sections, layout changes, anything with a form or payment, anything you are not sure about.','If I built you an admin, sign in there — every field you are allowed to change is on it, and nothing else is.','After any change, open the site on your phone and check the page you touched. If it looks wrong, message me before trying to fix it.'],
    'You have changed one price or one photo yourself and checked it on your phone.', 8),
  (v_user_id, 'inbound-lead', 'Handling a lead from the site form', array['website'],
    'What happens when someone fills out the form on your site, and what you do in the next hour.',
    'Speed to first reply is the single biggest factor in whether a web lead becomes a customer. Same hour wins; next day loses to whoever answered.',
    array['Form submissions arrive by email (and text if we set that up). Save that sender as a contact so it never lands in spam.','Reply within the hour, by phone first. Voicemail plus a short text: "Hi [name], this is [you] from [business] — got your request about [thing]. Call or text me back here."','Ask what they need, give a price or a time to come out, and book it on the call. Do not send them back to the website.','Log it: name, what they wanted, what you quoted, outcome. A note on your phone is fine — I will ask for it monthly.'],
    'The last three form leads got a reply within the hour and you can tell me what happened to each.', 9),
  (v_user_id, 'when-broken', 'What to do when something breaks', array[]::text[],
    'The site is down, payments failed, a form stopped arriving, Google shows the wrong thing — who to contact and what to include so it gets fixed on the first message.',
    'A clear report gets fixed in an hour. "It''s broken" gets fixed after three back-and-forths.',
    array['Message me through the Messages tab here (it keeps everything in one place) — or text if it is urgent and customer-facing.','Include: what you were doing, what you expected, what happened instead, and a screenshot. On iPhone: side button + volume up.','Say when it started and whether a customer was affected.','Do not try to fix payments or forms yourself — a second change on top of a break is much harder to untangle.','If the site is fully down: check it on cellular, not just wifi, before you message. If it is down on both, that is urgent — say so.'],
    'You know exactly where to report a problem and what to put in the message.', 10);
end $$;
