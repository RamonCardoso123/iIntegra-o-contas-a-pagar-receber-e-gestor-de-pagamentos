"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Trash2, Upload, Search, Calendar, RefreshCw, ChevronDown,
  ArrowRightLeft, Sparkles, Edit2, X, Paperclip, FileText, Send
} from 'lucide-react'
import toast from 'react-hot-toast'
import ModalAgendamento from '@/components/agendamento/ModalAgendamento'
import ModalTransferencia from '@/components/agendamento/ModalTransferencia'
import ModalDetalhesLancamentos from '@/components/agendamento/ModalDetalhesLancamentos'
import ModalTransferirLancamento from '@/components/agendamento/ModalTransferirLancamento'
import ModalEdicaoEmMassa from '@/components/agendamento/ModalEdicaoEmMassa'
import InputMoeda from '@/components/ui/InputMoeda'
import SelectorCategoria from '@/components/upload/SelectorCategoria'
import SelectorContaFinanceira, { ContaFinanceiraOpcao } from '@/components/upload/SelectorContaFinanceira'
import SelectorFornecedor from '@/components/upload/SelectorFornecedor'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { Empresa } from '@/types'

interface LojaCardProps {
  empresa: Empresa
  lojasDoGrupo: Empresa[]
  /** Muda sempre que uma transferência acontece em QUALQUER loja do
   * grupo, pra esse card recarregar mesmo se a movimentação não foi
   * feita por ele (ex: ele é o destino de uma transferência de outro). */
  refreshTick?: number
  /** Avisa a página do grupo que uma transferência aconteceu aqui, pra
   * ela recarregar todos os outros cards também. */
  onTransferenciaGlobal?: () => void
}

