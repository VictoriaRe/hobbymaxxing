create table if not exists public.push_devices (
  device_hash text primary key check (device_hash ~ '^[0-9a-f]{64}$'),
  subscription jsonb not null,
  settings jsonb not null,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_deliveries (
  delivery_key text primary key,
  device_hash text not null references public.push_devices(device_hash) on delete cascade,
  status text not null check (status in ('pending', 'sent')),
  claimed_at timestamptz not null default now(),
  delivered_at timestamptz
);

alter table public.push_devices enable row level security;
alter table public.push_devices force row level security;
alter table public.push_deliveries enable row level security;
alter table public.push_deliveries force row level security;

revoke all on public.push_devices from anon, authenticated;
revoke all on public.push_deliveries from anon, authenticated;
grant all on public.push_devices to service_role;
grant all on public.push_deliveries to service_role;

create index if not exists push_devices_last_active_at_idx on public.push_devices(last_active_at);
