-- users
create table users (
  id uuid primary key default uuid_generate_v4(),
  channel text,
  created_at timestamp default now()
);

-- conversations
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  status text default 'open',
  created_at timestamp default now()
);

-- messages
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id),
  sender text,
  text text,
  created_at timestamp default now()
);
