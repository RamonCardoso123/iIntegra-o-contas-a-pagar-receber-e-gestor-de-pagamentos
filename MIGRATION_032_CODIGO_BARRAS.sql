-- ============================================================
-- MIGRAÇÃO 032: Adição do campo codigo_barras em agendamentos
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

COMMENT ON COLUMN public.agendamentos.codigo_barras IS 'Código de barras ou linha digitável numérica do boleto ou imposto';
