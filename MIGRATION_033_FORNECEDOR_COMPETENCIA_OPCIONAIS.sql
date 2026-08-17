-- ==============================================================================
-- MIGRAÇÃO 033: Tornar fornecedor opcional no banco de dados (DROP NOT NULL)
-- Cole no SQL Editor do Supabase e clique RUN
-- ==============================================================================

ALTER TABLE public.agendamentos ALTER COLUMN fornecedor DROP NOT NULL;
