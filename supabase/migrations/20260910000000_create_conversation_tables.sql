create table public.users (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id),
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);

create index threads_user_id_idx on public.threads (user_id);
create index messages_thread_id_created_at_idx
  on public.messages (thread_id, created_at);

create function public.set_conversation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_conversation_updated_at();

create trigger threads_set_updated_at
before update on public.threads
for each row execute function public.set_conversation_updated_at();

-- External identities are not Supabase Auth IDs. Access is backend-only until
-- policies define how authenticated identities map to these users.
alter table public.users enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
