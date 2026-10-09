-- Addendum 2 §4: new default caps. Only touches a row still on the old defaults.
update system_controls
set monthly_caps = '{"ecommerce":50,"marketing":50,"visual":15,"research":15,"xai":5,"twilio":10}'::jsonb
where monthly_caps = '{"marketing":100,"visual":60,"research":40}'::jsonb;
