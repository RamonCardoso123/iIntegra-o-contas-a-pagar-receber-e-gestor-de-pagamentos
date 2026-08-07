-- ==============================================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS: GESTÃO DE PAGAMENTOS
-- ==============================================================================

-- 1. TABELA DE AGENDAMENTOS (Inclui Folha, Recibos, etc)
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    fornecedor TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'PIX', 'Boleto', 'Folha', 'Outros'
    valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
    data_vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'pago'
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
    status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'pago'
    data_lancamento TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. POLÍTICAS DE SEGURANÇA (RLS)
-- Como é um app interno, vamos habilitar RLS mas permitir acesso total 
-- (autenticação será controlada pelo Next.js)
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_dda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access agendamentos" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access pagamentos_dda" ON public.pagamentos_dda FOR ALL USING (true) WITH CHECK (true);
