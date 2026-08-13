-- ============================================================
-- MIGRAÇÃO 025: Vínculo entre as duas pontas de uma Transferência
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- Cada Transferência gera DUAS linhas em agendamentos (uma de saída na
-- loja de origem, outra de entrada na loja de destino). Essa coluna
-- guarda um ID comum às duas linhas, pra quando o usuário excluir uma
-- ponta, a outra ponta seja excluída junto automaticamente.
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS transferencia_id UUID;

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
--
-- Observação: transferências feitas ANTES de rodar essa migração não
-- têm transferencia_id preenchido, então excluir uma ponta antiga não
-- vai apagar a outra ponta sozinha (só as novas, feitas depois disso).
-- ============================================================
