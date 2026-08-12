-- ============================================================
-- MIGRAÇÃO 023: Grupos (Gestão de Pagamentos)
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- 1. Tabela de grupos (ex: "Grupo do Seu Zé", com várias lojas dentro)
CREATE TABLE IF NOT EXISTS public.grupos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Cada empresa (loja) pode pertencer a um grupo. Fica NULL até o
-- usuário adicionar a loja a algum grupo pela tela "Nova Loja".
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES public.grupos(id) ON DELETE SET NULL;

-- 3. Políticas de segurança (mesmo padrão "Allow all" já usado no resto
-- do app — autenticação é controlada pelo Next.js, não pelo Supabase Auth)
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access grupos" ON public.grupos;
CREATE POLICY "Allow all access grupos" ON public.grupos FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
