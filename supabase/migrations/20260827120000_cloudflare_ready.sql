-- Make profile creation work for Google OAuth (name) as well as email signup (full_name).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, city)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data->>'city', '')
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'citizen')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Public bucket for report photos (used only if Cloudflare Images is not configured).
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do update set public = true;
