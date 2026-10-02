begin;

-- Run AFTER 001_create_tasks.sql. Existing shared tasks remain unassigned:
-- no account gains access to someone else's historical tasks automatically.
alter table public.tasks
add column user_id uuid references auth.users(id) on delete cascade;

create index tasks_user_created_at_idx on public.tasks (user_id, created_at desc, id desc);

-- Preserve historical rows without an owner; all NEW rows must have an owner.
alter table public.tasks add constraint tasks_owner_required
check (user_id is not null) not valid;

-- Service-role bypasses RLS, so the backend ALSO scopes every public query by
-- verified user ID. Browser/anon/authenticated still have no direct table grants.
notify pgrst, 'reload schema';

commit;
