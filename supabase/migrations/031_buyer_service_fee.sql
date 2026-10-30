-- Buyer service fee charged on top of the seller's price at checkout (kept by Apparently).
alter table public.payment_requests add column if not exists service_fee_cents integer not null default 0;
