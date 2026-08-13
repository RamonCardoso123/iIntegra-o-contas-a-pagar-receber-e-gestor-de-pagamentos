-- ============================================================
-- MIGRAÇÃO 026: Data de Competência nos lançamentos de DDA
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- O Agendamento já tem "competencia" (usado no Conta Azul como data de
-- emissão do documento). O DDA não tinha essa coluna — agora passa a ter,
-- pra poder preencher tanto na lista de lançamentos quanto na edição.
ALTER TABLE public.pagamentos_dda ADD COLUMN IF NOT EXISTS competencia DATE;

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
