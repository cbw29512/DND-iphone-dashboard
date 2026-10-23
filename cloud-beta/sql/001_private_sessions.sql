-- Iron Lantern private beta foundation; apply only to a NEW dedicated Supabase project.
-- Explicit owner checks and separate public frames prevent monster AC/HP disclosure.
create extension if not exists pgcrypto;
create table if not exists public.il_sessions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(name) between 1 and 80),
 private_state jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.il_display_access (
 session_id uuid not null references public.il_sessions(id) on delete cascade,
 display_user_id uuid not null references auth.users(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(session_id,display_user_id)
);
create table if not exists public.il_display_frames (
 session_id uuid primary key references public.il_sessions(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null default 1 check (revision > 0),
 public_state jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.il_sessions enable row level security;
alter table public.il_display_access enable row level security;
alter table public.il_display_frames enable row level security;
revoke all on public.il_sessions, public.il_display_access, public.il_display_frames from anon;
grant select,insert,update,delete on public.il_sessions to authenticated;
grant select,insert,delete on public.il_display_access to authenticated;
grant select,insert,update,delete on public.il_display_frames to authenticated;

create policy "dm reads own sessions" on public.il_sessions for select to authenticated
 using (owner_id = (select auth.uid()));
create policy "dm creates own sessions" on public.il_sessions for insert to authenticated
 with check (owner_id = (select auth.uid()));
create policy "dm updates own sessions" on public.il_sessions for update to authenticated
 using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "dm deletes own sessions" on public.il_sessions for delete to authenticated
 using (owner_id = (select auth.uid()));

create policy "access readable to DM or invited phone" on public.il_display_access for select to authenticated
 using (owner_id = (select auth.uid()) or display_user_id = (select auth.uid()));
create policy "dm grants display access" on public.il_display_access for insert to authenticated
 with check (owner_id = (select auth.uid()) and exists (
 select 1 from public.il_sessions s where s.id=session_id and s.owner_id=(select auth.uid())));
create policy "dm revokes display access" on public.il_display_access for delete to authenticated
 using (owner_id = (select auth.uid()));

create policy "only dm publishes public frames" on public.il_display_frames for insert to authenticated
 with check (owner_id = (select auth.uid()) and exists (
 select 1 from public.il_sessions s where s.id=session_id and s.owner_id=(select auth.uid())));
create policy "only dm updates public frames" on public.il_display_frames for update to authenticated
 using (owner_id = (select auth.uid()))
 with check (owner_id = (select auth.uid()));
create policy "dm or authorized phone reads public frames" on public.il_display_frames for select to authenticated
 using (owner_id = (select auth.uid()) or exists (
 select 1 from public.il_display_access a
 where a.session_id=il_display_frames.session_id and a.display_user_id=(select auth.uid())));
create policy "only dm deletes public frames" on public.il_display_frames for delete to authenticated
 using (owner_id = (select auth.uid()));

-- Security guard: display can NEVER query il_sessions, even if it has a display grant.
-- Do not replicate private_state in il_display_frames. Server-side RPC is required
-- before trusting combat outcome calculations from untrusted browsers.
