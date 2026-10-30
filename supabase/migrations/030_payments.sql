-- In-app payments between members (Stripe Connect, destination charges).
-- A seller links a Stripe Express account once (payout_accounts), then sends a
-- payment request in a chat (payment_requests). The buyer pays on Stripe
-- Checkout; Stripe sends the money to the seller minus Apparently's 10% fee.
-- Only the `payments` edge function (service role) marks requests paid and
-- writes payout accounts.

create table if not exists public.payout_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
drop policy if exists "payout_accounts owner read" on public.payout_accounts;
create policy "payout_accounts owner read" on public.payout_accounts
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.payout_accounts from anon;
revoke insert, update, delete on public.payout_accounts from authenticated;
grant select on public.payout_accounts to authenticated;

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid,
  item_id text,
  item_type text,
  title text not null check (char_length(title) between 1 and 120),
  amount_cents integer not null check (amount_cents between 100 and 2000000),
  fee_cents integer not null default 0,
  status text not null default 'requested' check (status in ('requested', 'paid', 'canceled')),
  checkout_session_id text,
  payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint payment_requests_not_self check (seller_id <> buyer_id)
);
create index if not exists payment_requests_buyer_idx on public.payment_requests (buyer_id, created_at desc);
create index if not exists payment_requests_seller_idx on public.payment_requests (seller_id, created_at desc);
alter table public.payment_requests enable row level security;

drop policy if exists "payment_requests parties read" on public.payment_requests;
create policy "payment_requests parties read" on public.payment_requests
  for select to authenticated
  using (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()));

-- The seller creates a request (never pre-paid, never with Stripe ids).
drop policy if exists "payment_requests seller create" on public.payment_requests;
create policy "payment_requests seller create" on public.payment_requests
  for insert to authenticated
  with check (seller_id = (select auth.uid()) and status = 'requested'
              and checkout_session_id is null and payment_intent_id is null and paid_at is null);

-- The seller can cancel an unpaid request; nothing else changes from the app.
drop policy if exists "payment_requests seller cancel" on public.payment_requests;
create policy "payment_requests seller cancel" on public.payment_requests
  for update to authenticated
  using (seller_id = (select auth.uid()) and status = 'requested')
  with check (seller_id = (select auth.uid()) and status = 'canceled');

revoke all on public.payment_requests from anon;
grant select, insert, update on public.payment_requests to authenticated;