export default function LojaCard({ empresa, lojasDoGrupo, refreshTick, onTransferenciaGlobal }: LojaCardProps) {
  const supabase = createClient()
  const router = useRouter()
  const { setEmpresaAtiva } = useEmpresa()
  const hoje = new Date().toISOString().split('T')[0]
  const [dataInicio, setDataInicio] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)

  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)

  const [modalFolhaAberto, setModalFolhaAberto] = useState(false)
  const [arquivoFolha, setArquivoFolha] = useState<File | null>(null)
  const [vencimentoFolha, setVencimentoFolha] = useState(hoje)

  const [menuImportarAberto, setMenuImportarAberto] = useState(false)
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false)
  const [modalTransferenciaAberto, setModalTransferenciaAberto] = useState(false)

  // Modal de edição rápida
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [itemEditando, setItemEditando] = useState<any>(null)

  const [modalDetalhesDda, setModalDetalhesDda] = useState(false)
  const [modalDetalhesFolha, setModalDetalhesFolha] = useState(false)
  const [editandoCategoriaEdicao, setEditandoCategoriaEdicao] = useState(false)
  const [editandoContaEdicao, setEditandoContaEdicao] = useState(false)
  const [editandoFornecedorEdicao, setEditandoFornecedorEdicao] = useState(false)
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceiraOpcao[]>([])

  // Lista de contas do Conta Azul pra buscar por nome (evita digitar
  // errado e não bater na hora de enviar) — usada na edição individual e
  // na edição em massa de DDA/Folha.
  useEffect(() => {
    fetch(`/api/conta-azul/contas-financeiras?empresa_id=${empresa.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.contas && Array.isArray(data.contas)) setContasFinanceiras(data.contas)
      })
      .catch(() => {
        // Sem conexão com o Conta Azul (ou token expirado) — os campos
        // continuam funcionando, só sem sugestões automáticas.
      })
  }, [empresa.id])

  // Transferir lançamento(s) de DDA/Folha pra outra loja (o item sai da
  // origem e passa a pertencer ao destino) — diferente da Transferência
  // de saldo, aqui é o boleto/funcionário que estava na loja errada.
  const [modalTransferirAberto, setModalTransferirAberto] = useState(false)
  const [itensParaTransferir, setItensParaTransferir] = useState<any[]>([])
  const [transferindoLancamento, setTransferindoLancamento] = useState(false)

  // Edição em massa de Categoria/Competência (ex: DDA importado sem
  // categoria, que bloqueia o envio pro Contas a Pagar).
  const [modalEdicaoMassaAberto, setModalEdicaoMassaAberto] = useState(false)
  const [itensEdicaoMassa, setItensEdicaoMassa] = useState<any[]>([])
  const [salvandoEdicaoMassa, setSalvandoEdicaoMassa] = useState(false)

  const [periodoAtivo, setPeriodoAtivo] = useState('hoje')
  const [menuPeriodoAberto, setMenuPeriodoAberto] = useState(false)

  const [saldoCaixa, setSaldoCaixa] = useState<number>(Number(empresa.saldo_caixa) || 0)
  const [saldoCaixaPendente, setSaldoCaixaPendente] = useState<number>(Number(empresa.saldo_caixa) || 0)
  const [salvandoSaldo, setSalvandoSaldo] = useState(false)

  useEffect(() => {
    const v = Number(empresa.saldo_caixa) || 0
    setSaldoCaixa(v)
    setSaldoCaixaPendente(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa.id, empresa.saldo_caixa])

  async function handleSalvarSaldoCaixa() {
    if (saldoCaixaPendente === saldoCaixa) return
    setSalvandoSaldo(true)
    try {
      const { error } = await supabase.from('empresas').update({ saldo_caixa: saldoCaixaPendente }).eq('id', empresa.id)
      if (error) throw error
      setSaldoCaixa(saldoCaixaPendente)
      toast.success('Saldo em caixa atualizado!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar saldo em caixa')
      setSaldoCaixaPendente(saldoCaixa)
    } finally {
      setSalvandoSaldo(false)
    }
  }

  useEffect(() => {
    carregarPagamentos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa.id, dataInicio, dataFim, refreshTick])

  const OPCOES_PERIODO: { key: string; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes', label: 'Este mês' },
    { key: 'ano', label: 'Este ano' },
    { key: '30dias', label: 'Últimos 30 dias' },
    { key: '12meses', label: 'Últimos 12 meses' },
    { key: 'tudo', label: 'Todo o período' },
    { key: 'personalizado', label: 'Período personalizado' },
  ]

  function fmtISO(d: Date) {
    return d.toISOString().split('T')[0]
  }

  function aplicarPeriodo(key: string) {
    if (key === 'personalizado') {
      setPeriodoAtivo(key)
      setMenuPeriodoAberto(false)
      return
    }

    const agora = new Date()
    let novoInicio = dataInicio
    let novoFim = dataFim

    if (key === 'hoje') {
      novoInicio = novoFim = fmtISO(agora)
    } else if (key === 'semana') {
      const diaSemana = agora.getDay() // 0 = domingo
      const diff = diaSemana === 0 ? -6 : 1 - diaSemana
      const seg = new Date(agora)
      seg.setDate(agora.getDate() + diff)
      const dom = new Date(seg)
      dom.setDate(seg.getDate() + 6)
      novoInicio = fmtISO(seg)
      novoFim = fmtISO(dom)
    } else if (key === 'mes') {
      novoInicio = fmtISO(new Date(agora.getFullYear(), agora.getMonth(), 1))
      novoFim = fmtISO(new Date(agora.getFullYear(), agora.getMonth() + 1, 0))
    } else if (key === 'ano') {
      novoInicio = fmtISO(new Date(agora.getFullYear(), 0, 1))
      novoFim = fmtISO(new Date(agora.getFullYear(), 11, 31))
    } else if (key === '30dias') {
      const passado = new Date(agora)
      passado.setDate(agora.getDate() - 30)
      novoInicio = fmtISO(passado)
      novoFim = fmtISO(agora)
    } else if (key === '12meses') {
      const passado = new Date(agora)
      passado.setFullYear(agora.getFullYear() - 1)
      novoInicio = fmtISO(passado)
      novoFim = fmtISO(agora)
    } else if (key === 'tudo') {
      novoInicio = '2000-01-01'
      novoFim = '2099-12-31'
    }

    setDataInicio(novoInicio)
    setDataFim(novoFim)
    setPeriodoAtivo(key)
    setMenuPeriodoAberto(false)
  }

  function labelPeriodoAtivo() {
    // Sempre mostra a data efetiva no botão (ex: "13/08/2026"), não o
    // nome do preset — clicar em "Hoje" deve trocar a escrita pela data.
    return dataInicio === dataFim
      ? dataInicio.split('-').reverse().join('/')
      : `${dataInicio.split('-').reverse().join('/')} até ${dataFim.split('-').reverse().join('/')}`
  }

  async function carregarPagamentos() {
    setCarregando(true)

    const { data: ddas } = await supabase
      .from('pagamentos_dda')
      .select('*')
      .eq('empresa_id', empresa.id)
      .gte('data_vencimento', dataInicio)
      .lte('data_vencimento', dataFim)

    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('empresa_id', empresa.id)
      .gte('data_vencimento', dataInicio)
      .lte('data_vencimento', dataFim)

    const unificados = [
      ...(ddas || []).map(d => ({ ...d, origem: 'DDA' })),
      ...(agendamentos || []).map(f => ({
        ...f,
        origem: f.tipo === 'Transferência'
          ? 'Transferência'
          : f.tipo === 'Transferência Recebida'
          ? 'Transferência Recebida'
          : (f.tipo?.includes('Folha') ? 'Folha' : 'Agendamento')
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setPagamentos(unificados)
    setCarregando(false)
  }

  async function handleImportarArquivo(e: React.ChangeEvent<HTMLInputElement>, tipo: 'dda' | 'folha') {
    const file = e.target.files?.[0]
    if (!file) return

    if (tipo === 'folha') {
      setArquivoFolha(file)
      setMenuImportarAberto(false)
      setModalFolhaAberto(true)
      return
    }

    await processarArquivo(file, 'dda')
  }

  async function processarArquivo(file: File, tipo: 'dda' | 'folha', vencimentoEspecifico?: string) {
    setImportando(true)
    toast.loading('Extraindo dados do arquivo...', { id: `import-${empresa.id}` })
    setMenuImportarAberto(false)
    setModalFolhaAberto(false)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tipo', tipo)

    try {
      const res = await fetch('/api/conversor', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erro na conversão')

      const extraidos = data.dados
      if (!extraidos || !Array.isArray(extraidos)) throw new Error('Formato retornado inválido')

      let count = 0
      for (const item of extraidos) {
        if (tipo === 'dda') {
          await supabase.from('pagamentos_dda').insert({
            empresa_id: empresa.id,
            beneficiario: item.beneficiario,
            documento: item.documento,
            valor: parseFloat(String(item.valor).replace(',', '.')),
            data_vencimento: item.data_vencimento || dataInicio,
            // Categoria padrão do DDA — o usuário troca depois se algum
            // boleto específico for de outra categoria.
            categoria: 'Materiais para Revenda'
          })
        } else {
          let competencia = ''
          if (vencimentoEspecifico && data.tipoCalculo) {
            const [ano, mes, dia] = vencimentoEspecifico.split('-')
            const dateVenc = new Date(Number(ano), Number(mes) - 1, Number(dia))
            if (data.tipoCalculo === 'Folha Mensal') {
              dateVenc.setMonth(dateVenc.getMonth() - 1)
              competencia = dateVenc.toISOString().split('T')[0]
            } else if (data.tipoCalculo === 'Adiantamento') {
              dateVenc.setMonth(dateVenc.getMonth() + 1)
              dateVenc.setDate(1)
              competencia = dateVenc.toISOString().split('T')[0]
            }
          }

          const ehAdiantamento = (item.tipo || data.tipoCalculo) === 'Adiantamento'

          await supabase.from('agendamentos').insert({
            empresa_id: empresa.id,
            fornecedor: item.fornecedor,
            tipo: item.tipo || data.tipoCalculo || 'Folha',
            categoria: ehAdiantamento ? 'Adiantamento Salarial' : 'Salários',
            valor: parseFloat(String(item.valor).replace(',', '.')),
            data_vencimento: vencimentoEspecifico || dataInicio,
            // Descrição acompanha a categoria (em vez do texto fixo "Folha
            // Mensal" que a IA sempre devolvia, independente do tipo).
            descricao: ehAdiantamento ? 'Adiantamento Salarial' : 'Salário',
            cpf_cnpj: item.cpf_cnpj,
            competencia: competencia
          })
        }
        count++
      }

      toast.success(`${count} pagamento(s) extraído(s) e salvo(s) com sucesso!`, { id: `import-${empresa.id}` })
      carregarPagamentos()
    } catch (err: any) {
      toast.error(err.message, { id: `import-${empresa.id}` })
    } finally {
      setImportando(false)
      const inputs = document.querySelectorAll(`input[type="file"][data-loja="${empresa.id}"]`)
      inputs.forEach(input => (input as HTMLInputElement).value = '')
    }
  }

  async function handleLimparRegistrosDoDia() {
    if (!confirm('Deseja excluir TODOS os registros de pagamentos deste período filtrado? Essa ação não pode ser desfeita.')) return

    toast.loading('Limpando registros...', { id: `delete-${empresa.id}` })
    try {
      await supabase.from('pagamentos_dda').delete().eq('empresa_id', empresa.id).gte('data_vencimento', dataInicio).lte('data_vencimento', dataFim)
      await supabase.from('agendamentos').delete().eq('empresa_id', empresa.id).gte('data_vencimento', dataInicio).lte('data_vencimento', dataFim)

      toast.success('Registros excluídos!', { id: `delete-${empresa.id}` })
      carregarPagamentos()
    } catch (e) {
      toast.error('Erro ao excluir registros.', { id: `delete-${empresa.id}` })
    }
  }

  // Transferência Recebida é uma entrada de caixa (crédito na loja de
  // destino), não uma despesa — por isso fica fora do Total Despesas e
  // soma no Entradas.
  const totalDespesas = pagamentos.filter(p => p.origem !== 'Transferência Recebida').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const totalEntradas = pagamentos.filter(p => p.origem === 'Transferência Recebida').reduce((acc, curr) => acc + Number(curr.valor), 0)
  // Usa o valor que está sendo digitado (saldoCaixaPendente), não só o
  // último salvo, pra o Saldo Final Estimado somar em tempo real
  // enquanto o usuário digita — sem precisar clicar fora do campo.
  const saldoFinalEstimado = saldoCaixaPendente + totalEntradas - totalDespesas

  const pagamentosDda = pagamentos.filter(p => p.origem === 'DDA')
  const pagamentosFolha = pagamentos.filter(p => p.origem === 'Folha' || p.tipo === 'Folha' || p.tipo === 'Folha Mensal' || p.tipo === 'Adiantamento')
  // Transferência Recebida não entra na tabela principal (ela não é uma
  // despesa/saída) — só conta no número de Entradas (Transf) lá embaixo.
  // Pra gerenciar/excluir uma transferência, isso é feito pelo lado da
  // loja de origem, onde ela aparece como Transferência (saída).
  // Ordem fixa dentro da tabela: DDA, Folha (linhas de resumo acima) e
  // aqui embaixo Agendamento primeiro, Transferência sempre por último —
  // o sort é estável, então dentro de cada grupo mantém a ordem por data.
  const pagamentosIndividuais = pagamentos
    .filter(p => p.origem !== 'DDA' && p.origem !== 'Folha' && p.origem !== 'Transferência Recebida' && !p.tipo?.includes('Folha') && p.tipo !== 'Adiantamento')
    .sort((a, b) => (a.origem === 'Transferência' ? 1 : 0) - (b.origem === 'Transferência' ? 1 : 0))

  function situacaoDoGrupo(itens: any[]) {
    if (itens.length === 0) {
      return { label: '—', classe: 'bg-dark-700/50 text-dark-300 border-dark-600' }
    }
    const agendados = itens.filter(i => i.status === 'agendado').length
    if (agendados === 0) {
      return { label: 'EM ABERTO', classe: 'bg-amber-500/10 text-amber-500 border-amber-500/20' }
    }
    if (agendados === itens.length) {
      return { label: 'AGENDADO', classe: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' }
    }
    return { label: 'PARCIAL', classe: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
  }

  const situacaoDda = situacaoDoGrupo(pagamentosDda)
  const situacaoFolha = situacaoDoGrupo(pagamentosFolha)

  // Mostra a categoria real dos lançamentos do grupo — se todos tiverem a
  // mesma categoria, mostra ela; se tiver mais de uma diferente, mostra
  // "Diverso" em vez de um texto fixo que não reflete os dados de verdade.
  function categoriaDoGrupo(itens: any[]) {
    if (itens.length === 0) return '—'
    const categorias = new Set(itens.map(i => i.categoria || '—'))
    return categorias.size === 1 ? Array.from(categorias)[0] : 'Diverso'
  }

  const categoriaDda = categoriaDoGrupo(pagamentosDda)
  const categoriaFolha = categoriaDoGrupo(pagamentosFolha)

  const handleExcluirEmLote = async (ids: string[]) => {
    if (!confirm(`Excluir ${ids.length} lançamento(s)?`)) return
    toast.loading('Excluindo...', { id: `delete_lote-${empresa.id}` })
    try {
      // Se algum dos itens selecionados for uma ponta de Transferência,
      // exclui a outra ponta (na loja destino/origem) junto, senão fica
      // um lançamento "fantasma" que não sai nunca mais sozinho.
      const transferenciaIds = ids
        .map(id => pagamentos.find(p => p.id === id)?.transferencia_id)
        .filter((v): v is string => Boolean(v))

      await supabase.from('pagamentos_dda').delete().in('id', ids)
      await supabase.from('agendamentos').delete().in('id', ids)
      if (transferenciaIds.length > 0) {
        await supabase.from('agendamentos').delete().in('transferencia_id', transferenciaIds)
      }

      toast.success('Excluídos com sucesso', { id: `delete_lote-${empresa.id}` })
      carregarPagamentos()
      setModalDetalhesDda(false)
      setModalDetalhesFolha(false)
      if (transferenciaIds.length > 0) onTransferenciaGlobal?.()
    } catch (e) {
      toast.error('Erro ao excluir', { id: `delete_lote-${empresa.id}` })
    }
  }

  const handleAgendarEmLote = async (ids: string[]) => {
    if (!confirm(`Deseja alterar ${ids.length} itens para AGENDADO?`)) return
    try {
      await supabase.from('pagamentos_dda').update({ status: 'agendado' }).in('id', ids)
      await supabase.from('agendamentos').update({ status: 'agendado' }).in('id', ids)
      toast.success('Status atualizado para Agendado!')
      carregarPagamentos()
    } catch (e) {
      toast.error('Erro ao atualizar')
    }
  }

  const handleVoltarAbertoEmLote = async (ids: string[]) => {
    if (!confirm(`Deseja alterar ${ids.length} itens para EM ABERTO?`)) return
    try {
      await supabase.from('pagamentos_dda').update({ status: 'aberto' }).in('id', ids)
      await supabase.from('agendamentos').update({ status: 'aberto' }).in('id', ids)
      toast.success('Status atualizado para Em Aberto!')
      carregarPagamentos()
    } catch (e) {
      toast.error('Erro ao atualizar')
    }
  }

  const toggleStatus = async (item: any) => {
    const novoStatus = item.status === 'agendado' ? 'aberto' : 'agendado'
    const tabela = item.origem === 'DDA' ? 'pagamentos_dda' : 'agendamentos'

    setPagamentos(prev => prev.map(p => p.id === item.id ? { ...p, status: novoStatus } : p))

    try {
      await supabase.from(tabela).update({ status: novoStatus }).eq('id', item.id)
    } catch (e) {
      toast.error('Erro ao atualizar status')
      carregarPagamentos()
    }
  }

  const handleExcluirIndividual = async (id: string, origem: string) => {
    if (!confirm('Deseja excluir este lançamento?')) return
    const tabela = origem === 'DDA' ? 'pagamentos_dda' : 'agendamentos'
    try {
      // Se for uma ponta de Transferência, exclui a outra ponta junto
      // (na loja de origem ou destino), senão ela fica "fantasma" lá.
      const transferenciaId = pagamentos.find(p => p.id === id)?.transferencia_id
      if (transferenciaId) {
        await supabase.from('agendamentos').delete().eq('transferencia_id', transferenciaId)
      } else {
        await supabase.from(tabela).delete().eq('id', id)
      }
      toast.success('Excluído!')
      carregarPagamentos()
      if (transferenciaId) onTransferenciaGlobal?.()
    } catch (e) {
      toast.error('Erro ao excluir')
    }
  }

  // Envia 1 ou mais lançamentos (DDA, Folha ou Agendamento) pra fila do
  // Contas a Pagar (contas_pagar_importadas) e abre a tela de Contas a
  // Pagar já com a empresa certa selecionada, pra o usuário encaminhar
  // pro Conta Azul por lá. Não altera/remove/marca nada aqui na Gestão
  // de Pagamentos — os dois lugares são independentes.
  const handleEnviarParaContasAPagar = async (itensSelecionados: any[]) => {
    if (itensSelecionados.length === 0) return

    // Transferência entre lojas não é uma conta a pagar de fornecedor —
    // não faz sentido nesse fluxo, então é ignorada silenciosamente.
    const itensValidos = itensSelecionados.filter(i => i.origem !== 'Transferência' && i.origem !== 'Transferência Recebida')

    if (itensValidos.length === 0) {
      toast.error('Transferências não podem ser enviadas para o Contas a Pagar.')
      return
    }

    const semCategoria = itensValidos.filter(i => !i.categoria)
    if (semCategoria.length > 0) {
      toast.error(`Preencha a Categoria de ${semCategoria.length} lançamento(s) antes de enviar (clique em editar).`)
      return
    }

    try {
      const linhas = itensValidos.map(item => ({
        empresa_id: empresa.id,
        fornecedor: String(item.fornecedor || item.beneficiario || '').trim(),
        valor: Number(item.valor),
        vencimento: item.data_vencimento,
        categoria: item.categoria,
        // Se não tiver descrição preenchida (comum no DDA importado),
        // usa "Doc: X" como no restante do app, em vez de mandar vazio.
        descricao: item.descricao || (item.documento ? `Doc: ${item.documento}` : null),
        doc: item.documento || `GP-${String(item.id).slice(0, 8)}`,
        emissao: item.competencia || item.data_vencimento,
        conta_financeira: item.conta_pagamento || null,
        status: 'pendente',
      }))

      const { error } = await supabase
        .from('contas_pagar_importadas')
        .upsert(linhas, {
          onConflict: 'empresa_id,fornecedor,valor,vencimento,doc',
          ignoreDuplicates: true,
        })

      if (error) throw error

      toast.success(`${linhas.length} lançamento(s) enviado(s) para o Contas a Pagar!`)
      setEmpresaAtiva(empresa)
      router.push('/contas-pagar')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar para o Contas a Pagar')
    }
  }

  function abrirModalTransferir(itens: any[]) {
    if (itens.length === 0) return
    setItensParaTransferir(itens)
    setModalTransferirAberto(true)
  }

  // Move de verdade o(s) lançamento(s) pra outra loja (troca o
  // empresa_id) — usado quando um boleto do DDA ou um funcionário da
  // Folha caiu na loja errada. Não sobra nada na loja de origem.
  const handleConfirmarTransferirLancamentos = async (destinoId: string) => {
    const ids = itensParaTransferir.map(i => i.id)
    if (ids.length === 0) return
    setTransferindoLancamento(true)
    try {
      await supabase.from('pagamentos_dda').update({ empresa_id: destinoId }).in('id', ids)
      await supabase.from('agendamentos').update({ empresa_id: destinoId }).in('id', ids)

      toast.success(`${ids.length} lançamento(s) transferido(s) para a outra loja!`)
      setModalTransferirAberto(false)
      setItensParaTransferir([])
      setModalDetalhesDda(false)
      setModalDetalhesFolha(false)
      carregarPagamentos()
      // A loja de destino também precisa recarregar pra mostrar os itens
      // que acabou de receber — reaproveita o mesmo mecanismo global já
      // usado pela Transferência de saldo.
      onTransferenciaGlobal?.()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao transferir lançamento(s)')
    } finally {
      setTransferindoLancamento(false)
    }
  }

  function abrirEdicaoEmMassa(itens: any[]) {
    if (itens.length === 0) return
    setItensEdicaoMassa(itens)
    setModalEdicaoMassaAberto(true)
  }

  // Aplica Categoria e/ou Competência a vários lançamentos de uma vez —
  // pensado pro caso do DDA importado sem categoria, que bloqueava o
  // envio pro Contas a Pagar item por item.
  const handleConfirmarEdicaoEmMassa = async (dados: { categoria?: string; competencia?: string; contaPagamento?: string }) => {
    const payload: Record<string, string> = {}
    if (dados.categoria) payload.categoria = dados.categoria
    if (dados.competencia) payload.competencia = dados.competencia
    if (dados.contaPagamento) payload.conta_pagamento = dados.contaPagamento
    if (Object.keys(payload).length === 0) return

    const ids = itensEdicaoMassa.map(i => i.id)
    if (ids.length === 0) return

    // Os itens de um mesmo modal (DDA ou Folha) são sempre do mesmo tipo,
    // então dá pra decidir a tabela olhando só o primeiro.
    const tabela = itensEdicaoMassa[0]?.origem === 'DDA' ? 'pagamentos_dda' : 'agendamentos'

    setSalvandoEdicaoMassa(true)
    try {
      const { error } = await supabase.from(tabela).update(payload).in('id', ids)
      if (error) throw error

      toast.success(`${ids.length} lançamento(s) atualizado(s)!`)
      setModalEdicaoMassaAberto(false)
      setItensEdicaoMassa([])
      carregarPagamentos()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar em massa')
    } finally {
      setSalvandoEdicaoMassa(false)
    }
  }

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemEditando) return
    const ehDda = itemEditando.origem === 'DDA'
    const tabela = ehDda ? 'pagamentos_dda' : 'agendamentos'

    if (!itemEditando.categoria) {
      toast.error('Preencha a Categoria.')
      return
    }
    const valorNumerico = Number(itemEditando.valor) || 0
    if (ehDda && (!itemEditando.beneficiario || !itemEditando.data_vencimento || !valorNumerico)) {
      toast.error('Preencha Beneficiário, Vencimento e Valor.')
      return
    }
    if (!ehDda && (!itemEditando.fornecedor || !itemEditando.data_vencimento || !valorNumerico)) {
      toast.error('Preencha Fornecedor, Vencimento e Valor.')
      return
    }

    try {
      const payload = ehDda
        ? {
            beneficiario: itemEditando.beneficiario,
            documento: itemEditando.documento,
            categoria: itemEditando.categoria,
            descricao: itemEditando.descricao,
            conta_pagamento: itemEditando.conta_pagamento,
            valor: valorNumerico,
            data_vencimento: itemEditando.data_vencimento,
            competencia: itemEditando.competencia || null,
            status: itemEditando.status,
          }
        : {
            fornecedor: itemEditando.fornecedor,
            tipo: itemEditando.tipo,
            categoria: itemEditando.categoria,
            descricao: itemEditando.descricao,
            valor: valorNumerico,
            data_vencimento: itemEditando.data_vencimento,
            competencia: itemEditando.competencia,
            conta_pagamento: itemEditando.conta_pagamento,
            chave_pix: itemEditando.chave_pix,
            cpf_cnpj: itemEditando.cpf_cnpj,
            status: itemEditando.status,
          }

      const { error } = await supabase.from(tabela).update(payload).eq('id', itemEditando.id)
      if (error) throw error

      toast.success('Atualizado com sucesso!')
      setModalEdicaoAberto(false)
      carregarPagamentos()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar')
    }
  }

  return (
    <div className="bg-[#11141c] border border-dark-700 rounded-2xl overflow-hidden shadow-2xl">

      <div className="p-6 border-b border-dark-700 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            {empresa.nome}
          </h2>
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            <Calendar size={12} className="text-amber-500" />
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
              Filtrado: {dataInicio === dataFim
                ? dataInicio.split('-').reverse().join('/')
                : `${dataInicio.split('-').reverse().join('/')} até ${dataFim.split('-').reverse().join('/')}`}
            </span>
          </div>
          <button onClick={handleLimparRegistrosDoDia} className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-800 text-dark-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
            <Trash2 size={16} />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuPeriodoAberto(!menuPeriodoAberto)}
              className="flex items-center gap-2 bg-dark-800 border border-dark-600 hover:bg-dark-700 text-white rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors min-w-[160px] justify-between"
            >
              <span className="flex items-center gap-2">
                <Calendar size={14} className="text-dark-400" />
                {labelPeriodoAtivo()}
              </span>
              <ChevronDown size={14} className={menuPeriodoAberto ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {menuPeriodoAberto && (
              <div className="absolute top-full mt-2 left-0 w-52 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                {OPCOES_PERIODO.map(op => (
                  <button
                    key={op.key}
                    onClick={() => aplicarPeriodo(op.key)}
                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
                      periodoAtivo === op.key ? 'bg-blue-600 text-white' : 'text-dark-200 hover:bg-dark-700'
                    } ${op.key === 'personalizado' ? 'border-t border-dark-700' : ''}`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {periodoAtivo === 'personalizado' && (
            <div className="flex items-center gap-3 animate-fade-in">
              <input
                type="date"
                value={dataInicio}
                onChange={e => {
                  const novaDataInicio = e.target.value
                  setDataInicio(novaDataInicio)
                  if (dataFim < novaDataInicio) setDataFim(novaDataInicio)
                }}
                className="bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-1.5 text-sm outline-none w-36"
              />
              <span className="text-dark-500 text-sm">até</span>
              <input
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={e => setDataFim(e.target.value)}
                className="bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-1.5 text-sm outline-none w-36"
              />
              <button onClick={carregarPagamentos} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20">
                <Search size={14} /> Filtrar
              </button>
            </div>
          )}
        </div>

        <div className="text-right border-l border-dark-700 pl-6">
          <p className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Saldo em Caixa</p>
          <div className="flex items-baseline gap-1 justify-end">
            <span className="text-dark-500 font-bold text-sm">R$</span>
            <InputMoeda
              value={saldoCaixaPendente}
              onChange={setSaldoCaixaPendente}
              disabled={salvandoSaldo}
              onBlur={handleSalvarSaldoCaixa}
              permiteNegativo
              title="Digite o saldo real da conta desta loja (pode ser negativo)"
              className={`text-xl font-bold bg-transparent text-right w-56 outline-none border-b-2 border-transparent focus:border-blue-500 transition-colors disabled:opacity-50 ${
                saldoCaixaPendente < 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="p-4 bg-[#0d1017] border-b border-dark-700 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setMenuImportarAberto(!menuImportarAberto)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-900/20"
            >
              <Upload size={16} /> Importar Arquivos <ChevronDown size={14} className={menuImportarAberto ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {menuImportarAberto && (
              <div className="absolute top-full mt-2 left-0 w-56 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                <label className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700 cursor-pointer transition-colors border-b border-dark-700/50">
                  <FileText size={16} className="text-blue-400" />
                  <span className="text-sm font-semibold text-white">DDA</span>
                  <input data-loja={empresa.id} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleImportarArquivo(e, 'dda')} disabled={importando} />
                </label>
                <label className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700 cursor-pointer transition-colors">
                  <FileText size={16} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Folha de Pagamento</span>
                  <input data-loja={empresa.id} type="file" accept="application/pdf" className="hidden" onChange={e => handleImportarArquivo(e, 'folha')} disabled={importando} />
                </label>
              </div>
            )}
          </div>

          <button onClick={() => setModalAgendamentoAberto(true)} className="flex items-center gap-2 bg-transparent border border-dark-600 hover:bg-dark-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
            <Calendar size={16} className="text-blue-400" /> Agendamento
          </button>
          <button onClick={() => setModalTransferenciaAberto(true)} className="flex items-center gap-2 bg-transparent border border-dark-600 hover:bg-dark-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
            <ArrowRightLeft size={16} className="text-emerald-400" /> Transferência
          </button>
          <button className="flex items-center gap-2 bg-transparent border border-dark-600 hover:bg-dark-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
            <Sparkles size={16} className="text-amber-400" /> Integrar Connecta AI
          </button>
        </div>

      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[150px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0b0e14] border-b border-dark-700 text-[10px] uppercase font-bold tracking-widest text-dark-400">
              <th className="px-6 py-4">TIPO</th>
              <th className="px-6 py-4">BENEFICIÁRIO</th>
              <th className="px-6 py-4">CATEGORIA</th>
              <th className="px-6 py-4">DESCRIÇÃO</th>
              <th className="px-6 py-4">SITUAÇÃO</th>
              <th className="px-6 py-4">DATA PG.</th>
              <th className="px-6 py-4">VALOR</th>
              <th className="px-6 py-4 text-center">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/50">
            {carregando ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-dark-500 font-semibold text-sm">
                  <RefreshCw className="animate-spin mx-auto mb-3" size={24} />
                  Carregando...
                </td>
              </tr>
            ) : pagamentos.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-dark-500 font-semibold text-sm uppercase tracking-wider">
                  Nenhum lançamento ativo para esta loja.
                </td>
              </tr>
            ) : (
              <>
                {pagamentosDda.length > 0 && (
                  <tr className="bg-dark-800/20 hover:bg-dark-800/40 transition-colors border-l-4 border-l-blue-500">
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-blue-500/10 text-blue-400">DDA</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white text-sm">Lançamentos DDA</td>
                    <td className="px-6 py-4 text-sm text-dark-300">{categoriaDda}</td>
                    <td className="px-6 py-4 text-sm text-dark-300">Total de {pagamentosDda.length} itens importados</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded border uppercase tracking-wider ${situacaoDda.classe}`}>{situacaoDda.label}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-300 font-semibold">—</td>
                    <td className="px-6 py-4 font-black text-rose-400 text-sm">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pagamentosDda.reduce((acc, curr) => acc + Number(curr.valor), 0))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setModalDetalhesDda(true)} className="bg-dark-800 hover:bg-dark-700 border border-dark-600 text-white rounded p-1.5 transition-colors" title="Visualizar Lançamentos">
                        <Search size={16} className="text-dark-300" />
                      </button>
                    </td>
                  </tr>
                )}

                {pagamentosFolha.length > 0 && (
                  <tr className="bg-dark-800/10 hover:bg-dark-800/30 transition-colors border-l-4 border-l-emerald-500">
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">FOLHA</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white text-sm">Folha de Pagamento</td>
                    <td className="px-6 py-4 text-sm text-dark-300">{categoriaFolha}</td>
                    <td className="px-6 py-4 text-sm text-dark-300">Total de {pagamentosFolha.length} colaboradores</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded border uppercase tracking-wider ${situacaoFolha.classe}`}>{situacaoFolha.label}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-300 font-semibold">—</td>
                    <td className="px-6 py-4 font-black text-rose-400 text-sm">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pagamentosFolha.reduce((acc, curr) => acc + Number(curr.valor), 0))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setModalDetalhesFolha(true)} className="bg-dark-800 hover:bg-dark-700 border border-dark-600 text-white rounded p-1.5 transition-colors" title="Visualizar Lançamentos">
                        <Search size={16} className="text-dark-300" />
                      </button>
                    </td>
                  </tr>
                )}

                {pagamentosIndividuais.map((pag, idx) => (
                  <tr key={pag.id || idx} className="bg-[#11141c] hover:bg-dark-800/30 transition-colors border-b border-dark-700/50">
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        pag.origem === 'Transferência' || pag.origem === 'Transferência Recebida' ? 'text-emerald-400' : 'text-dark-300'
                      }`}>
                        {pag.origem === 'Agendamento' ? 'AGEND' : pag.origem === 'Transferência Recebida' ? 'TRANSF. RECEB.' : pag.origem}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white text-sm">
                      {pag.fornecedor || pag.beneficiario || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-300 max-w-[120px] truncate">
                      {pag.categoria || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-300 max-w-[200px] truncate" title={
                      pag.descricao
                        ? `${pag.descricao}${pag.documento ? ' - Doc: ' + pag.documento : ''}`
                        : (pag.documento ? `Doc: ${pag.documento}` : '—')
                    }>
                      {pag.descricao
                        ? `${pag.descricao}${pag.documento ? ' - Doc: ' + pag.documento : ''}`
                        : (pag.documento ? `Doc: ${pag.documento}` : '—')}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => toggleStatus(pag)} className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider transition-colors ${
                        pag.status === 'agendado'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                      }`}>
                        {pag.status === 'agendado' ? 'AGENDADO' : 'EM ABERTO'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-300">
                      {pag.data_vencimento ? pag.data_vencimento.split('-').reverse().join('/') : '—'}
                    </td>
                    <td className={`px-6 py-4 font-bold text-sm ${pag.origem === 'Transferência Recebida' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pag.valor)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {pag.anexo_url && (
                          <a
                            href={pag.anexo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 transition-colors p-1"
                            title="Ver anexo"
                          >
                            <Paperclip size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => { setItemEditando(pag); setModalEdicaoAberto(true); setEditandoCategoriaEdicao(false); setEditandoContaEdicao(false); setEditandoFornecedorEdicao(false); }}
                          className="text-dark-400 hover:text-white transition-colors p-1"
                        >
                          <Edit2 size={16} />
                        </button>
                        {pag.origem !== 'Transferência' && (
                          <button
                            onClick={() => handleEnviarParaContasAPagar([pag])}
                            className="text-dark-400 hover:text-blue-400 transition-colors p-1"
                            title="Enviar para Contas a Pagar"
                          >
                            <Send size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleExcluirIndividual(pag.id, pag.origem)}
                          className="text-dark-400 hover:text-rose-400 transition-colors p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Totals */}
      <div className="bg-[#0b0e14] border-t border-dark-700 px-6 py-8 flex flex-col md:flex-row justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Total Despesas</p>
          <p className="text-lg font-black text-rose-500">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
          </p>
        </div>
        <div className="md:border-l md:border-dark-700 md:pl-12">
          <p className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Entradas (Transf)</p>
          <p className="text-lg font-black text-emerald-500">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEntradas)}
          </p>
        </div>
        <div className="md:ml-auto text-right">
          <p className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Saldo Final Estimado</p>
          <p className={`text-lg font-black ${saldoFinalEstimado < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoFinalEstimado)}
          </p>
        </div>
      </div>

      <ModalAgendamento
        open={modalAgendamentoAberto}
        onClose={() => setModalAgendamentoAberto(false)}
        empresaAtiva={empresa}
        onSuccess={carregarPagamentos}
      />

      <ModalTransferencia
        open={modalTransferenciaAberto}
        onClose={() => setModalTransferenciaAberto(false)}
        empresaAtiva={empresa}
        empresas={lojasDoGrupo}
        onSuccess={() => { carregarPagamentos(); onTransferenciaGlobal?.() }}
      />

      {modalFolhaAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#11141c] border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-4">Importar Folha de Pagamento</h2>
            <p className="text-dark-300 text-sm mb-6">Por favor, informe a data de vencimento desta folha. A competência será calculada automaticamente.</p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-dark-400 uppercase tracking-widest mb-2">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={vencimentoFolha}
                onChange={e => setVencimentoFolha(e.target.value)}
                className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-4 py-3 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModalFolhaAberto(false)}
                className="px-4 py-2 text-dark-300 hover:text-white transition-colors text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (arquivoFolha) {
                    processarArquivo(arquivoFolha, 'folha', vencimentoFolha)
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-900/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      <ModalDetalhesLancamentos
        open={modalDetalhesDda}
        onClose={() => setModalDetalhesDda(false)}
        titulo={`Lançamentos DDA — ${empresa.nome}`}
        lancamentos={pagamentosDda}
        onDelete={handleExcluirEmLote}
        onAgendar={handleAgendarEmLote}
        onVoltarAberto={handleVoltarAbertoEmLote}
        onEditarItem={(item) => { setItemEditando(item); setModalEdicaoAberto(true); setEditandoCategoriaEdicao(false); setEditandoContaEdicao(false); setEditandoFornecedorEdicao(false); }}
        onToggleStatus={toggleStatus}
        onEnviarContasAPagar={handleEnviarParaContasAPagar}
        onTransferirItem={(item) => abrirModalTransferir([item])}
        onTransferirLote={(itens) => abrirModalTransferir(itens)}
        onEditarEmMassa={abrirEdicaoEmMassa}
      />

      <ModalDetalhesLancamentos
        open={modalDetalhesFolha}
        onClose={() => setModalDetalhesFolha(false)}
        titulo={`Folha de Pagamento — ${empresa.nome}`}
        lancamentos={pagamentosFolha}
        onDelete={handleExcluirEmLote}
        onAgendar={handleAgendarEmLote}
        onVoltarAberto={handleVoltarAbertoEmLote}
        onEditarItem={(item) => { setItemEditando(item); setModalEdicaoAberto(true); setEditandoCategoriaEdicao(false); setEditandoContaEdicao(false); setEditandoFornecedorEdicao(false); }}
        onToggleStatus={toggleStatus}
        onEnviarContasAPagar={handleEnviarParaContasAPagar}
        onTransferirItem={(item) => abrirModalTransferir([item])}
        onTransferirLote={(itens) => abrirModalTransferir(itens)}
        onEditarEmMassa={abrirEdicaoEmMassa}
      />

      <ModalEdicaoEmMassa
        open={modalEdicaoMassaAberto}
        onClose={() => setModalEdicaoMassaAberto(false)}
        itens={itensEdicaoMassa}
        contas={contasFinanceiras}
        onConfirmar={handleConfirmarEdicaoEmMassa}
        salvando={salvandoEdicaoMassa}
      />

      <ModalTransferirLancamento
        open={modalTransferirAberto}
        onClose={() => setModalTransferirAberto(false)}
        itens={itensParaTransferir}
        empresaAtual={empresa}
        empresasDestino={lojasDoGrupo.filter(e => e.id !== empresa.id)}
        onConfirmar={handleConfirmarTransferirLancamentos}
        transferindo={transferindoLancamento}
      />

      {modalEdicaoAberto && itemEditando && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <form onSubmit={handleSalvarEdicao} className="bg-[#11141c] border border-dark-600 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-dark-700 flex items-center justify-between shrink-0">
              <h3 className="text-white font-bold text-lg">Editar Lançamento</h3>
              <button type="button" onClick={() => setModalEdicaoAberto(false)} className="text-dark-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {itemEditando.origem === 'DDA' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Beneficiário <span className="text-rose-400">*</span></label>
                      {editandoFornecedorEdicao ? (
                        <SelectorFornecedor
                          valorInicial={itemEditando.beneficiario || ''}
                          empresaId={empresa.id}
                          onSelect={nome => { setItemEditando({ ...itemEditando, beneficiario: nome }); setEditandoFornecedorEdicao(false) }}
                          onCancel={() => setEditandoFornecedorEdicao(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoFornecedorEdicao(true)}
                          className="w-full text-left bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm hover:border-blue-500 transition-all truncate"
                        >
                          {itemEditando.beneficiario || <span className="text-dark-500">Clique para buscar...</span>}
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Documento</label>
                      <input type="text" value={itemEditando.documento || ''} onChange={e => setItemEditando({ ...itemEditando, documento: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" placeholder="Nº do documento" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Categoria <span className="text-rose-400">*</span></label>
                      {editandoCategoriaEdicao ? (
                        <SelectorCategoria
                          valorInicial={itemEditando.categoria || ''}
                          onSelect={nome => { setItemEditando({ ...itemEditando, categoria: nome }); setEditandoCategoriaEdicao(false) }}
                          onCancel={() => setEditandoCategoriaEdicao(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoCategoriaEdicao(true)}
                          className="w-full text-left bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm hover:border-blue-500 transition-all truncate"
                        >
                          {itemEditando.categoria || <span className="text-dark-500">Clique para buscar...</span>}
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Conta de Pagamento</label>
                      {editandoContaEdicao ? (
                        <SelectorContaFinanceira
                          valorInicial={itemEditando.conta_pagamento || ''}
                          contas={contasFinanceiras}
                          onSelect={nome => { setItemEditando({ ...itemEditando, conta_pagamento: nome }); setEditandoContaEdicao(false) }}
                          onCancel={() => setEditandoContaEdicao(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoContaEdicao(true)}
                          className="w-full text-left bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm hover:border-blue-500 transition-all truncate"
                        >
                          {itemEditando.conta_pagamento || <span className="text-dark-500">Clique para buscar...</span>}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Descrição</label>
                    <input type="text" value={itemEditando.descricao || ''} onChange={e => setItemEditando({ ...itemEditando, descricao: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" placeholder="Detalhes..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Valor (R$) <span className="text-rose-400">*</span></label>
                      <InputMoeda value={Number(itemEditando.valor) || 0} onChange={v => setItemEditando({ ...itemEditando, valor: v })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Vencimento <span className="text-rose-400">*</span></label>
                      <input type="date" value={itemEditando.data_vencimento || ''} onChange={e => setItemEditando({ ...itemEditando, data_vencimento: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Competência</label>
                      <input type="date" value={itemEditando.competencia || ''} onChange={e => setItemEditando({ ...itemEditando, competencia: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Situação</label>
                      <select value={itemEditando.status || 'aberto'} onChange={e => setItemEditando({ ...itemEditando, status: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500">
                        <option value="aberto">Em aberto</option>
                        <option value="agendado">Agendado</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Fornecedor / Colaborador <span className="text-rose-400">*</span></label>
                      {editandoFornecedorEdicao ? (
                        <SelectorFornecedor
                          valorInicial={itemEditando.fornecedor || ''}
                          empresaId={empresa.id}
                          onSelect={nome => { setItemEditando({ ...itemEditando, fornecedor: nome }); setEditandoFornecedorEdicao(false) }}
                          onCancel={() => setEditandoFornecedorEdicao(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoFornecedorEdicao(true)}
                          className="w-full text-left bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm hover:border-blue-500 transition-all truncate"
                        >
                          {itemEditando.fornecedor || <span className="text-dark-500">Clique para buscar...</span>}
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Forma de Pagamento</label>
                      <select value={itemEditando.tipo || 'Outros'} onChange={e => setItemEditando({ ...itemEditando, tipo: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500">
                        <option value="PIX">PIX</option>
                        <option value="Boleto">Boleto</option>
                        <option value="TED">TED</option>
                        <option value="Imposto">Imposto</option>
                        <option value="Folha Mensal">Folha Mensal</option>
                        <option value="Adiantamento">Adiantamento</option>
                        <option value="Transferência">Transferência (saída)</option>
                        <option value="Transferência Recebida">Transferência Recebida (entrada)</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Categoria <span className="text-rose-400">*</span></label>
                      <input type="text" value={itemEditando.categoria || ''} onChange={e => setItemEditando({ ...itemEditando, categoria: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" placeholder="Ex: Diversos" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Conta de Pagamento</label>
                      {editandoContaEdicao ? (
                        <SelectorContaFinanceira
                          valorInicial={itemEditando.conta_pagamento || ''}
                          contas={contasFinanceiras}
                          onSelect={nome => { setItemEditando({ ...itemEditando, conta_pagamento: nome }); setEditandoContaEdicao(false) }}
                          onCancel={() => setEditandoContaEdicao(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoContaEdicao(true)}
                          className="w-full text-left bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm hover:border-blue-500 transition-all truncate"
                        >
                          {itemEditando.conta_pagamento || <span className="text-dark-500">Clique para buscar...</span>}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Descrição</label>
                    <input type="text" value={itemEditando.descricao || ''} onChange={e => setItemEditando({ ...itemEditando, descricao: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" placeholder="Detalhes..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Valor (R$) <span className="text-rose-400">*</span></label>
                      <InputMoeda value={Number(itemEditando.valor) || 0} onChange={v => setItemEditando({ ...itemEditando, valor: v })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Vencimento <span className="text-rose-400">*</span></label>
                      <input type="date" value={itemEditando.data_vencimento || ''} onChange={e => setItemEditando({ ...itemEditando, data_vencimento: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Competência</label>
                      <input type="date" value={itemEditando.competencia || ''} onChange={e => setItemEditando({ ...itemEditando, competencia: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">CPF/CNPJ</label>
                      <input type="text" value={itemEditando.cpf_cnpj || ''} onChange={e => setItemEditando({ ...itemEditando, cpf_cnpj: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Chave PIX</label>
                      <input type="text" value={itemEditando.chave_pix || ''} onChange={e => setItemEditando({ ...itemEditando, chave_pix: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Situação</label>
                      <select value={itemEditando.status || 'aberto'} onChange={e => setItemEditando({ ...itemEditando, status: e.target.value })} className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500">
                        <option value="aberto">Em aberto</option>
                        <option value="agendado">Agendado</option>
                      </select>
                    </div>
                  </div>
                  {itemEditando.anexo_url && (
                    <a href={itemEditando.anexo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
                      <Paperclip size={14} /> Ver anexo
                    </a>
                  )}
                </>
              )}
            </div>
            <div className="p-5 border-t border-dark-700 flex justify-end gap-3 bg-[#0b0e14] shrink-0">
              <button type="button" onClick={() => setModalEdicaoAberto(false)} className="px-4 py-2 text-dark-300 hover:text-white font-semibold text-sm">
                Cancelar
              </button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
