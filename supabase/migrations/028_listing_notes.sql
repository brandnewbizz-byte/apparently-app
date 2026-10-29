-- Private "Notes for yourself" on bundles / skill deals. Listings are public rows,
-- so the notes live in their own table that only the owner can read or write.
create table if not exists public.listing_notes (
  listing_id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'bundle' check (kind in ('bundle', 'skill_deal')),
  notes text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.listing_notes enable row level security;
drop policy if exists "listing_notes owner" on public.listing_notes;
create policy "listing_notes owner" on public.listing_notes for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke all on public.listing_notes from anon;
grant select, insert, update, delete on public.listing_notes to authenticated;
