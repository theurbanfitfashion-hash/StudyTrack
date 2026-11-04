-- StudyTrack Supabase schema. Each user owns their records.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  playlist_id text not null,
  thumbnail text,
  added_at timestamptz not null default now(),
  unique (user_id, playlist_id)
);
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  video_id text not null,
  title text not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  position integer not null,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (course_id, video_id)
);
create table if not exists public.daily_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_hours numeric(4,1) not null default 2 check (goal_hours > 0 and goal_hours <= 24),
  goal_videos integer not null default 5 check (goal_videos > 0 and goal_videos <= 500),
  updated_at timestamptz not null default now()
);
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  studied_minutes integer not null check (studied_minutes > 0 and studied_minutes <= 600),
  studied_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists courses_user_id_idx on public.courses(user_id);
create index if not exists lessons_course_id_idx on public.lessons(course_id);
create index if not exists study_sessions_user_day_idx on public.study_sessions(user_id, studied_on);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.daily_goals enable row level security;
alter table public.study_sessions enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
drop policy if exists "Users manage own courses" on public.courses;
drop policy if exists "Users manage lessons in own courses" on public.lessons;
drop policy if exists "Users manage own daily goals" on public.daily_goals;
drop policy if exists "Users manage own study sessions" on public.study_sessions;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "courses_select_own" on public.courses for select to authenticated using ((select auth.uid()) = user_id);
create policy "courses_insert_own" on public.courses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "courses_update_own" on public.courses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "courses_delete_own" on public.courses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "lessons_select_own" on public.lessons for select to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));
create policy "lessons_insert_own" on public.lessons for insert to authenticated with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));
create policy "lessons_update_own" on public.lessons for update to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid()))) with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));
create policy "lessons_delete_own" on public.lessons for delete to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));

create policy "daily_goals_select_own" on public.daily_goals for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_goals_insert_own" on public.daily_goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_goals_update_own" on public.daily_goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "study_sessions_select_own" on public.study_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "study_sessions_insert_own" on public.study_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "study_sessions_update_own" on public.study_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "study_sessions_delete_own" on public.study_sessions for delete to authenticated using ((select auth.uid()) = user_id);

-- The Data API is available to authenticated users only. RLS provides row-level ownership.
revoke all on table public.profiles, public.courses, public.lessons, public.daily_goals, public.study_sessions from anon;
grant select, insert, update, delete on table public.profiles, public.courses, public.lessons, public.daily_goals, public.study_sessions to authenticated;
