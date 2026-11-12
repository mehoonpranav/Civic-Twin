alter table public.profiles add column if not exists avatar_url text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, city, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data->>'city', ''),
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

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar photos are publicly viewable" on storage.objects;
create policy "Avatar photos are publicly viewable"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users can upload their avatar" on storage.objects;
create policy "Users can upload their avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "Users can update their avatar" on storage.objects;
create policy "Users can update their avatar"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
