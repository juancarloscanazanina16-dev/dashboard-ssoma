-- Etapa 1: ejecutar en Supabase SQL Editor antes de usar los campos nuevos.
alter table public.trainings add column if not exists score numeric(5,2);
alter table public.trainings add column if not exists passing_score numeric(5,2);
alter table public.trainings add constraint trainings_score_range check (score is null or score between 0 and 20);
alter table public.trainings add constraint trainings_passing_score_range check (passing_score is null or passing_score between 0 and 20);
-- Registro de decisiones separado del historial de capacitaciones.
create table if not exists public.ssoma_authorizations (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.personnel(id),
 decision text not null check (decision in ('HABILITADO','PENDIENTE','NO HABILITADO')),
 reason text not null,
 decided_by uuid not null default auth.uid(),
 decided_at timestamptz not null default now()
);
create index if not exists ssoma_authorizations_person_date on public.ssoma_authorizations(person_id,decided_at desc);
alter table public.ssoma_authorizations enable row level security;
-- NO crear políticas públicas ni para authenticated: por defecto se deniega acceso.
-- Antes de habilitar decisiones, configurar roles SSOMA verificados y políticas RLS
-- que autoricen exclusivamente a responsables designados. No confiar en el frontend.
