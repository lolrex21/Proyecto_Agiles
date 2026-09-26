-- Miembro 2. Ejecutar antes de iniciar el frontend refactorizado.
-- SECURITY INVOKER: conserva los permisos/RLS existentes.
begin;

create or replace function public.m2_create_group_admin()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  insert into public.grupo_miembros (grupo_id, usuario_id, rol)
  values (new.id, new.usuario_creador_id, 'admin');
  return new;
end;
$$;

create trigger m2_group_admin
  after insert on public.grupos_confianza
  for each row execute function public.m2_create_group_admin();

-- Una aceptación y su membresía se confirman o revierten juntas.
create or replace function public.m2_accept_invitation()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.estado <> 'pendiente' and new.estado <> old.estado then
    raise exception 'La solicitud ya fue respondida';
  end if;
  if old.estado = 'pendiente' and new.estado = 'aceptado' then
    insert into public.grupo_miembros (grupo_id, usuario_id, rol)
    values (new.grupo_id, new.usuario_invitado_id, 'miembro')
    on conflict (grupo_id, usuario_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger m2_invitation_membership
  before update of estado on public.solicitudes_grupo
  for each row execute function public.m2_accept_invitation();

commit;
