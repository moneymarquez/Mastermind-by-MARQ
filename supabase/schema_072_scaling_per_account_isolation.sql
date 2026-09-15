-- Mastermind by MARQ — Phase 72 schema. Completes what schema_060
-- (owner_only_grants) started but never finished: every Scaling-category
-- table was still locked to "(auth.uid() = user_id) AND is_owner(auth.uid())"
-- — literally only the owner, full stop — so a comped account granted a
-- Scaling module key via owner_only_grants could see the module in the
-- nav (useModuleAccess.ts's canAccess() checks grantedKeys) but every
-- query against it would still be rejected by RLS. This drops the
-- is_owner() half of the check on each one, leaving plain
-- "auth.uid() = user_id" — the exact same per-row isolation crm_clients
-- already uses (schema_068). Nothing broadens: each account still only
-- ever sees rows it created itself. Client-login SELECT policies
-- (my_client_id()-scoped, e.g. "client reads own row") are separate
-- policies on some of these tables and are untouched.
do $$
declare
  t text;
  tables text[] := array[
    'marketing_assets', 'marketing_campaigns', 'marketing_content_pipeline', 'marketing_briefs',
    'content_growth_plans', 'content_checkins',
    'scaling_plans', 'business_audits', 'idea_sessions', 'idea_messages', 'brand_lab_briefs',
    'business_profile', 'client_documents',
    'audit_questions', 'pricing_template_items', 'services',
    'client_pricing_items', 'client_audits', 'client_invoices'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on %I', 'owner only', t);
    execute format('drop policy if exists %I on %I', 'own rows', t);
    execute format(
      'create policy %I on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      'own rows', t
    );
  end loop;
end $$;
