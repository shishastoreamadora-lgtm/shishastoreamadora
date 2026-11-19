-- Botão de emergência: avisa em tempo real todas as lojas abertas quando os
-- dados da loja mudam (ex.: esconder as essências).
-- Correr UMA vez no Supabase → SQL Editor → Run. Pode correr-se de novo sem problema.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;
