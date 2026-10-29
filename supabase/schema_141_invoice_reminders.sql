-- Invoice reminders (spec Part 4): at 3 and 7 days overdue the timer drafts a
-- reminder as an approval card; reminder_stage records which one was drafted
-- so it's never drafted twice. Nothing is sent until Marq approves the card.
-- biz_invoices gains pay_url (a Stripe Payment Link or similar) so its
-- emails and reminders carry a way to pay.
alter table client_invoices add column if not exists reminder_stage int not null default 0;
alter table biz_invoices add column if not exists reminder_stage int not null default 0;
alter table biz_invoices add column if not exists pay_url text;
