-- ============================================================
-- MIGRAÇÃO 021: Adicionar coluna categoria em pagamentos_dda
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

ALTER TABLE public.pagamentos_dda ADD COLUMN IF NOT EXISTS categoria TEXT;

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
