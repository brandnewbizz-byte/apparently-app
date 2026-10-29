-- Username sign-in now goes through the `username-login` edge function, which
-- looks up the email with the service role. The old RPC handed any caller the
-- email behind any username, so nobody but the server may call it now.
revoke execute on function public.resolve_login_email(text) from public, anon, authenticated;

-- Remove the throwaway account used to test sign-up end to end.
delete from auth.users where email like 'qa.apparently.%@example.com';

-- Listings: fields the redesigned bundle / skill-deal builders save.
alter table public.skill_deals add column if not exists original_price numeric;   -- regular price shown crossed out
alter table public.skill_deals add column if not exists expires_at timestamptz;   -- deal end; null = no end
alter table public.skill_deals add column if not exists icon text;
alter table public.skill_deals add column if not exists tags text[];
alter table public.bundles add column if not exists tags text[];
alter table public.bundles add column if not exists date_range text;            -- e.g. "Weekends", "Nov 1-3"
