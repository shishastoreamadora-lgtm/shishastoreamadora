-- =========================================================
-- SHISHA STORE — Atualização 2: encomendas mais seguras
-- Colar no Supabase → SQL Editor → New query → Run
-- (pode ser executado mais do que uma vez)
--  1. Guarda o nome e o telemóvel do cliente na encomenda
--  2. O servidor recalcula os preços e o total (ninguém os pode falsear)
--  3. Anti-spam: máx. 5 encomendas por 10 min do mesmo cliente
--     e 60 por hora no total
-- =========================================================

alter table public.orders add column if not exists cliente jsonb;
alter table public.orders add column if not exists ip_hash text;

alter table public.orders drop constraint if exists orders_cliente_check;
alter table public.orders add constraint orders_cliente_check
  check (cliente is null or (jsonb_typeof(cliente) = 'object' and octet_length(cliente::text) < 400));

create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_ip_idx on public.orders (ip_hash, created_at desc);

create or replace function public.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  it jsonb; p jsonb; price numeric; q int;
  v_total numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_ip text; v_recent int;
begin
  -- O dono (com login) pode criar encomendas de exemplo sem estas regras
  if coalesce(auth.role(), 'anon') = 'authenticated' then
    return new;
  end if;

  -- Anti-spam
  begin
    v_ip := nullif(trim(split_part((current_setting('request.headers', true)::jsonb) ->> 'x-forwarded-for', ',', 1)), '');
  exception when others then v_ip := null;
  end;
  if v_ip is not null then
    new.ip_hash := md5(v_ip || 'shisha-store');
    select count(*) into v_recent from orders
      where ip_hash = new.ip_hash and created_at > now() - interval '10 minutes';
    if v_recent >= 5 then
      raise exception 'Demasiadas encomendas seguidas. Tenta outra vez daqui a uns minutos.';
    end if;
  end if;
  select count(*) into v_recent from orders where created_at > now() - interval '1 hour';
  if v_recent >= 60 then
    raise exception 'Serviço ocupado. Tenta outra vez mais tarde.';
  end if;

  -- Preços e total calculados pelo servidor a partir do catálogo
  for it in select * from jsonb_array_elements(new.items) loop
    select data into p from catalog where id = it ->> 'id';
    if p is null then raise exception 'Produto inválido: %', it ->> 'id'; end if;
    if coalesce((p ->> 'esgotado')::boolean, false) or coalesce((p ->> 'oculto')::boolean, false) then
      raise exception 'Produto indisponível: %', coalesce(p ->> 'nome', p ->> 'sabor');
    end if;
    q := least(greatest(coalesce((it ->> 'qty')::int, 1), 1), 20);
    if p ? 'precos' then
      price := (p -> 'precos' ->> (it ->> 'variant'))::numeric;
    else
      price := (p ->> 'preco')::numeric;
    end if;
    if price is null then raise exception 'Preço indisponível: %', coalesce(p ->> 'nome', p ->> 'sabor'); end if;
    v_items := v_items || jsonb_build_object(
      'id', it ->> 'id', 'nome', coalesce(p ->> 'nome', p ->> 'sabor'),
      'variant', it -> 'variant', 'qty', q, 'preco', price);
    v_total := v_total + price * q;
  end loop;

  new.items := v_items;
  new.total := round(v_total, 2);
  new.estado := 'nova';
  new.exemplo := false;
  return new;
end;
$$;

drop trigger if exists orders_before_insert on public.orders;
create trigger orders_before_insert
  before insert on public.orders
  for each row execute function public.orders_before_insert();
