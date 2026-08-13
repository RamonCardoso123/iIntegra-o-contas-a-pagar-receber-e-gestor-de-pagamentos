-- ============================================================
-- MIGRAÇÃO 028: Ordem das lojas dentro do grupo (ordem de entrada)
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- Guarda quando a loja foi colocada no grupo — pra sempre mostrar as
-- lojas na ordem em que foram adicionadas (primeira colocada aparece
-- primeiro), em vez de ordem alfabética.
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS grupo_adicionado_em TIMESTAMPTZ;

-- Preenche as lojas que JÁ estão em algum grupo hoje, usando a data de
-- cadastro da empresa como melhor estimativa da ordem original (só pra
-- quem ainda não tem essa data registrada). Lojas adicionadas a partir de
-- agora já vão gravar a data certa na hora de entrar no grupo.
UPDATE public.empresas
SET grupo_adicionado_em = created_at
WHERE grupo_id IS NOT NULL AND grupo_adicionado_em IS NULL;

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
