-- schema_117: the redesign's third theme option, "System" (follows the
-- device). Widens the check; existing 'dark' / 'light' rows are untouched.
alter table public.nova_preferences drop constraint if exists nova_preferences_theme_check;
alter table public.nova_preferences add constraint nova_preferences_theme_check check (theme = any (array['dark','light','system']));
