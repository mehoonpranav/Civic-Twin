alter table public.profiles add column if not exists state text;
alter table public.reports add column if not exists city text;
alter table public.reports add column if not exists state text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, city, state, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data->>'city', ''),
    nullif(new.raw_user_meta_data->>'state', ''),
    nullif(
      coalesce(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'picture'
      ),
      ''
    )
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'citizen')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
