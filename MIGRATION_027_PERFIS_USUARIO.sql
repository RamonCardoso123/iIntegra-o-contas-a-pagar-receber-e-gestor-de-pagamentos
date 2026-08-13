-- ============================================================
-- MIGRAÇÃO 027: Perfil pessoal por usuário (cor de destaque + nome)
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================================

-- Guarda a preferência de cada USUÁRIO que loga no sistema (não é por
-- empresa/loja) — assim, se a conta X escolher azul, sempre que ela logar
-- (em qualquer navegador) vai continuar azul, e a conta Y pode ter a cor
-- dela (rosa, verde etc.) sem misturar uma com a outra.
CREATE TABLE IF NOT EXISTS public.perfis_usuario (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_exibicao TEXT,
  accent_color TEXT NOT NULL DEFAULT 'violet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perfis_usuario ENABLE ROW LEVEL SECURITY;

-- Cada usuário só enxerga/edita o próprio perfil (mesmo padrão já usado
-- em usuarios_empresas: user_id = auth.uid()).
DROP POLICY IF EXISTS "perfis_usuario_select_own" ON public.perfis_usuario;
CREATE POLICY "perfis_usuario_select_own" ON public.perfis_usuario
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "perfis_usuario_insert_own" ON public.perfis_usuario;
CREATE POLICY "perfis_usuario_insert_own" ON public.perfis_usuario
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "perfis_usuario_update_own" ON public.perfis_usuario;
CREATE POLICY "perfis_usuario_update_own" ON public.perfis_usuario
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- FIM! Se aparecer "Success" está tudo certo!
-- ============================================================
