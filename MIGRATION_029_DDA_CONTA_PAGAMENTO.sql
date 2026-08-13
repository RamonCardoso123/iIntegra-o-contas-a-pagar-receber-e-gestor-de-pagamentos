-- ============================================================
-- MIGRAÇÃO 029: Conta de Pagamento no DDA
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- O Agendamento já tem "conta_pagamento". O DDA não tinha essa coluna —
-- por isso, ao enviar um DDA pro Contas a Pagar, a coluna CONTA sempre
-- ficava vazia lá. Agora dá pra preencher (na edição individual ou na
-- edição em massa) antes de enviar.
ALTER TABLE public.pagamentos_dda ADD COLUMN IF NOT EXISTS conta_pagamento TEXT;

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
