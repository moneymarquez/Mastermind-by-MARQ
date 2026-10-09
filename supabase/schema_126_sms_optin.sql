-- October build: SMS opt-in records (Twilio A2P 10DLC proof of consent).
-- The public /sms page posts here through the Worker (service role); each
-- row keeps the exact consent text shown, the time, IP and page. Additive.
create table if not exists sms_optins (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  consent_text text not null,
  page text,
  ip text,
  user_agent text,
  opted_in_at timestamptz not null default now(),
  opted_out_at timestamptz
);
create index if not exists sms_optins_phone_idx on sms_optins (phone);
alter table sms_optins enable row level security;
-- No client access: only the owner can read, writes come from the Worker.
drop policy if exists "owner reads" on sms_optins;
create policy "owner reads" on sms_optins for select using (is_owner(auth.uid()));
