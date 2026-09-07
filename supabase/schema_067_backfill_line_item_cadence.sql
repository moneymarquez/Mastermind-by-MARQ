-- Mastermind by MARQ — Phase 67 data fix (backfill cadence/ongoing_amount
-- onto draft invoices created before the Recurring Plan feature existed).
-- Run once. Safe to re-run — it only ever touches a line item that's
-- still missing the `cadence` key at all, so an already-migrated (or
-- newly-created, which always has it) row is left untouched.
--
-- schema_066 added cadence/ongoing_amount to InvoiceLineItem, but only
-- new bundled invoices ever got it snapshotted on creation — a draft
-- created before that shipped has line_items with no such keys at all,
-- so hasRecurring reads false and the Recurring Plan tab never appears
-- even when the underlying pricing items really are monthly. This
-- backfills from the CURRENT client_pricing_items row per pricing_item_id
-- (the best available stand-in for what the snapshot would have been),
-- defaulting to one_time/null when no matching pricing item is found.
update client_invoices ci
set line_items = sub.new_items
from (
  select ci2.id,
    jsonb_agg(
      t.li || jsonb_build_object(
        'cadence', coalesce(t.li->>'cadence', pi.cadence, 'one_time'),
        'ongoing_amount', case when pi.cadence = 'monthly' then pi.amount else null::numeric end
      )
      order by t.ord
    ) as new_items
  from client_invoices ci2
  cross join lateral jsonb_array_elements(ci2.line_items) with ordinality as t(li, ord)
  left join client_pricing_items pi on pi.id = (t.li->>'pricing_item_id')::uuid
  where ci2.status = 'draft'
    and ci2.line_items is not null
    and jsonb_array_length(ci2.line_items) > 0
  group by ci2.id
) sub
where ci.id = sub.id
  and exists (
    select 1 from jsonb_array_elements(ci.line_items) li2
    where not (li2 ? 'cadence')
  );
