-- StudyTrack Supabase schema
-- Run this in Supabase Dashboard -> SQL Editor.
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

create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own courses" on public.courses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage lessons in own courses" on public.lessons for all using (
  exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
);
create policy "Users manage own daily goals" on public.daily_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own study sessions" on public.study_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email));
  insert into public.daily_goals (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
