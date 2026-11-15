-- Copia de las migraciones aplicadas en el proyecto Supabase "kalle" (demos del portafolio), 14-nov-2026.
-- Barbería FILO: citas con datos personales protegidos.
--   · Nadie lee la tabla desde la web: el público solo ve horas ocupadas con filo_horas_ocupadas().
--   · Solo se reserva con filo_reservar(), que valida servicio, barbero, fecha (hasta 21 días), horario
--     (L-S 9:00 AM a 7:00 PM, domingo 10:00 AM a 2:00 PM, cada 30 min), nombre y teléfono venezolano,
--     y limita a 1 reserva por minuto y 3 por día por IP (guardada como hash).
--   · Los dueños (tabla privado.filo_duenos) entran al panel con Supabase Auth y solo pueden cambiar el estado.
-- Requiere el esquema privado y privado.config('sal') creados en ../../tienda-ropa/supabase/comentarios.sql.

create table public.filo_citas (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  servicio text not null check (servicio in ('corte','fade','diseno','barba','combo','navaja','ninos','peinado')),
  barbero text not null check (barbero in ('andres','kevin','luis','mateo')),
  fecha date not null,
  hora time not null,
  nombre text not null check (char_length(nombre) between 2 and 40),
  telefono text not null check (telefono ~ '^04(12|14|16|24|26|22)[0-9]{7}$'),
  estado text not null default 'pendiente' check (estado in ('pendiente','hecha','cancelada')),
  creado timestamptz not null default now()
);
create unique index filo_citas_hueco on public.filo_citas (barbero, fecha, hora) where estado <> 'cancelada';

alter table public.filo_citas enable row level security;
revoke all on public.filo_citas from anon, authenticated;

create table privado.filo_intentos (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  creado timestamptz not null default now()
);
create index filo_intentos_ip on privado.filo_intentos (ip_hash, creado);

create or replace function public.filo_horas_ocupadas(p_barbero text, p_fecha date)
returns setof time
language sql
security definer
set search_path = ''
stable
as $$
  select c.hora from public.filo_citas c
  where c.barbero = p_barbero and c.fecha = p_fecha and c.estado <> 'cancelada'
  order by c.hora;
$$;

