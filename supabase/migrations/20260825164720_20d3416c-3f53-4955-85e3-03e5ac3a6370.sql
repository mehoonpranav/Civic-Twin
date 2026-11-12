alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists points integer not null default 0;

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
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'city', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'citizen');
  return new;
end;
$$;

create or replace function public.award_report_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_id is not null then
    update public.profiles
    set points = points + 10 + round(new.impact_score / 10.0)::int
    where id = new.author_id;
  end if;
  return new;
end;
$$;

create trigger on_report_published
  after insert on public.reports
  for each row execute function public.award_report_points();

revoke execute on function public.award_report_points() from public, anon, authenticated;

update public.profiles p
set points = coalesce((
  select sum(10 + round(r.impact_score / 10.0)::int)
  from public.reports r
  where r.author_id = p.id
), 0);