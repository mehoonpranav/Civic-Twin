create type public.app_role as enum ('officer', 'citizen', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can read their own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role) values (new.id, 'citizen');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('pothole','waterlogging','garbage','streetlight','road_damage','drainage','other')),
  severity text not null check (severity in ('low','moderate','high','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','in_progress','resolved')),
  summary text,
  location_name text not null,
  lat double precision not null,
  lng double precision not null,
  impact_score int not null default 0,
  report_count int not null default 1,
  is_recurring boolean not null default false,
  resolved_photo_url text,
  resolution_note text,
  ai_verdict text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.issues to anon;
grant select, insert, update, delete on public.issues to authenticated;
grant all on public.issues to service_role;
alter table public.issues enable row level security;
create policy "Issues are viewable by everyone" on public.issues for select using (true);
create policy "Officers can create issues" on public.issues for insert to authenticated with check (public.has_role(auth.uid(), 'officer') or public.has_role(auth.uid(), 'admin'));
create policy "Officers can update issues" on public.issues for update to authenticated using (public.has_role(auth.uid(), 'officer') or public.has_role(auth.uid(), 'admin'));
create policy "Officers can delete issues" on public.issues for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  photo_url text not null,
  category text not null check (category in ('pothole','waterlogging','garbage','streetlight','road_damage','drainage','other')),
  severity text not null check (severity in ('low','moderate','high','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','in_progress','resolved')),
  description text,
  location_name text not null,
  lat double precision not null,
  lng double precision not null,
  impact_score int not null default 0,
  confirmations int not null default 0,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.reports to anon;
grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "Reports are viewable by everyone" on public.reports for select using (true);
create policy "Signed-in users can file reports" on public.reports for insert to authenticated with check (auth.uid() = author_id);
create policy "Authors can edit own reports" on public.reports for update to authenticated using (auth.uid() = author_id);
create policy "Officers can update any report" on public.reports for update to authenticated using (public.has_role(auth.uid(), 'officer') or public.has_role(auth.uid(), 'admin'));

create table public.report_votes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  unique (report_id, voter_key)
);
grant select, insert on public.report_votes to anon;
grant select, insert on public.report_votes to authenticated;
grant all on public.report_votes to service_role;
alter table public.report_votes enable row level security;
create policy "Votes are viewable by everyone" on public.report_votes for select using (true);
create policy "Anyone can confirm a report once" on public.report_votes for insert with check (true);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger touch_issues before update on public.issues for each row execute function public.touch_updated_at();
create trigger touch_reports before update on public.reports for each row execute function public.touch_updated_at();

create or replace function public.bump_report_confirmations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports set confirmations = confirmations + 1 where id = new.report_id;
  return new;
end;
$$;
create trigger on_vote_added after insert on public.report_votes for each row execute function public.bump_report_confirmations();

-- Seed: clustered issues around Kolkata
insert into public.issues (id, title, category, severity, status, summary, location_name, lat, lng, impact_score, report_count, is_recurring, created_at) values
('a0000000-0000-4000-8000-000000000001','Deep pothole cluster on Park Street','pothole','critical','open','Three merged reports of a deep, water-filled pothole cluster near the Park Street crossing. Two-wheelers swerving dangerously at night; monsoon water hides the depth.','Park Street, Kolkata',22.5532,88.3516,92,3,true, now() - interval '9 days'),
('a0000000-0000-4000-8000-000000000002','Monsoon waterlogging at Sector V underpass','waterlogging','high','in_progress','Recurring knee-deep waterlogging inside the underpass after every heavy shower. Pumping scheduled; drainage capacity under review.','Sector V Underpass, Salt Lake',22.5798,88.4337,84,2,true, now() - interval '6 days'),
('a0000000-0000-4000-8000-000000000003','Overflowing waste bins near Gariahat Market','garbage','high','acknowledged','Market waste overflowing onto the footpath every evening. Ward sanitation team notified; pickup frequency increase requested.','Gariahat Market, Kolkata',22.5204,88.3667,71,2,false, now() - interval '4 days'),
('a0000000-0000-4000-8000-000000000004','Tilted streetlight pole on EM Bypass','streetlight','moderate','open','Streetlight pole leaning over the carriageway with exposed wiring at the base. Night-time visibility hazard on a high-speed corridor.','EM Bypass, Kolkata',22.5129,88.3971,48,1,false, now() - interval '3 days'),
('a0000000-0000-4000-8000-000000000005','Cracked carriageway on AJC Bose Road','road_damage','high','open','Longitudinal cracks and crumbling concrete across two lanes; loose aggregate is a skid risk for two-wheelers.','AJC Bose Road, Kolkata',22.5448,88.3510,66,1,false, now() - interval '2 days'),
('a0000000-0000-4000-8000-000000000006','Blocked storm drain at Behala Chowrasta','drainage','moderate','resolved','Drain choked with plastic and silt cleared by ward crew. Desilting added to the pre-monsoon schedule to prevent recurrence.','Behala Chowrasta, Kolkata',22.4986,88.3108,55,1,true, now() - interval '12 days');

