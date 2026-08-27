-- Mastermind by MARQ — Phase 42 schema (Client CRM: confidence tags,
-- service matcher storage, and the Taco Stand seed client). Run once,
-- after schema_041_client_dashboard.sql, in the Supabase SQL editor.
-- Safe to re-run in full — the Taco Stand seed is guarded on the business
-- name and will not duplicate or overwrite an existing record.

-- ── Confidence tags (Part 1c) ───────────────────────────────────────────
-- Keyed the same as client_audits.answers: { "unit_economics": "estimated" }.
-- Mirrors how the discovery call actually goes ("do you know that for
-- sure, or is that a rough guess?") and is passed into the analysis prompt
-- so soft numbers get treated as soft rather than quoted back as fact.
-- Absence of a key means unspecified, which the prompt treats the same as
-- estimated — the cautious default.
alter table client_audits add column if not exists answer_confidence jsonb not null default '{}';

-- ── Service matcher output ──────────────────────────────────────────────
-- The parallel branch of the system flow: alongside the written analysis,
-- Claude flags which catalog services this business actually needs.
-- Shape: [{ "name": "...", "category": "...", "reason": "..." }]. Stored
-- rather than recomputed so the flags persist between sessions and can be
-- dismissed/added one at a time.
alter table client_audits add column if not exists suggested_services jsonb not null default '[]';

-- ── Part 8 — Taco Stand (Sandy, UT) seed client ─────────────────────────
-- The real discovery call, loaded so the system launches with live data
-- instead of an empty state. The granular call notes are mapped onto the
-- seven question keys schema_039 seeded (rapport, vision, positioning,
-- unit_economics, marketing_acquisition, lifetime_value, bottleneck)
-- rather than inventing a parallel question set — that keeps one question
-- bank driving all three capture modes, which is the whole point of Part 1.
do $$
declare
  v_user_id uuid;
  v_client_id uuid;
begin
  select id into v_user_id from auth.users order by created_at asc limit 1;
  if v_user_id is null then
    return;
  end if;

  -- Guard: never duplicate, never overwrite a record that already exists
  -- (it may have been edited by hand since).
  if exists (select 1 from crm_clients where user_id = v_user_id and business_name = 'Taco stand (Sandy, UT)') then
    return;
  end if;

  insert into crm_clients (user_id, business_name, contact_name, stage, source, reveal_full_schedule, notes)
  values (
    v_user_id,
    'Taco stand (Sandy, UT)',
    'Taco stand owner',
    'discovery_complete',
    'internal',
    false,
    'Do not quote price during discovery — bring pricing back after building the plan. Proposed ongoing structure once signed: biweekly marketing execution, quarterly check-in calls.'
  )
  returning id into v_client_id;

  insert into client_audits (user_id, client_id, status, answers, answer_confidence)
  values (
    v_user_id,
    v_client_id,
    'complete',
    jsonb_build_object(
      'rapport',
        'Open 3 years, originally started in Vegas. Runs 2 trucks with an internal system already in place between them. Two employees total — him and his wife.',
      'vision',
        'Wants to scale up — "one taco stand in every city." Make enough money to open up other trucks.',
      'positioning',
        'Meat is really good quality — cuts steak daily. Coke straight from Mexico. Serves the West Valley / West Jordan area, with some customers carrying over from the other truck.',
      'unit_economics',
        '$3 per taco. Roughly 25 to 300-400 customers a day (wide range, not tracked). ' ||
        'Weekly costs: drinks $1,000, meat $1,500, veggies $800, labor 136 combined hours ($816-1,632/week for both). ' ||
        'Monthly costs: electricity $400, propane $80, water $80.',
      'marketing_acquisition',
        'TikTok and Instagram — his wife posts. Total past marketing spend: $300 one-time for a videographer; otherwise only organic TikTok/Facebook. ' ||
        'Hours Mon-Thu 10am-10pm, Fri-Sat 10am-12am. No specific lunch rush; busy hours are 5-8pm.',
      'lifetime_value',
        'People do come back regularly — retention is not the issue. The problem is awareness: getting people to know he exists.',
      'bottleneck',
        'Getting his name out there — a pure awareness/visibility problem, not a retention or product problem.'
    ),
    -- The daily customer count is the one number he explicitly could not
    -- confirm ("25 to 300-400"), so unit_economics is tagged estimated;
    -- the cost figures he gave firmly, but they live in the same answer,
    -- so the whole answer carries the cautious tag rather than implying
    -- the customer range is solid.
    jsonb_build_object('unit_economics', 'estimated')
  );

  -- The recommended package: the standard template ($1,000 upfront +
  -- $1,000/mo x 3), with the three services it covers flagged as
  -- suggestions rather than billed as separate line items — they're
  -- what's included in that price, not additions to it.
  update client_audits
    set suggested_services = jsonb_build_array(
      jsonb_build_object(
        'name', 'Google Business Profile setup/optimization',
        'category', 'Visibility & Discoverability',
        'reason', 'Pure awareness problem and no GBP presence — this is the fastest local-discovery win available to him.'
      ),
      jsonb_build_object(
        'name', 'Content creation + posting (3-5x/week)',
        'category', 'Social Media & Content',
        'reason', 'Already on TikTok/Instagram but posting is ad hoc and falls on his wife; consistent output is what turns organic into reach.'
      ),
      jsonb_build_object(
        'name', 'Promo/campaign design',
        'category', 'Retention & Loyalty',
        'reason', 'Taco Tuesday-style recurring promo gives the content something to drive toward during the 5-8pm peak.'
      )
    )
    where client_id = v_client_id;

  insert into client_pricing_items (user_id, client_id, label, amount, cadence, repeat_count, is_upfront, sort_order)
  values
    (v_user_id, v_client_id, 'Month 1 — Launch (Google Business setup, content calendar, campaign launch)', 1000, 'one_time', 1, true, 0),
    (v_user_id, v_client_id, 'Months 2-4 — Active Management', 1000, 'monthly', 3, false, 1);
end $$;
