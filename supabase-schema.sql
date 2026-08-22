-- Historial de carreras/caminatas: log completo, un registro por sesión
create table run_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date timestamptz not null,
  mode text not null,          -- 'correr' | 'caminar'
  distance_m numeric not null,
  elapsed_s numeric not null,
  steps int,
  kcal numeric,
  created_at timestamptz not null default now()
);

-- Peso corporal + progreso del plan: una sola fila por usuario, se sobreescribe
create table user_state (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  weight_kg numeric,
  plan_level text,
  plan_current_day int,
  plan_completed_days int[],
  updated_at timestamptz not null default now()
);

alter table run_history enable row level security;
alter table user_state enable row level security;

create policy "own rows only" on run_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own row only" on user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
