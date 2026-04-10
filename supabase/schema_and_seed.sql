-- UPSA Connect academic schema + seed data
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  code text not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (academic_year_id, code)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  department text not null,
  level int not null,
  credits int not null default 3,
  lecturer_name text,
  color_hex text,
  created_at timestamptz not null default now()
);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  venue text not null,
  campus text,
  is_online boolean not null default false,
  meeting_link text,
  class_type text not null default 'Lecture',
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.course_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  title text not null,
  assessment_type text not null,
  due_date date not null,
  weight_percent numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.course_announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  title text not null,
  body text not null,
  priority text not null default 'normal',
  posted_at timestamptz not null default now()
);

alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.class_sessions enable row level security;
alter table public.course_assessments enable row level security;
alter table public.course_announcements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'academic_years' and policyname = 'read academic_years'
  ) then
    create policy "read academic_years" on public.academic_years
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'semesters' and policyname = 'read semesters'
  ) then
    create policy "read semesters" on public.semesters
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'courses' and policyname = 'read courses'
  ) then
    create policy "read courses" on public.courses
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'class_sessions' and policyname = 'read class_sessions'
  ) then
    create policy "read class_sessions" on public.class_sessions
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'course_assessments' and policyname = 'read course_assessments'
  ) then
    create policy "read course_assessments" on public.course_assessments
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'course_announcements' and policyname = 'read course_announcements'
  ) then
    create policy "read course_announcements" on public.course_announcements
      for select to anon, authenticated
      using (true);
  end if;
end $$;

insert into public.academic_years (label, start_date, end_date, is_current)
values ('2025/2026', '2025-08-01', '2026-07-31', true)
on conflict (label)
do update set
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_current = excluded.is_current;

update public.academic_years
set is_current = case when label = '2025/2026' then true else false end;

insert into public.semesters (academic_year_id, code, name, start_date, end_date, is_current)
select ay.id, 'SEM1', 'First Semester', '2025-08-15', '2025-12-20', false
from public.academic_years ay
where ay.label = '2025/2026'
on conflict (academic_year_id, code)
do update set
  name = excluded.name,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_current = excluded.is_current;

insert into public.semesters (academic_year_id, code, name, start_date, end_date, is_current)
select ay.id, 'SEM2', 'Second Semester', '2026-01-20', '2026-05-30', true
from public.academic_years ay
where ay.label = '2025/2026'
on conflict (academic_year_id, code)
do update set
  name = excluded.name,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_current = excluded.is_current;

update public.semesters
set is_current = (code = 'SEM2')
where academic_year_id = (select id from public.academic_years where label = '2025/2026');

insert into public.courses (code, title, department, level, credits, lecturer_name, color_hex)
values
  ('MKT301', 'Principles of Marketing', 'Marketing', 300, 3, 'Dr. A. Mensah', '#1D4ED8'),
  ('ACC204', 'Financial Accounting', 'Accounting', 200, 3, 'Mrs. Y. Boateng', '#0EA5E9'),
  ('IT220', 'Data Communications', 'Information Systems', 200, 3, 'Mr. K. Ofori', '#10B981'),
  ('ECO315', 'Managerial Economics', 'Economics', 300, 3, 'Dr. N. Quartey', '#F59E0B'),
  ('LAW210', 'Business Law', 'Law', 200, 2, 'Ms. P. Adjei', '#8B5CF6')
on conflict (code)
do update set
  title = excluded.title,
  department = excluded.department,
  level = excluded.level,
  credits = excluded.credits,
  lecturer_name = excluded.lecturer_name,
  color_hex = excluded.color_hex;

