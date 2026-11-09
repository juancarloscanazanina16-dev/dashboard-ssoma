-- Ejecutar después de revisar las políticas RLS y el bucket existente.
create table if not exists public.sst_dossier_documents (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null,
 contractor_id uuid not null,
 person_id uuid null,
 requirement_code text not null,
 original_name text not null,
 storage_path text not null,
 valid_until date,
 review_status text not null default 'EN_REVISION' check (review_status in ('EN_REVISION','APROBADO','OBSERVADO')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid
);
create index if not exists idx_sst_dossier_company on public.sst_dossier_documents(project_id,contractor_id,requirement_code,created_at desc);
alter table public.sst_dossier_documents enable row level security;
-- No crear políticas permisivas sin confirmar el modelo de autorización del proyecto.
