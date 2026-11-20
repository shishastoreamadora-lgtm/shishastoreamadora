-- =========================================================
-- SHISHA STORE — Atualização 5: Dono e Equipa
-- Colar no Supabase → SQL Editor → New query → Run
-- (pode ser executado mais do que uma vez)
--  - Dono: entra com email + palavra-passe e pode tudo
--  - Equipa: entra só com um código (criado pelo dono no painel)
--    Pode: produtos, packs, fotos, stock, página inicial, encomendas,
--          responder/aprovar opiniões e o botão de emergência
--    Não pode: dados da loja, apagar (produtos, encomendas, opiniões),
--              juntar opiniões, cópias de segurança, códigos da equipa
--  - As regras estão na base de dados: esconder botões não chega
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Perfis: quem é dono e quem é equipa ----------
create table if not exists public.perfis (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  papel    text not null check (papel in ('dono', 'equipa')),
  nome     text check (nome is null or char_length(nome) <= 40),
  criado   timestamptz not null default now()
);
alter table public.perfis enable row level security;
revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;

-- Todas as contas que já existem (criadas pelo Franco/Ricardo) passam a "dono"
insert into public.perfis (user_id, papel)
select id, 'dono' from auth.users
where id not in (select user_id from public.perfis)
on conflict (user_id) do nothing;

create or replace function public.papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.perfis where user_id = auth.uid()
$$;
revoke all on function public.papel() from public, anon;
grant execute on function public.papel() to authenticated, service_role;

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (user_id = auth.uid() or public.papel() = 'dono');

-- ---------- Códigos da equipa (guardados encriptados, nunca legíveis) ----------
create table if not exists public.equipa_codigos (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  nome           text not null check (char_length(nome) between 1 and 40),
  hash           text not null,
  criado         timestamptz not null default now(),
  ultimo_acesso  timestamptz
);
alter table public.equipa_codigos enable row level security;
revoke all on public.equipa_codigos from anon, authenticated;

create table if not exists public.equipa_tentativas (
  id  bigint generated always as identity primary key,
  ip  text,
  ok  boolean not null,
  t   timestamptz not null default now()
);
create index if not exists equipa_tentativas_t on public.equipa_tentativas (t desc);
alter table public.equipa_tentativas enable row level security;
revoke all on public.equipa_tentativas from anon, authenticated;

-- Verificar um código (só o servidor — função "equipa" — pode chamar)
-- Bloqueia: 5 erros do mesmo IP ou 30 erros no total em 15 minutos
create or replace function public.equipa_verificar(p_codigo text, p_ip text)
returns table (user_id uuid, nome text, estado text)
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  delete from public.equipa_tentativas where t < now() - interval '1 day';
  if (select count(*) from public.equipa_tentativas a where not a.ok and a.ip = p_ip and a.t > now() - interval '15 minutes') >= 5
     or (select count(*) from public.equipa_tentativas a where not a.ok and a.t > now() - interval '15 minutes') >= 30 then
    return query select null::uuid, null::text, 'bloqueado'::text; return;
  end if;
  for r in select c.user_id, c.nome, c.hash from public.equipa_codigos c loop
    if r.hash = extensions.crypt(p_codigo, r.hash) then
      insert into public.equipa_tentativas (ip, ok) values (p_ip, true);
      update public.equipa_codigos set ultimo_acesso = now() where equipa_codigos.user_id = r.user_id;
      return query select r.user_id, r.nome, 'ok'::text; return;
    end if;
  end loop;
  insert into public.equipa_tentativas (ip, ok) values (p_ip, false);
  return query select null::uuid, null::text, 'errado'::text;
end $$;