insert into public.reports (id, issue_id, photo_url, category, severity, status, description, location_name, lat, lng, impact_score, confirmations, ai_summary, created_at) values
('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','/images/reports/pothole.jpg','pothole','critical','open','A crater-sized pothole right at the crossing, half-hidden by rainwater. My scooter nearly went in last night.','Park Street crossing, Kolkata',22.5532,88.3516,92,47,'Deep water-filled pothole on a busy arterial crossing; high two-wheeler accident risk, worsened by monsoon.', now() - interval '9 days'),
('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','/images/reports/road-crack.jpg','pothole','high','open','The road edge is collapsing around the same spot. The cracks spread every week.','Park Street, Kolkata',22.5534,88.3512,78,21,'Surface collapse spreading around the primary pothole; structural repair advised, not patching.', now() - interval '7 days'),
('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','/images/reports/pothole.jpg','pothole','critical','open','Third complaint this month for the same crater. Nothing has been done.','Park Street, Kolkata',22.5531,88.3518,88,33,'Repeat report for identical location; recurrence flag raised. Priority escalation recommended.', now() - interval '2 days'),
('b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000002','/images/reports/waterlogging.jpg','waterlogging','high','in_progress','Knee-deep water inside the underpass after last night’s rain. Autos refusing to enter.','Sector V Underpass, Salt Lake',22.5798,88.4337,84,38,'Severe waterlogging blocking a commuter underpass; drainage pump deployment in progress.', now() - interval '6 days'),
('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000002','/images/reports/waterlogging.jpg','waterlogging','high','in_progress','Same underpass flooded again. This happens with every heavy shower.','Sector V Underpass, Salt Lake',22.5800,88.4335,80,17,'Recurring flood point confirmed by second report; permanent drainage capacity fix required.', now() - interval '1 day'),
('b0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000003','/images/reports/garbage.jpg','garbage','high','acknowledged','The market bins have been overflowing onto the footpath for three days. Stray animals scattering waste onto the road.','Gariahat Market, Kolkata',22.5204,88.3667,71,29,'Overflowing municipal bins spilling onto pedestrian path; sanitation pickup escalation needed.', now() - interval '4 days'),
('b0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000004','/images/reports/streetlight.jpg','streetlight','moderate','open','This pole has been leaning since the storm. The lamp flickers and the base wires are exposed.','EM Bypass, near Science City',22.5129,88.3971,48,12,'Tilted pole with exposed wiring on a high-speed corridor; electrical isolation advised.', now() - interval '3 days'),
('b0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000005','/images/reports/road-crack.jpg','road_damage','high','open','Huge cracks across two lanes, loose gravel everywhere. Two bikers skidded this morning.','AJC Bose Road, Kolkata',22.5448,88.3510,66,24,'Carriageway cracking with loose aggregate; skid hazard for two-wheelers, resurfacing required.', now() - interval '2 days'),
('b0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000006','/images/reports/drain.jpg','drainage','moderate','resolved','Storm drain completely choked with plastic and silt. Water pools here every rain.','Behala Chowrasta, Kolkata',22.4986,88.3108,55,19,'Drain blockage by plastic debris and silt; cleared by ward crew, desilting scheduled.', now() - interval '12 days');revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.bump_report_confirmations() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, app_role) from public, anon;

create policy "Report photos are publicly viewable" on storage.objects for select using (bucket_id = 'report-photos');
create policy "Signed-in users can upload report photos" on storage.objects for insert to authenticated with check (bucket_id = 'report-photos');
create policy "Officers can update report photos" on storage.objects for update to authenticated using (bucket_id = 'report-photos' and (public.has_role(auth.uid(), 'officer') or public.has_role(auth.uid(), 'admin')));-- Citizens can create an Issue cluster when their report is the first of its kind nearby
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
for each row execute function public.sync_issue_from_report();alter table public.profiles add column if not exists city text;
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
), 0);revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.award_report_points() from public, anon, authenticated;-- Make profile creation work for Google OAuth (name) as well as email signup (full_name).
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
