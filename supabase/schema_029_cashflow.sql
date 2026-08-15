-- Mastermind by MARQ — Phase 29 schema (cash-flow forecasting). Run once,
-- after schema_028_weekly_review.sql, in the Supabase SQL editor. One
-- additive column on the existing budget_settings table (schema_024) —
-- nullable-safe default, no existing row touched beyond gaining this
-- column at its default. Safe to re-run in full.

-- The forecast (src/data/useCashFlow.ts) needs a real starting point to
-- project forward from — there's no "bank balance" concept anywhere else
-- in this app to derive one from, so it's a plain user-editable number,
-- same reasoning as mastermind_monthly_cost on this same table: not
-- something to fabricate or assume.
alter table budget_settings add column if not exists current_balance numeric not null default 0;
