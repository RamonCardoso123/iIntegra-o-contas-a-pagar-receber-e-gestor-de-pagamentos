-- ============================================================
-- MIGRAÇÃO 020: Tabelas para Gestão de Pagamentos
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- 1. TABELA DE AGENDAMENTOS (Inclui Folha, Recibos, Transferências)
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    fornecedor TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'PIX', 'Boleto', 'Folha', 'Transferência', 'Imposto', 'TED', 'Outros'
    valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
    data_vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'pago', 'enviado_ca'
    descricao TEXT,
    chave_pix TEXT,
    cpf_cnpj TEXT,
    categoria TEXT,
    conta_pagamento TEXT,
    anexo_url TEXT,
    data_lancamento TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE DDA (Débito Direto Autorizado)
CREATE TABLE IF NOT EXISTS public.pagamentos_dda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    beneficiario TEXT NOT NULL,
    documento TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
    data_vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'pago', 'enviado_ca'
    data_lancamento TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa_id ON public.agendamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_vencimento ON public.agendamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_dda_empresa_id ON public.pagamentos_dda(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_dda_data_vencimento ON public.pagamentos_dda(data_vencimento);

-- 4. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_dda ENABLE ROW LEVEL SECURITY;

-- Permitir acesso total (autenticação controlada pelo Next.js)
CREATE POLICY "Allow all access agendamentos" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access pagamentos_dda" ON public.pagamentos_dda FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