create or replace function public.equipa_codigo_livre(p_codigo text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select not exists (select 1 from public.equipa_codigos c where c.hash = extensions.crypt(p_codigo, c.hash))
$$;

create or replace function public.equipa_guardar(p_user uuid, p_nome text, p_codigo text)
returns void language sql security definer set search_path = public, extensions as $$
  insert into public.equipa_codigos (user_id, nome, hash)
  values (p_user, p_nome, extensions.crypt(p_codigo, extensions.gen_salt('bf', 8)))
  on conflict (user_id) do update set nome = excluded.nome, hash = excluded.hash
$$;

revoke all on function public.equipa_verificar(text, text) from public, anon, authenticated;
revoke all on function public.equipa_codigo_livre(text) from public, anon, authenticated;
revoke all on function public.equipa_guardar(uuid, text, text) from public, anon, authenticated;
grant execute on function public.equipa_verificar(text, text) to service_role;
grant execute on function public.equipa_codigo_livre(text) to service_role;
grant execute on function public.equipa_guardar(uuid, text, text) to service_role;

-- Lista para o painel do dono (nunca mostra os códigos)
create or replace function public.equipa_listar()
returns table (user_id uuid, nome text, criado timestamptz, ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.papel() is distinct from 'dono' then raise exception 'Só o dono' using errcode = '42501'; end if;
  return query select c.user_id, c.nome, c.criado, c.ultimo_acesso from public.equipa_codigos c order by c.criado;
end $$;
revoke all on function public.equipa_listar() from public, anon;
grant execute on function public.equipa_listar() to authenticated;

-- ---------- Botão de emergência (dono e equipa) ----------
-- A única forma de mudar "ocultarEssencias": um "Guardar" antigo de outro
-- telemóvel nunca volta a mostrar as essências por engano.
create or replace function public.loja_emergencia(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.papel() is null then raise exception 'Sem acesso' using errcode = '42501'; end if;
  perform set_config('loja.emergencia', '1', true);
  update public.settings
     set store = case when p_on then store || '{"ocultarEssencias": true}'::jsonb else store - 'ocultarEssencias' end,
         updated_at = now()
   where id = 1;
end $$;
revoke all on function public.loja_emergencia(boolean) from public, anon;
grant execute on function public.loja_emergencia(boolean) to authenticated;

-- Dados da loja: a equipa só altera a página inicial ("home");
-- ninguém muda a emergência fora do botão
create or replace function public.settings_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_old jsonb := coalesce(old.store, '{}'::jsonb);
begin
  if tg_op = 'UPDATE' and coalesce(current_setting('loja.emergencia', true), '') <> '1' then
    new.store := new.store - 'ocultarEssencias';
    if v_old ? 'ocultarEssencias' then new.store := new.store || jsonb_build_object('ocultarEssencias', v_old -> 'ocultarEssencias'); end if;
  end if;
  if tg_op = 'UPDATE' and public.papel() = 'equipa' then
    new.store := (v_old - 'home' - 'ocultarEssencias')
      || case when new.store ? 'home' then jsonb_build_object('home', new.store -> 'home') else '{}'::jsonb end
      || case when new.store ? 'ocultarEssencias' then jsonb_build_object('ocultarEssencias', new.store -> 'ocultarEssencias') else '{}'::jsonb end;
  end if;
  return new;
end $$;
drop trigger if exists settings_guarda on public.settings;
create trigger settings_guarda before update on public.settings
  for each row execute function public.settings_guarda();

-- ---------- Regras por tabela ----------
-- Catálogo: equipa cria e edita; só o dono apaga
drop policy if exists "catalog_write" on public.catalog;
drop policy if exists catalog_criar on public.catalog;
drop policy if exists catalog_editar on public.catalog;
drop policy if exists catalog_apagar on public.catalog;
create policy catalog_criar  on public.catalog for insert to authenticated with check (public.papel() in ('dono', 'equipa'));
create policy catalog_editar on public.catalog for update to authenticated using (public.papel() in ('dono', 'equipa')) with check (public.papel() in ('dono', 'equipa'));
create policy catalog_apagar on public.catalog for delete to authenticated using (public.papel() = 'dono');

-- Dados da loja
drop policy if exists "settings_write" on public.settings;
drop policy if exists settings_criar on public.settings;
drop policy if exists settings_editar on public.settings;
drop policy if exists settings_apagar on public.settings;
create policy settings_criar  on public.settings for insert to authenticated with check (public.papel() = 'dono');
create policy settings_editar on public.settings for update to authenticated using (public.papel() in ('dono', 'equipa')) with check (public.papel() in ('dono', 'equipa'));
create policy settings_apagar on public.settings for delete to authenticated using (public.papel() = 'dono');

-- Encomendas: equipa vê e muda o estado; só o dono cria exemplos e apaga
drop policy if exists "orders_owner" on public.orders;
drop policy if exists orders_ver on public.orders;
drop policy if exists orders_editar on public.orders;
drop policy if exists orders_dono_criar on public.orders;
drop policy if exists orders_apagar on public.orders;
create policy orders_ver        on public.orders for select to authenticated using (public.papel() in ('dono', 'equipa'));
create policy orders_editar     on public.orders for update to authenticated using (public.papel() in ('dono', 'equipa')) with check (public.papel() in ('dono', 'equipa'));
create policy orders_dono_criar on public.orders for insert to authenticated with check (public.papel() = 'dono');
create policy orders_apagar     on public.orders for delete to authenticated using (public.papel() = 'dono');

-- Opiniões: equipa lê, aprova e responde; só o dono junta e apaga
drop policy if exists reviews_admin_all on public.reviews;
drop policy if exists reviews_ver on public.reviews;
drop policy if exists reviews_editar on public.reviews;
drop policy if exists reviews_dono_criar on public.reviews;
drop policy if exists reviews_apagar on public.reviews;
create policy reviews_ver        on public.reviews for select to authenticated using (public.papel() in ('dono', 'equipa'));
create policy reviews_editar     on public.reviews for update to authenticated using (public.papel() in ('dono', 'equipa')) with check (public.papel() in ('dono', 'equipa'));
create policy reviews_dono_criar on public.reviews for insert to authenticated with check (public.papel() = 'dono');
create policy reviews_apagar     on public.reviews for delete to authenticated using (public.papel() = 'dono');

-- Fotos: dono e equipa carregam; só o dono apaga
drop policy if exists "fotos_write"  on storage.objects;
drop policy if exists "fotos_update" on storage.objects;
drop policy if exists "fotos_delete" on storage.objects;
create policy "fotos_write"  on storage.objects for insert to authenticated with check (bucket_id = 'produtos' and public.papel() in ('dono', 'equipa'));
create policy "fotos_update" on storage.objects for update to authenticated using (bucket_id = 'produtos' and public.papel() in ('dono', 'equipa'));
create policy "fotos_delete" on storage.objects for delete to authenticated using (bucket_id = 'produtos' and public.papel() = 'dono');
