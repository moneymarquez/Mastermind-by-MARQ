-- schema_112: widget sizes on Overview (spec 15 §3A — Dispatch in S / M / L).
-- Additive only; null = the widget's default size.
alter table public.home_widget_prefs add column if not exists size text check (size in ('S', 'M', 'L'));
