-- ============================================================
-- MIGRAÇÃO 031: REMOVER ISOLAMENTO DE EMPRESAS POR USUÁRIO (BPO COMPARTILHADO)
-- Cole este conteúdo inteiro no SQL Editor do Supabase e clique em RUN
-- ============================================================

-- 1. Tabela: empresas
DROP POLICY IF EXISTS "usuarios_veem_suas_empresas" ON public.empresas;
CREATE POLICY "usuarios_veem_suas_empresas" ON public.empresas 
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "usuarios_atualizam_suas_empresas" ON public.empresas;
CREATE POLICY "usuarios_atualizam_suas_empresas" ON public.empresas 
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "usuarios_inserem_empresas" ON public.empresas;
CREATE POLICY "usuarios_inserem_empresas" ON public.empresas 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "usuarios_deletam_suas_empresas" ON public.empresas;
CREATE POLICY "usuarios_deletam_suas_empresas" ON public.empresas 
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- 2. Tabela: contas_pagar_importadas
DROP POLICY IF EXISTS "contas_pagar_por_empresa" ON public.contas_pagar_importadas;
CREATE POLICY "contas_pagar_por_empresa" ON public.contas_pagar_importadas 
  FOR ALL USING (auth.uid() IS NOT NULL);


-- 3. Tabela: importacoes
DROP POLICY IF EXISTS "importacoes_por_empresa" ON public.importacoes;
CREATE POLICY "importacoes_por_empresa" ON public.importacoes 
  FOR ALL USING (auth.uid() IS NOT NULL);


-- 4. Tabela: logs_integracao
DROP POLICY IF EXISTS "logs_por_empresa" ON public.logs_integracao;
CREATE POLICY "logs_por_empresa" ON public.logs_integracao 
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- 5. Tabela: fornecedores_contaazul
DROP POLICY IF EXISTS "usuarios_veem_fornecedores_da_empresa" ON public.fornecedores_contaazul;
CREATE POLICY "usuarios_veem_fornecedores_da_empresa" ON public.fornecedores_contaazul 
  FOR ALL USING (auth.uid() IS NOT NULL);


-- 6. Tabela: fornecedor_depara
DROP POLICY IF EXISTS "depara_select" ON public.fornecedor_depara;
CREATE POLICY "depara_select" ON public.fornecedor_depara
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "depara_insert" ON public.fornecedor_depara;
CREATE POLICY "depara_insert" ON public.fornecedor_depara
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "depara_update" ON public.fornecedor_depara;
CREATE POLICY "depara_update" ON public.fornecedor_depara
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "depara_delete" ON public.fornecedor_depara;
CREATE POLICY "depara_delete" ON public.fornecedor_depara
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- 7. Tabela: vendas_importadas
DROP POLICY IF EXISTS "vendas_por_empresa" ON public.vendas_importadas;
CREATE POLICY "vendas_por_empresa" ON public.vendas_importadas 
  FOR ALL USING (auth.uid() IS NOT NULL);


-- 8. Tabela: agendamentos
DROP POLICY IF EXISTS "agendamentos_por_empresa" ON public.agendamentos;
CREATE POLICY "agendamentos_por_empresa" ON public.agendamentos 
  FOR ALL USING (auth.uid() IS NOT NULL);


-- 9. Tabela: logs_agendamento
DROP POLICY IF EXISTS "logs_agendamento_por_empresa" ON public.logs_agendamento;
CREATE POLICY "logs_agendamento_por_empresa" ON public.logs_agendamento 
  FOR ALL USING (auth.uid() IS NOT NULL);


-- 10. Tabela: empresa_config_fiscal
DROP POLICY IF EXISTS "Acesso as configuracoes da propria empresa" ON public.empresa_config_fiscal;
CREATE POLICY "Acesso as configuracoes da propria empresa" ON public.empresa_config_fiscal
  FOR ALL USING (auth.uid() IS NOT NULL);
