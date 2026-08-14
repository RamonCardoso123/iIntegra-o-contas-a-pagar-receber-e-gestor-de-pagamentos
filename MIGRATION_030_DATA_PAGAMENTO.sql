-- ============================================================
-- MIGRAÇÃO 030: Data de Pagamento separada do Vencimento
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================
-- Hoje o filtro de período e a exportação usam a Data de Vencimento.
-- Isso causa um problema real: um DDA importado numa segunda-feira pode
-- trazer boletos vencidos no sábado e domingo (que na prática são pagos
-- junto na segunda) — e o vencimento de cada um continua sendo o dia
-- original, então o relatório "some" com eles se o filtro for só "hoje".
--
-- Esta migração cria uma coluna nova, "data_pagamento", independente do
-- vencimento. Ela nasce automaticamente com a data do dia em que o
-- lançamento é criado/importado (DEFAULT CURRENT_DATE) — ou seja, se você
-- importar o DDA na segunda, todo o lote já nasce com Data de Pagamento =
-- segunda, não importa o vencimento de cada boleto. Ela é editável depois,
-- individualmente ou em lote, se precisar corrigir algum caso específico.
-- O Vencimento NÃO é alterado por essa migração — continua exatamente
-- como está, só deixa de ser o campo usado no filtro/exportação.

ALTER TABLE public.pagamentos_dda ADD COLUMN IF NOT EXISTS data_pagamento DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS data_pagamento DATE DEFAULT CURRENT_DATE;

-- Backfill dos registros que já existiam antes desta coluna existir: usa o
-- vencimento como aproximação (não tem como saber retroativamente o dia
-- real do pagamento), só pra eles não desaparecerem dos filtros/relatórios
-- daqui pra frente. Não mexe em nenhum vencimento.
UPDATE public.pagamentos_dda SET data_pagamento = data_vencimento WHERE data_pagamento IS NULL;
UPDATE public.agendamentos SET data_pagamento = data_vencimento WHERE data_pagamento IS NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_dda_data_pagamento ON public.pagamentos_dda(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_pagamento ON public.agendamentos(data_pagamento);

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