with sem as (
  select s.id as semester_id
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where ay.label = '2025/2026' and s.code = 'SEM2'
),
sessions as (
  select c.id as course_id, sem.semester_id, x.day_of_week, x.start_time, x.end_time, x.venue, x.campus, x.is_online, x.class_type
  from sem
  join public.courses c on c.code in ('MKT301', 'ACC204', 'IT220', 'ECO315', 'LAW210')
  join (
    values
      ('MKT301', 1, '10:00'::time, '12:00'::time, 'Management Block', 'Main Campus', false, 'Lecture'),
      ('ACC204', 2, '08:00'::time, '10:00'::time, 'LBC 302', 'Main Campus', false, 'Lecture'),
      ('IT220', 3, '14:00'::time, '16:00'::time, 'ICT Lab 2', 'Main Campus', false, 'Lab'),
      ('ECO315', 4, '11:00'::time, '13:00'::time, 'Lecture Hall C', 'Main Campus', false, 'Lecture'),
      ('LAW210', 5, '09:00'::time, '11:00'::time, 'Law Block 1', 'Main Campus', false, 'Seminar'),
      ('MKT301', 5, '13:30'::time, '15:00'::time, 'Virtual', 'Online', true, 'Tutorial')
  ) as x(code, day_of_week, start_time, end_time, venue, campus, is_online, class_type)
    on c.code = x.code
)
insert into public.class_sessions (course_id, semester_id, day_of_week, start_time, end_time, venue, campus, is_online, class_type)
select course_id, semester_id, day_of_week, start_time, end_time, venue, campus, is_online, class_type
from sessions
where not exists (
  select 1
  from public.class_sessions cs
  where cs.course_id = sessions.course_id
    and cs.semester_id = sessions.semester_id
    and cs.day_of_week = sessions.day_of_week
    and cs.start_time = sessions.start_time
    and cs.end_time = sessions.end_time
    and cs.venue = sessions.venue
);

with sem as (
  select s.id as semester_id
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where ay.label = '2025/2026' and s.code = 'SEM2'
)
insert into public.course_assessments (course_id, semester_id, title, assessment_type, due_date, weight_percent)
select c.id, sem.semester_id, x.title, x.assessment_type, x.due_date, x.weight_percent
from sem
join (
  values
    ('MKT301', 'Group Campaign Plan', 'Coursework', '2026-04-18'::date, 20.00),
    ('IT220', 'Network Lab Practical', 'Practical', '2026-04-24'::date, 15.00),
    ('ACC204', 'Mid-Sem Quiz', 'Quiz', '2026-04-15'::date, 10.00)
) as x(code, title, assessment_type, due_date, weight_percent) on true
join public.courses c on c.code = x.code
where not exists (
  select 1
  from public.course_assessments ca
  where ca.course_id = c.id
    and ca.semester_id = sem.semester_id
    and ca.title = x.title
);

with sem as (
  select s.id as semester_id
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where ay.label = '2025/2026' and s.code = 'SEM2'
)
insert into public.course_announcements (course_id, semester_id, title, body, priority)
select c.id, sem.semester_id, x.title, x.body, x.priority
from sem
join (
  values
    ('MKT301', 'Guest Lecture', 'Industry guest lecture this Friday at 10:00 in Management Block.', 'high'),
    ('IT220', 'Lab Router Update', 'Bring your laptop chargers for the updated lab practical.', 'normal'),
    ('LAW210', 'Case Brief Submission', 'Upload your case brief to LMS before Sunday 23:59.', 'high')
) as x(code, title, body, priority) on true
join public.courses c on c.code = x.code
where not exists (
  select 1
  from public.course_announcements an
  where an.course_id = c.id
    and an.semester_id = sem.semester_id
    and an.title = x.title
);

create or replace view public.v_class_schedule as
select
  cs.id,
  cs.day_of_week,
  to_char(cs.start_time, 'HH24:MI') as start_time,
  to_char(cs.end_time, 'HH24:MI') as end_time,
  cs.venue,
  cs.campus,
  cs.is_online,
  cs.class_type,
  c.id as course_id,
  c.code as course_code,
  c.title as course_title,
  c.department,
  c.level,
  c.credits,
  c.lecturer_name,
  c.color_hex,
  s.id as semester_id,
  s.code as semester_code,
  s.name as semester_name,
  s.is_current as semester_is_current,
  ay.label as academic_year_label,
  ay.is_current as academic_year_is_current
from public.class_sessions cs
join public.courses c on c.id = cs.course_id
join public.semesters s on s.id = cs.semester_id
join public.academic_years ay on ay.id = s.academic_year_id;

create or replace view public.v_home_course_cards as
select
  c.id as course_id,
  c.code as course_code,
  c.title as course_title,
  c.department,
  c.level,
  c.credits,
  c.lecturer_name,
  c.color_hex,
  s.name as semester_name,
  ay.label as academic_year_label,
  count(cs.id)::int as sessions_per_week,
  min(to_char(cs.start_time, 'HH24:MI')) as first_class_time,
  max(to_char(cs.end_time, 'HH24:MI')) as last_class_time
from public.class_sessions cs
join public.courses c on c.id = cs.course_id
join public.semesters s on s.id = cs.semester_id
join public.academic_years ay on ay.id = s.academic_year_id
where s.is_current = true and ay.is_current = true
group by
  c.id, c.code, c.title, c.department, c.level, c.credits, c.lecturer_name, c.color_hex,
  s.name, ay.label
order by c.code;
