-- =========================================================
-- Schema inicial: PDS - Sistema de Reporte de Emergencias
-- Migración creada para el proyecto Supabase "zkaajxqsiugyzpqrreaw"
-- =========================================================

-- -----------------------------
-- Tabla: usuarios
-- -----------------------------
create table if not exists public.usuarios (
  id bigserial primary key,
  nombre text not null,
  correo text not null unique,
  password text not null,
  rol text not null default 'usuario' check (rol in ('usuario', 'guardia', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_usuarios_correo on public.usuarios (correo);
create index if not exists idx_usuarios_rol on public.usuarios (rol);

-- -----------------------------
-- Tabla: incidentes
-- -----------------------------
create table if not exists public.incidentes (
  id bigserial primary key,
  usuario_id bigint references public.usuarios (id) on delete set null,
  zona_id bigint,
  tipo_incidente text not null default 'otro',
  descripcion text not null,
  estado text not null default 'Pendiente'
    check (estado in ('Pendiente', 'Atendido', 'Cerrado', 'Cancelado')),
  latitud double precision,
  longitud double precision,
  guardia_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incidentes_usuario on public.incidentes (usuario_id);
create index if not exists idx_incidentes_estado on public.incidentes (estado);
create index if not exists idx_incidentes_zona on public.incidentes (zona_id);
create index if not exists idx_incidentes_tipo on public.incidentes (tipo_incidente);

-- -----------------------------
-- Tabla: zonas (Campus Huachi)
-- -----------------------------
create table if not exists public.zonas (
  id bigserial primary key,
  nombre text not null,
  descripcion text,
  coordenadas jsonb not null,
  color text not null default '#FFBD00',
  zona_tipo text,
  campus text not null default 'Huachi',
  created_at timestamptz not null default now()
);

create index if not exists idx_zonas_campus on public.zonas (campus);

-- -----------------------------
-- Tabla: grupos_confianza
-- -----------------------------
create table if not exists public.grupos_confianza (
  id bigserial primary key,
  usuario_creador_id bigint not null references public.usuarios (id) on delete cascade,
  nombre text not null,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_grupos_creador on public.grupos_confianza (usuario_creador_id);

-- -----------------------------
-- Tabla: grupo_miembros
-- -----------------------------
create table if not exists public.grupo_miembros (
  id bigserial primary key,
  grupo_id bigint not null references public.grupos_confianza (id) on delete cascade,
  usuario_id bigint not null references public.usuarios (id) on delete cascade,
  rol text not null default 'miembro' check (rol in ('admin', 'miembro')),
  joined_at timestamptz not null default now(),
  unique (grupo_id, usuario_id)
);

create index if not exists idx_grupo_miembros_grupo on public.grupo_miembros (grupo_id);
create index if not exists idx_grupo_miembros_usuario on public.grupo_miembros (usuario_id);

-- -----------------------------
-- Tabla: solicitudes_grupo
-- -----------------------------
create table if not exists public.solicitudes_grupo (
  id bigserial primary key,
  grupo_id bigint not null references public.grupos_confianza (id) on delete cascade,
  usuario_invitado_id bigint not null references public.usuarios (id) on delete cascade,
  usuario_solicitante_id bigint not null references public.usuarios (id) on delete cascade,
  mensaje text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptado', 'rechazado')),
  created_at timestamptz not null default now()
);

create index if not exists idx_solicitudes_grupo on public.solicitudes_grupo (grupo_id);
create index if not exists idx_solicitudes_invitado on public.solicitudes_grupo (usuario_invitado_id);
create index if not exists idx_solicitudes_estado on public.solicitudes_grupo (estado);

-- -----------------------------
-- Tabla: notificaciones (generales por usuario)
-- -----------------------------
create table if not exists public.notificaciones (
  id bigserial primary key,
  usuario_id bigint not null references public.usuarios (id) on delete cascade,
  incidente_id bigint references public.incidentes (id) on delete cascade,
  mensaje text not null,
  leido boolean not null default false,
  fecha timestamptz not null default now()
);

create index if not exists idx_notificaciones_usuario on public.notificaciones (usuario_id);
create index if not exists idx_notificaciones_leido on public.notificaciones (leido);

-- -----------------------------
-- Tabla: notificaciones_grupo
-- -----------------------------
create table if not exists public.notificaciones_grupo (
  id bigserial primary key,
  grupo_id bigint not null references public.grupos_confianza (id) on delete cascade,
  incidente_id bigint references public.incidentes (id) on delete cascade,
  usuario_emisor_id bigint not null references public.usuarios (id) on delete cascade,
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifgrupo_grupo on public.notificaciones_grupo (grupo_id);
create index if not exists idx_notifgrupo_emisor on public.notificaciones_grupo (usuario_emisor_id);
create index if not exists idx_notifgrupo_leida on public.notificaciones_grupo (leida);

-- =========================================================
-- Triggers: actualizar updated_at automáticamente
-- =========================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_usuarios_updated on public.usuarios;
create trigger trg_usuarios_updated
before update on public.usuarios
for each row execute function public.set_updated_at();

drop trigger if exists trg_incidentes_updated on public.incidentes;
create trigger trg_incidentes_updated
before update on public.incidentes
for each row execute function public.set_updated_at();

drop trigger if exists trg_grupos_updated on public.grupos_confianza;
create trigger trg_grupos_updated
before update on public.grupos_confianza
for each row execute function public.set_updated_at();

-- =========================================================
-- Row Level Security (RLS)
-- Por defecto se desactiva para que el anon key funcione
-- en desarrollo. Actívalo cuando tengas políticas listas.
-- =========================================================
alter table public.usuarios disable row level security;
alter table public.incidentes disable row level security;
alter table public.zonas disable row level security;
alter table public.grupos_confianza disable row level security;
alter table public.grupo_miembros disable row level security;
alter table public.solicitudes_grupo disable row level security;
alter table public.notificaciones disable row level security;
alter table public.notificaciones_grupo disable row level security;

-- =========================================================
-- Grants para anon y authenticated
-- (necesario porque desactivamos RLS pero los roles
-- necesitan permisos explícitos para usar la API REST)
-- =========================================================
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- Aplica también a tablas creadas en el futuro
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;