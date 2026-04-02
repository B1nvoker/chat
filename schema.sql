create extension if not exists "uuid-ossp";

-- =========================
-- USERS (end users from channels)
-- =========================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  channel text not null check (channel in ('web', 'telegram', 'viber')),
  role text not null default 'user' check (role in ('user', 'operator', 'admin')),
  external_id text,
  name text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create unique index if not exists users_channel_external_id_uidx
  on public.users(channel, external_id)
  where external_id is not null;

-- =========================
-- CONVERSATIONS
-- =========================
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  assigned_operator uuid references auth.users(id) on delete set null,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_status_idx on public.conversations(status);
create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);
create index if not exists conversations_assigned_operator_idx on public.conversations(assigned_operator);

-- =========================
-- MESSAGES (single inbox)
-- =========================
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  sender text not null check (sender in ('user', 'operator', 'bot')),
  text text not null,
  channel text not null check (channel in ('web', 'telegram', 'viber')),
  file_url text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages(conversation_id, created_at desc);
create index if not exists messages_text_search_idx
  on public.messages using gin (to_tsvector('simple', text));

-- =========================
-- OPERATOR UX TABLES
-- =========================
create table if not exists public.quick_replies (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.typing_events (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  actor text not null check (actor in ('user', 'operator')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.operator_presence (
  operator_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  updated_at timestamptz not null default now()
);

-- =========================
-- TRIGGERS
-- =========================
create or replace function public.sync_conversation_last_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set
    last_message = new.text,
    last_message_at = new.created_at,
    updated_at = now(),
    status = case
      when new.sender = 'operator' then 'in_progress'
      else conversations.status
    end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_conversation_last_message on public.messages;
create trigger trg_sync_conversation_last_message
after insert on public.messages
for each row execute function public.sync_conversation_last_message();

-- =========================
-- RLS: operator auth required for dashboard reads/writes
-- =========================
create or replace function public.is_operator()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'role') in ('admin', 'operator'), false);
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.quick_replies enable row level security;
alter table public.typing_events enable row level security;
alter table public.operator_presence enable row level security;

-- Operators/admins can read and write dashboard entities.
drop policy if exists conversations_operator_all on public.conversations;
create policy conversations_operator_all on public.conversations
for all
using (public.is_operator())
with check (public.is_operator());

drop policy if exists messages_operator_all on public.messages;
create policy messages_operator_all on public.messages
for all
using (public.is_operator())
with check (public.is_operator());

drop policy if exists quick_replies_operator_all on public.quick_replies;
create policy quick_replies_operator_all on public.quick_replies
for all
using (public.is_operator())
with check (public.is_operator());

drop policy if exists typing_events_operator_all on public.typing_events;
create policy typing_events_operator_all on public.typing_events
for all
using (public.is_operator())
with check (public.is_operator());

drop policy if exists operator_presence_operator_all on public.operator_presence;
create policy operator_presence_operator_all on public.operator_presence
for all
using (public.is_operator())
with check (public.is_operator());

-- Realtime publication.
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.typing_events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.operator_presence;
  exception when duplicate_object then null;
  end;
end $$;
