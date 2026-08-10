-- ============================================================
-- MIGRAÇÃO 020: Corrigir tabela agendamentos + criar pagamentos_dda
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- 0. REMOVER RESTRIÇÕES ANTIGAS
-- Como a tabela já existia e pode ter um "check constraint" limitando os tipos, vamos remover:
ALTER TABLE public.agendamentos DROP CONSTRAINT IF EXISTS agendamentos_tipo_check;

-- 1. ADICIONAR COLUNAS FALTANDO NA TABELA agendamentos (que já existe)
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS fornecedor TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS valor NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto';
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS chave_pix TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS conta_pagamento TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS anexo_url TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS competencia TEXT;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS data_lancamento TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. TABELA DE DDA (Débito Direto Autorizado)
CREATE TABLE IF NOT EXISTS public.pagamentos_dda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    beneficiario TEXT NOT NULL,
    documento TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
    data_vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    data_lancamento TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas no pagamentos_dda caso já exista
ALTER TABLE public.pagamentos_dda ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE public.pagamentos_dda ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto';
ALTER TABLE public.pagamentos_dda ADD COLUMN IF NOT EXISTS data_lancamento TIMESTAMPTZ DEFAULT now();

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa_id ON public.agendamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_vencimento ON public.agendamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_dda_empresa_id ON public.pagamentos_dda(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_dda_data_vencimento ON public.pagamentos_dda(data_vencimento);

-- 4. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_dda ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem (evita erro de duplicata)
DROP POLICY IF EXISTS "Allow all access agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Allow all access pagamentos_dda" ON public.pagamentos_dda;

-- Criar policies
CREATE POLICY "Allow all access agendamentos" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access pagamentos_dda" ON public.pagamentos_dda FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
