-- ============================================================
-- MIGRAÇÃO 022: Adicionar coluna descricao em pagamentos_dda
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

ALTER TABLE public.pagamentos_dda ADD COLUMN IF NOT EXISTS descricao TEXT;

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
