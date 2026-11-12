alter table public.reports add column if not exists moderation text not null default 'pending';
alter table public.issues add column if not exists city text;
alter table public.issues add column if not exists state text;

update public.reports set moderation = 'approved' where moderation is null or moderation = 'pending';

drop trigger if exists on_report_published on public.reports;

create or replace function public.award_report_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.moderation = 'approved'
     and (tg_op = 'INSERT' or old.moderation is distinct from 'approved')
     and new.author_id is not null then
    update public.profiles
    set points = points + 10 + round(new.impact_score / 10.0)::int
    where id = new.author_id;
  end if;
  return new;
end;
$$;

create trigger on_report_approved
  after insert or update of moderation on public.reports
  for each row execute function public.award_report_points();
