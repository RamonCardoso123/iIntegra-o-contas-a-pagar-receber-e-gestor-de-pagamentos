-- ==============================================================================
-- SCRIPT: CRIAR ARMAZENAMENTO (STORAGE) PARA OS ANEXOS DO NOVO AGENDAMENTO
-- ==============================================================================
-- Como rodar: abra o Supabase do projeto -> SQL Editor -> cole este script
-- inteiro -> Run. Só precisa rodar UMA vez.
--
-- O que ele faz: cria um "bucket" (pasta de arquivos) chamado "anexos" onde
-- os boletos/guias anexados no Novo Agendamento ficam salvos, e libera o
-- acesso a ele (mesmo padrão "Allow all" já usado nas outras tabelas do
-- app, já que a autenticação é controlada pelo Next.js, não pelo Supabase).
-- ==============================================================================

-- 1. Criar o bucket "anexos" (público, para dar pra visualizar o link direto)
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do nothing;

-- 2. Políticas de acesso ao bucket
drop policy if exists "Allow all access anexos - select" on storage.objects;
drop policy if exists "Allow all access anexos - insert" on storage.objects;
drop policy if exists "Allow all access anexos - update" on storage.objects;
drop policy if exists "Allow all access anexos - delete" on storage.objects;

create policy "Allow all access anexos - select"
on storage.objects for select
using (bucket_id = 'anexos');

create policy "Allow all access anexos - insert"
on storage.objects for insert
with check (bucket_id = 'anexos');

create policy "Allow all access anexos - update"
on storage.objects for update
using (bucket_id = 'anexos');

create policy "Allow all access anexos - delete"
on storage.objects for delete
using (bucket_id = 'anexos');

-- Observação: a coluna "anexo_url" que guarda o link do arquivo já existe
-- na tabela "agendamentos" (criada no setup_gestao_pagamentos.sql), então
-- não precisa alterar nenhuma tabela — só rodar este script de storage.
