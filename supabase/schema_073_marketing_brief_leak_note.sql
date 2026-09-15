-- Mastermind by MARQ — Phase 73 schema (Marketing Plays rebuild, build
-- order item 1: diagnosis header). One nullable column: the operator's
-- reasoning when they set or override which leak a brief is diagnosed as
-- fixing — the "operator can disagree and set the leak himself, with a
-- note" requirement. Distinct from primary_leak itself (already existed,
-- schema_069), which stores the leak; this stores why.
alter table marketing_briefs add column if not exists leak_note text;
