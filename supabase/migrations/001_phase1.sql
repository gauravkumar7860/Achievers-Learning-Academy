-- ACHIEVERS LEARNING ACADEMY — PHASE 1 SCHEMA
-- Run in Supabase SQL Editor. Phase 2 adds 002_phase2.sql; nothing here needs to change.
create sequence if not exists student_seq start 1;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','student')),
  full_name text not null, email text, phone text, created_at timestamptz default now()
);
create table academic_sessions (id uuid primary key default gen_random_uuid(), name text unique not null, is_current boolean default false);
create table classes (id uuid primary key default gen_random_uuid(), name text unique not null, sort_order int default 0);
create table subjects (id uuid primary key default gen_random_uuid(), class_id uuid references classes(id) on delete cascade, name text not null);
create table chapters (id uuid primary key default gen_random_uuid(), subject_id uuid references subjects(id) on delete cascade, name text not null);
create table students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references profiles(id) on delete cascade,
  student_code text unique not null default ('ALA-' || to_char(now(),'YY') || '-' || lpad(nextval('student_seq')::text,4,'0')),
  class_id uuid references classes(id), session_id uuid references academic_sessions(id),
  guardian_name text, guardian_phone text, address text,
  admission_date date default current_date,
  status text not null default 'active' check (status in ('active','inactive','on_leave')),
  created_at timestamptz default now()
);
create table study_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade, subject_id uuid references subjects(id) on delete set null,
  chapter_id uuid references chapters(id) on delete set null,
  title text not null, description text, file_path text, published boolean default false, created_at timestamptz default now()
);
create table announcements (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null,
  category text default 'General', published boolean default true, created_at timestamptz default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references profiles(id) on delete cascade,
  title text not null, body text, link text, is_read boolean default false, created_at timestamptz default now()
);
create table admission_enquiries (
  id uuid primary key default gen_random_uuid(), student_name text not null, guardian_name text not null,
  phone text not null, class_applying text not null, previous_school text, address text, notes text,
  status text default 'new' check (status in ('new','contacted','admitted','closed')), created_at timestamptz default now()
);
create table audit_logs (id bigserial primary key, actor_id uuid default auth.uid(), action text not null, details jsonb, created_at timestamptz default now());

create or replace function is_admin() returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- Automatic in-app notifications
create or replace function notify_announcement() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.published and (tg_op='INSERT' or not old.published) then
    insert into notifications(profile_id,title,body,link)
    select s.profile_id,'New announcement: '||new.title,left(new.body,140),'/student/announcements' from students s where s.status<>'inactive';
  end if; return new;
end $$;
create trigger trg_announcement after insert or update on announcements for each row execute function notify_announcement();

create or replace function notify_note() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.published and (tg_op='INSERT' or not old.published) then
    insert into notifications(profile_id,title,body,link)
    select s.profile_id,'New study material: '||new.title,new.description,'/student/materials' from students s where s.class_id=new.class_id and s.status<>'inactive';
  end if; return new;
end $$;
create trigger trg_note after insert or update on study_notes for each row execute function notify_note();

-- Row Level Security
alter table profiles enable row level security; alter table students enable row level security;
alter table classes enable row level security; alter table subjects enable row level security;
alter table chapters enable row level security; alter table academic_sessions enable row level security;
alter table study_notes enable row level security; alter table announcements enable row level security;
alter table notifications enable row level security; alter table admission_enquiries enable row level security;
alter table audit_logs enable row level security;

create policy p_sel on profiles for select using (id = auth.uid() or is_admin());
create policy p_upd on profiles for update using (id = auth.uid() or is_admin());
revoke update on profiles from authenticated, anon;
grant update (full_name, phone) on profiles to authenticated;
create policy p_admin_ins on profiles for insert with check (is_admin());

create policy s_sel on students for select using (profile_id = auth.uid() or is_admin());
create policy s_admin on students for all using (is_admin()) with check (is_admin());

create policy c_sel on classes for select to authenticated using (true);
create policy c_admin on classes for all using (is_admin()) with check (is_admin());
create policy sub_sel on subjects for select to authenticated using (true);
create policy sub_admin on subjects for all using (is_admin()) with check (is_admin());
create policy ch_sel on chapters for select to authenticated using (true);
create policy ch_admin on chapters for all using (is_admin()) with check (is_admin());
create policy ses_sel on academic_sessions for select to authenticated using (true);
create policy ses_admin on academic_sessions for all using (is_admin()) with check (is_admin());

create policy n_admin on study_notes for all using (is_admin()) with check (is_admin());
create policy n_student on study_notes for select using (published and exists(select 1 from students s where s.profile_id=auth.uid() and s.class_id=study_notes.class_id));

create policy a_pub on announcements for select to anon, authenticated using (published);
create policy a_admin on announcements for all using (is_admin()) with check (is_admin());

create policy nt_sel on notifications for select using (profile_id = auth.uid());
create policy nt_upd on notifications for update using (profile_id = auth.uid());
revoke update on notifications from authenticated, anon;
grant update (is_read) on notifications to authenticated;
create policy nt_admin on notifications for insert with check (is_admin());

create policy e_ins on admission_enquiries for insert to anon, authenticated with check (true);
create policy e_admin on admission_enquiries for all using (is_admin()) with check (is_admin());
create policy al_admin on audit_logs for all using (is_admin()) with check (is_admin());

alter publication supabase_realtime add table notifications;

-- Storage (private bucket for PDF notes)
insert into storage.buckets (id,name,public) values ('study-notes','study-notes',false) on conflict do nothing;
create policy so_read on storage.objects for select to authenticated using (bucket_id='study-notes');
create policy so_admin on storage.objects for all using (bucket_id='study-notes' and is_admin()) with check (bucket_id='study-notes' and is_admin());

-- Starter data (editable by admin in the dashboard)
insert into academic_sessions(name,is_current) values ('2026-27',true);
insert into classes(name,sort_order) values ('Kindergarten',0),('Classes 1–5',1),('Classes 6–8',2),('Classes 9–10',3),('Class 12 – Arts',4);
insert into subjects(class_id,name) select id,s from classes, unnest(array['English','History','Political Science','Economics']) s where name='Class 12 – Arts';
