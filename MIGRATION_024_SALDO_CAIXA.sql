-- ============================================================
-- MIGRAÇÃO 024: Saldo em Caixa por loja (Gestão de Pagamentos)
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- Saldo em caixa real da loja, informado manualmente pelo operador
-- (usado para calcular o Saldo Final Estimado do card da loja).
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS saldo_caixa NUMERIC(14,2) DEFAULT 0;

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