create or replace function public.filo_reservar(p_servicio text, p_barbero text, p_fecha date, p_hora time, p_nombre text, p_telefono text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(regexp_replace(regexp_replace(coalesce(p_nombre, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  v_telefono text := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_ahora time := (now() at time zone 'America/Caracas')::time;
  v_cabeceras json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_domingo boolean;
  v_abre time;
  v_cierra time;
  v_ip text;
  v_hash text;
  v_codigo text;
begin
  if p_servicio not in ('corte','fade','diseno','barba','combo','navaja','ninos','peinado') then
    raise exception 'servicio_invalido' using errcode = '22023';
  end if;
  if p_barbero not in ('andres','kevin','luis','mateo') then
    raise exception 'barbero_invalido' using errcode = '22023';
  end if;
  if char_length(v_nombre) not between 2 and 40 then
    raise exception 'nombre_invalido' using errcode = '22023';
  end if;
  if v_telefono !~ '^04(12|14|16|24|26|22)[0-9]{7}$' then
    raise exception 'telefono_invalido' using errcode = '22023';
  end if;
  if p_fecha is null or p_fecha < v_hoy or p_fecha > v_hoy + 21 then
    raise exception 'fecha_invalida' using errcode = '22023';
  end if;

  v_domingo := extract(isodow from p_fecha) = 7;
  v_abre := time '09:00';
  v_cierra := time '19:00';
  if v_domingo then
    v_abre := time '10:00';
    v_cierra := time '14:00';
  end if;
  if p_hora is null or p_hora < v_abre or p_hora >= v_cierra
     or extract(minute from p_hora)::int % 30 <> 0 or extract(second from p_hora) <> 0
     or (p_fecha = v_hoy and p_hora <= v_ahora) then
    raise exception 'hora_invalida' using errcode = '22023';
  end if;

  v_ip := btrim(split_part(coalesce(v_cabeceras ->> 'cf-connecting-ip', v_cabeceras ->> 'x-real-ip', v_cabeceras ->> 'x-forwarded-for', 'sin-ip'), ',', 1));
  v_hash := encode(extensions.digest(v_ip || (select c.valor from privado.config c where c.clave = 'sal'), 'sha256'), 'hex');
  if exists (select 1 from privado.filo_intentos i where i.ip_hash = v_hash and i.creado > now() - interval '60 seconds') then
    raise exception 'muy_seguido' using errcode = 'P0001';
  end if;
  if (select count(*) from privado.filo_intentos i where i.ip_hash = v_hash and i.creado > now() - interval '1 day') >= 3 then
    raise exception 'limite_diario' using errcode = 'P0001';
  end if;

  insert into privado.filo_intentos (ip_hash) values (v_hash);
  delete from privado.filo_intentos i where i.creado < now() - interval '2 days';

  v_codigo := 'FILO-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  begin
    insert into public.filo_citas (codigo, servicio, barbero, fecha, hora, nombre, telefono)
    values (v_codigo, p_servicio, p_barbero, p_fecha, p_hora, v_nombre, v_telefono);
  exception when unique_violation then
    raise exception 'hora_ocupada' using errcode = 'P0001';
  end;
  return v_codigo;
end;
$$;

revoke execute on function public.filo_horas_ocupadas(text, date) from public, authenticated;
revoke execute on function public.filo_reservar(text, text, date, time, text, text) from public, authenticated;
grant execute on function public.filo_horas_ocupadas(text, date) to anon;
grant execute on function public.filo_reservar(text, text, date, time, text, text) to anon;

-- ---- Panel del dueño ----
create table privado.filo_duenos (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.filo_es_dueno()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from privado.filo_duenos d where d.user_id = (select auth.uid()));
$$;
revoke execute on function public.filo_es_dueno() from public, anon;
grant execute on function public.filo_es_dueno() to authenticated;

grant select on public.filo_citas to authenticated;
grant update (estado) on public.filo_citas to authenticated;

create policy "duenos leen citas" on public.filo_citas
  for select to authenticated using ((select public.filo_es_dueno()));
create policy "duenos cambian estado" on public.filo_citas
  for update to authenticated using ((select public.filo_es_dueno())) with check ((select public.filo_es_dueno()));

-- Para dar acceso a un dueño (después de crear su cuenta en Authentication):
-- insert into privado.filo_duenos (user_id) select id from auth.users where email = 'correo@ejemplo.com';

-- ---- Cancelar con código + teléfono (libera la hora). Máximo 5 intentos por hora por IP, también los fallidos ----
create table privado.filo_intentos_cancelar (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  creado timestamptz not null default now()
);
create index filo_intentos_cancelar_ip on privado.filo_intentos_cancelar (ip_hash, creado);

create or replace function public.filo_cancelar(p_codigo text, p_telefono text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_telefono text := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_cabeceras json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_ip text;
  v_hash text;
  v_id bigint;
begin
  if v_codigo !~ '^FILO-[0-9A-F]{6}$' or v_telefono !~ '^04(12|14|16|24|26|22)[0-9]{7}$' then
    raise exception 'datos_invalidos' using errcode = '22023';
  end if;

  v_ip := btrim(split_part(coalesce(v_cabeceras ->> 'cf-connecting-ip', v_cabeceras ->> 'x-real-ip', v_cabeceras ->> 'x-forwarded-for', 'sin-ip'), ',', 1));
  v_hash := encode(extensions.digest(v_ip || (select c.valor from privado.config c where c.clave = 'sal'), 'sha256'), 'hex');
  if (select count(*) from privado.filo_intentos_cancelar i where i.ip_hash = v_hash and i.creado > now() - interval '1 hour') >= 5 then
    raise exception 'muchos_intentos' using errcode = 'P0001';
  end if;
  insert into privado.filo_intentos_cancelar (ip_hash) values (v_hash);
  delete from privado.filo_intentos_cancelar i where i.creado < now() - interval '1 day';

  update public.filo_citas c set estado = 'cancelada'
  where c.codigo = v_codigo and c.telefono = v_telefono and c.estado = 'pendiente' and c.fecha >= v_hoy
  returning c.id into v_id;

  if v_id is null then
    return 'no_encontrada';
  end if;
  return 'cancelada';
end;
$$;

revoke execute on function public.filo_cancelar(text, text) from public, authenticated;
grant execute on function public.filo_cancelar(text, text) to anon;

-- ---- RLS también en el esquema privado (15-nov-2026). Las funciones son de postgres y siguen leyendo. ----
alter table privado.config enable row level security;
alter table privado.intentos enable row level security;
alter table privado.filo_duenos enable row level security;
alter table privado.filo_intentos enable row level security;
alter table privado.filo_intentos_cancelar enable row level security;
revoke execute on function public.filo_es_dueno() from anon;
