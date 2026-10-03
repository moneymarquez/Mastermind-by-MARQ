-- schema_118: Weekly Review becomes self-written (design handoff). You
-- answer three prompts and rate the week 1-10; Nova's summary is an
-- optional draft beside it. Adds the columns and lets summary be empty for
-- a week you wrote without AI. Existing rows are untouched.
alter table public.weekly_reviews add column if not exists went_well text;
alter table public.weekly_reviews add column if not exists didnt text;
alter table public.weekly_reviews add column if not exists one_change text;
alter table public.weekly_reviews add column if not exists rating smallint;
alter table public.weekly_reviews add column if not exists submitted_at timestamptz;
alter table public.weekly_reviews drop constraint if exists weekly_reviews_rating_check;
alter table public.weekly_reviews add constraint weekly_reviews_rating_check check (rating is null or rating between 1 and 10);
alter table public.weekly_reviews alter column summary set default '';
