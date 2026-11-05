-- Módulo aislado de formación SSOMA. Ejecutar tras revisar políticas de acceso.
-- No modifica tablas existentes ni crea políticas permisivas.
create table if not exists public.ssoma_formacion_actividades (
 id uuid primary key default gen_random_uuid(),
 proyecto text not null,
 tipo text not null check(tipo in ('charla','capacitacion','induccion','reinduccion','difusion','simulacro')),
 tema text not null,
 fecha date not null,
 inicio time,
 duracion_min integer not null check(duracion_min between 1 and 480),
 expositor text,
 empresa_organizadora text,
 estado text not null default 'programada' check(estado in ('programada','ejecutada','validada','reprogramada','cancelada')),
 observaciones text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.ssoma_formacion_asistencias (
 id uuid primary key default gen_random_uuid(),
 actividad_id uuid not null references public.ssoma_formacion_actividades(id) on delete cascade,
 trabajador_id uuid,
 dni text not null,
 nombres text not null,
 empresa text not null,
 cargo text,
 firma_ruta text,
 presente boolean not null default true,
 created_at timestamptz not null default now(),
 unique(actividad_id,dni)
);
create table if not exists public.ssoma_formacion_evidencias (
 id uuid primary key default gen_random_uuid(),
 actividad_id uuid not null references public.ssoma_formacion_actividades(id) on delete cascade,
 ruta text not null,
 descripcion text,
 capturada_en timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists ssoma_formacion_fecha_idx on public.ssoma_formacion_actividades(fecha,tipo);
create index if not exists ssoma_formacion_asistencias_actividad_idx on public.ssoma_formacion_asistencias(actividad_id);
create index if not exists ssoma_formacion_evidencias_actividad_idx on public.ssoma_formacion_evidencias(actividad_id);
alter table public.ssoma_formacion_actividades enable row level security;
alter table public.ssoma_formacion_asistencias enable row level security;
alter table public.ssoma_formacion_evidencias enable row level security;
-- Sin políticas: denegación predeterminada para usuarios normales.
-- Crear políticas restringidas tras identificar roles y aislamiento por proyecto.
-- Crear bucket privado ssoma-formacion-evidencias con políticas de Storage por rol.
