-- reMarketplace storage. Accessed only by the server with the service-role key; RLS on, no public policies.
create table if not exists public.rm_products (
  slug text primary key,
  data jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  position integer not null default 999,
  updated_at timestamptz not null default now()
);
create index if not exists rm_products_position_idx on public.rm_products (position);
create table if not exists public.rm_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.rm_products enable row level security;
alter table public.rm_settings enable row level security;
-- Public bucket for product images and PDFs (uploads go through the server)
insert into storage.buckets (id, name, public) values ('rm-images', 'rm-images', true) on conflict (id) do nothing;
