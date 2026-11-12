-- Citizens can create an Issue cluster when their report is the first of its kind nearby
create policy "Citizens can open issues"
on public.issues for insert
to authenticated
with check (true);

-- Keep issue rollups in sync when reports are linked to an issue
create or replace function public.sync_issue_from_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.issue_id is not null then
    update public.issues i
    set
      report_count = (select count(*) from public.reports r where r.issue_id = NEW.issue_id),
      impact_score = greatest(i.impact_score, NEW.impact_score),
      is_recurring = ((select count(*) from public.reports r where r.issue_id = NEW.issue_id) >= 3),
      updated_at = now()
    where i.id = NEW.issue_id;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.sync_issue_from_report() from public, anon, authenticated;

create trigger trg_sync_issue_from_report
after insert on public.reports
for each row execute function public.sync_issue_from_report();