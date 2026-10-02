begin;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title varchar(120) not null check (char_length(btrim(title)) between 1 and 120 and title = btrim(title)),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_pending_created_at_idx on public.tasks (created_at desc, id desc)
where status = 'pending';

create function public.set_task_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.title, new.description, new.status) is distinct from
     row(old.title, old.description, old.status) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger tasks_updated_at
before update on public.tasks
for each row execute function public.set_task_updated_at();

alter table public.tasks enable row level security;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.tasks from service_role;
grant select, insert, update on table public.tasks to service_role;
revoke all on function public.set_task_updated_at() from public, anon, authenticated;

commit;
