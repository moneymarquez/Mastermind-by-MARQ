-- Mastermind by MARQ — Phase 76 schema (Marketing Plays rebuild, build
-- order item 4: build-out — assets, shot lists, export blocks).
--
-- Ties generated copy/creative assets back to the specific play they
-- were built for, instead of a client-wide undifferentiated pile —
-- "engine builds picked play out in full." Cascades with the play
-- (schema_074's own choice for marketing_plays itself): an asset built
-- for a play has no meaning once that play is gone.
alter table marketing_assets add column if not exists play_id uuid references marketing_plays(id) on delete cascade;
create index if not exists marketing_assets_play_id_idx on marketing_assets(play_id);

-- Same tag for uploaded photos/video shot for a play's build-out —
-- mirrors client_media's existing audit_id (schema_046-era) nullable
-- link, ON DELETE SET NULL so a deleted play doesn't destroy real photos
-- the operator shot, just detaches the tag.
alter table client_media add column if not exists play_id uuid references marketing_plays(id) on delete set null;
create index if not exists client_media_play_id_idx on client_media(play_id);

-- 'marketing' is a new client_media category (build-out shot-list
-- uploads) — the category CHECK constraint predates it and needs
-- widening, same as every other category enum change in this schema.
alter table client_media drop constraint if exists client_media_category_check;
alter table client_media add constraint client_media_category_check
  check (category in ('truck', 'food', 'business_card', 'screenshot', 'other', 'marketing'));
