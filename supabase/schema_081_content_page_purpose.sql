-- Mastermind by MARQ — Phase 81 schema (Content Creation rebuild, build
-- order item 1: growth plan header + posts-shipped streak).
--
-- "Ask this before generating anything. It changes the entire slate."
-- Kept as its own explicit, visible field rather than inferred from the
-- client's client_type ('self' vs 'client') — inference would be right
-- most of the time, but the build prompt frames this as a real question
-- the operator confirms, not a silent default. Nullable until set; slate
-- generation (item 2) gates on it, same pattern as Marketing's
-- business_model (schema_074).
alter table content_growth_plans add column if not exists page_purpose text
  check (page_purpose in ('audience_for_offer', 'leads_for_business'));
