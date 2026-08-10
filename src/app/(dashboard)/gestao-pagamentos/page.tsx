"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, Bell, FileText, UserPlus, LogOut, Trash2, Upload, Search,
  Calendar, Check, AlertCircle, RefreshCw, Send, Download, ChevronDown, 
  ArrowRightLeft, Sparkles, Plus, Users, Edit2, X
} from 'lucide-react'
import { useEmpresa } from '@/contexts/EmpresaContext'
import toast from 'react-hot-toast'
import ModalAgendamento from '@/components/agendamento/ModalAgendamento'
import ModalTransferencia from '@/components/agendamento/ModalTransferencia'
import ModalDetalhesLancamentos from '@/components/agendamento/ModalDetalhesLancamentos'
import { useRouter } from 'next/navigation'

export default function GestaoPagamentos() {
  const router = useRouter()
  const supabase = createClient()
  const { empresaAtiva, empresas } = useEmpresa()
  const [dataAtual, setDataAtual] = useState(new Date().toISOString().split('T')[0])
  
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [exportando, setExportando] = useState(false)
  
  const [modalFolhaAberto, setModalFolhaAberto] = useState(false)
  const [arquivoFolha, setArquivoFolha] = useState<File | null>(null)
  const [vencimentoFolha, setVencimentoFolha] = useState(new Date().toISOString().split('T')[0])
  
  const [menuImportarAberto, setMenuImportarAberto] = useState(false)
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false)
  const [modalTransferenciaAberto, setModalTransferenciaAberto] = useState(false)
  
  // Modal de edição rápida (Categoria/Descrição)
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [itemEditando, setItemEditando] = useState<any>(null)

  // Novos estados para modais de detalhes e seleção
  const [modalDetalhesDda, setModalDetalhesDda] = useState(false)
  const [modalDetalhesFolha, setModalDetalhesFolha] = useState(false)
  const [selecionados, setSelecionados] = useState<string[]>([])

  useEffect(() => {
    if (empresaAtiva) {
      carregarPagamentos()
    }
  }, [empresaAtiva, dataAtual])

  async function carregarPagamentos() {
    if (!empresaAtiva) return
    setCarregando(true)
    
    // Buscar DDA: todos os abertos ou do dia (removido filtro estrito de dataAtual para DDA)
    // Isso resolve o bug do DDA importado que não aparecia por ter data diferente
    const { data: ddas } = await supabase
      .from('pagamentos_dda')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      
    // Buscar Agendamentos/Folha/Transferencias
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .eq('data_vencimento', dataAtual)

    const unificados = [
      ...(ddas || []).map(d => ({ ...d, origem: 'DDA' })),
      ...(agendamentos || []).map(f => ({ ...f, origem: f.tipo === 'Transferência' ? 'Transferência' : (f.tipo?.includes('Folha') ? 'Folha' : 'Agendamento') }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    setPagamentos(unificados)
    setSelecionados([]) // limpa seleção ao recarregar
    setCarregando(false)
  }

  async function handleImportarArquivo(e: React.ChangeEvent<HTMLInputElement>, tipo: 'dda' | 'folha') {
    const file = e.target.files?.[0]
    if (!file || !empresaAtiva) return

    if (tipo === 'folha') {
      setArquivoFolha(file)
      setMenuImportarAberto(false)
      setModalFolhaAberto(true)
      return
    }

    await processarArquivo(file, 'dda')
  }

  async function processarArquivo(file: File, tipo: 'dda' | 'folha', vencimentoEspecifico?: string) {
    if (!empresaAtiva) return
    setImportando(true)
    toast.loading('Extraindo dados do arquivo...', { id: 'import' })
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
            empresa_id: empresaAtiva.id,
            beneficiario: item.beneficiario,
            documento: item.documento,
            valor: parseFloat(String(item.valor).replace(',', '.')),
            data_vencimento: item.data_vencimento || dataAtual
          })
        } else {
          // Lógica de Competência
          let competencia = ''
          if (vencimentoEspecifico && data.tipoCalculo) {
              const [ano, mes, dia] = vencimentoEspecifico.split('-')
              const dateVenc = new Date(Number(ano), Number(mes) - 1, Number(dia))
              if (data.tipoCalculo === 'Folha Mensal') {
                  // 1 mês antes
                  dateVenc.setMonth(dateVenc.getMonth() - 1)
                  competencia = dateVenc.toISOString().split('T')[0]
              } else if (data.tipoCalculo === 'Adiantamento') {
                  // 1º dia do mês seguinte
                  dateVenc.setMonth(dateVenc.getMonth() + 1)
                  dateVenc.setDate(1)
                  competencia = dateVenc.toISOString().split('T')[0]
              }
          }

          await supabase.from('agendamentos').insert({
            empresa_id: empresaAtiva.id,
            fornecedor: item.fornecedor,
            tipo: item.tipo || data.tipoCalculo || 'Folha',
            categoria: (item.tipo || data.tipoCalculo) === 'Adiantamento' ? 'Adiantamento Salarial' : 'Salários',
            valor: parseFloat(String(item.valor).replace(',', '.')),
            data_vencimento: vencimentoEspecifico || dataAtual,
            descricao: item.descricao,
            cpf_cnpj: item.cpf_cnpj,
            competencia: competencia
          })
        }
        count++
      }

      toast.success(`${count} pagamento(s) extraído(s) e salvo(s) com sucesso!`, { id: 'import' })
      carregarPagamentos()
    } catch (err: any) {
      toast.error(err.message, { id: 'import' })
    } finally {
      setImportando(false)
      const inputs = document.querySelectorAll('input[type="file"]')
      inputs.forEach(input => (input as HTMLInputElement).value = '')
    }
  }

  async function handleLimparRegistrosDoDia() {
    if (!empresaAtiva) return
    if (!confirm('Deseja excluir TODOS os registros de pagamentos desta data? Essa ação não pode ser desfeita.')) return
    
    toast.loading('Limpando registros...', { id: 'delete' })
    try {
      await supabase.from('pagamentos_dda').delete().eq('empresa_id', empresaAtiva.id).eq('data_vencimento', dataAtual)
      await supabase.from('agendamentos').delete().eq('empresa_id', empresaAtiva.id).eq('data_vencimento', dataAtual)
      
      toast.success('Registros excluídos!', { id: 'delete' })
      carregarPagamentos()
    } catch(e) {
      toast.error('Erro ao excluir registros.', { id: 'delete' })
    }
  }

  async function handleExportarContaAzul(pagamento: any) {
    if (!empresaAtiva) return
    setExportando(true)
    toast.loading('Preparando exportação para o Conta Azul...', { id: 'export' })

    try {
      const { data: inserido, error: errInsert } = await supabase
        .from('contas_pagar_importadas')
        .insert({
          empresa_id: empresaAtiva.id,
          fornecedor: pagamento.origem === 'DDA' ? pagamento.beneficiario : pagamento.fornecedor,
          doc: pagamento.origem === 'DDA' ? pagamento.documento : pagamento.cpf_cnpj,
          valor: pagamento.valor,
          vencimento: pagamento.data_vencimento,
          emissao: pagamento.data_vencimento,
          descricao: pagamento.origem === 'DDA' ? `DDA - Doc: ${pagamento.documento}` : pagamento.descricao,
          categoria: pagamento.origem === 'Transferência' ? 'Transferência de Saída' : 'Materiais para Revenda',
          status: 'pendente'
        })
        .select('id')
        .single()

      if (errInsert || !inserido) throw new Error('Erro ao preparar conta para envio.')

      const res = await fetch('/api/conta-azul/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtiva.id,
          contas_ids: [inserido.id]
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar para CA')

      if (data.erros > 0) {
        throw new Error(`A Conta Azul recusou o envio: ${data.resultados[0]?.detalhe}`)
      }

      if (pagamento.origem === 'DDA') {
        await supabase.from('pagamentos_dda').update({ status: 'enviado_ca' }).eq('id', pagamento.id)
      } else {
        await supabase.from('agendamentos').update({ status: 'enviado_ca' }).eq('id', pagamento.id)
      }

      toast.success('Enviado para a Conta Azul com sucesso!', { id: 'export' })
      carregarPagamentos()

    } catch (err: any) {
      toast.error(err.message, { id: 'export' })
    } finally {
      setExportando(false)
    }
  }

  const totalDespesas = pagamentos.reduce((acc, curr) => acc + Number(curr.valor), 0)
  const saldoCaixa = 0.00 
  const totalEntradas = 0.00 
  const saldoFinalEstimado = saldoCaixa + totalEntradas - totalDespesas

  // Lógica de agrupamento para DDA e Folha
  const pagamentosDda = pagamentos.filter(p => p.origem === 'DDA')
  const pagamentosFolha = pagamentos.filter(p => p.origem === 'Folha' || p.tipo === 'Folha' || p.tipo === 'Folha Mensal' || p.tipo === 'Adiantamento')
  const pagamentosIndividuais = pagamentos.filter(p => p.origem !== 'DDA' && p.origem !== 'Folha' && !p.tipo?.includes('Folha') && p.tipo !== 'Adiantamento')

  const handleExcluirEmLote = async (ids: string[]) => {
    if (!confirm(`Excluir ${ids.length} lançamento(s)?`)) return
    toast.loading('Excluindo...', { id: 'delete_lote' })
    try {
       await supabase.from('pagamentos_dda').delete().in('id', ids)
       await supabase.from('agendamentos').delete().in('id', ids)
       toast.success('Excluídos com sucesso', { id: 'delete_lote' })
       setSelecionados([])
       carregarPagamentos()
       setModalDetalhesDda(false)
       setModalDetalhesFolha(false)
    } catch (e) {
       toast.error('Erro ao excluir', { id: 'delete_lote' })
    }
  }

  const handleAgendarEmLote = async (ids: string[]) => {
    if (!confirm(`Deseja alterar ${ids.length} itens para AGENDADO?`)) return
    try {
      await supabase.from('pagamentos_dda').update({ status: 'agendado' }).in('id', ids)
      await supabase.from('agendamentos').update({ status: 'agendado' }).in('id', ids)
      toast.success('Status atualizado para Agendado!')
      setSelecionados([])
      carregarPagamentos()
    } catch(e) {
      toast.error('Erro ao atualizar')
    }
  }

  const handleVoltarAbertoEmLote = async (ids: string[]) => {
    if (!confirm(`Deseja alterar ${ids.length} itens para EM ABERTO?`)) return
    try {
      await supabase.from('pagamentos_dda').update({ status: 'aberto' }).in('id', ids)
      await supabase.from('agendamentos').update({ status: 'aberto' }).in('id', ids)
      toast.success('Status atualizado para Em Aberto!')
      setSelecionados([])
      carregarPagamentos()
    } catch(e) {
      toast.error('Erro ao atualizar')
    }
  }

  const toggleSelectAll = () => {
    if (selecionados.length === pagamentosIndividuais.length) {
      setSelecionados([])
    } else {
      setSelecionados(pagamentosIndividuais.map(p => p.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleStatus = async (item: any) => {
    const novoStatus = item.status === 'agendado' ? 'aberto' : 'agendado'
    const tabela = item.origem === 'DDA' ? 'pagamentos_dda' : 'agendamentos'
    
    // Atualização otimista
    setPagamentos(prev => prev.map(p => p.id === item.id ? { ...p, status: novoStatus } : p))
    
    try {
       await supabase.from(tabela).update({ status: novoStatus }).eq('id', item.id)
    } catch (e) {
       toast.error('Erro ao atualizar status')
       carregarPagamentos() // reverte
    }
  }

  const handleExcluirIndividual = async (id: string, origem: string) => {
    if (!confirm('Deseja excluir este lançamento?')) return
    const tabela = origem === 'DDA' ? 'pagamentos_dda' : 'agendamentos'
    try {
      await supabase.from(tabela).delete().eq('id', id)
      toast.success('Excluído!')
      carregarPagamentos()
    } catch(e) {
      toast.error('Erro ao excluir')
    }
  }

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemEditando) return
    const tabela = itemEditando.origem === 'DDA' ? 'pagamentos_dda' : 'agendamentos'
    
    try {
      await supabase.from(tabela).update({
         categoria: itemEditando.categoria,
         descricao: itemEditando.descricao
      }).eq('id', itemEditando.id)
      
      toast.success('Atualizado com sucesso!')
      setModalEdicaoAberto(false)
      carregarPagamentos()
    } catch(err) {
      toast.error('Erro ao atualizar')
    }
  }

  return (
    <>
      {/* Top Navbar */}
      <div className="bg-[#0b0e14] border-b border-dark-700 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-dark-300 hover:text-white transition-colors bg-dark-800 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Pagamentos BPO Financeiro</h1>
            <p className="text-dark-400 text-xs">Grupo: <span className="text-dark-300 font-semibold">TESTE</span></p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4">
            <div className="text-right leading-tight">
              <p className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">Operador</p>
              <p className="text-sm text-white font-bold">TESTE</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
              <LogOut size={14} className="text-dark-300" />
            </div>
          </div>
          
          <button className="text-dark-400 hover:text-white transition-colors">
            <AlertCircle size={20} />
          </button>
          <button className="text-dark-400 hover:text-white transition-colors">
            <FileText size={20} />
          </button>
          
          <button className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
            <Users size={16} className="text-blue-400" /> Colaboradores
          </button>

          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20">
            <Plus size={16} /> Nova Loja
          </button>

          <button className="flex items-center gap-2 bg-dark-800 border border-dark-600 hover:bg-dark-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
            <Upload size={16} className="text-dark-300" /> Exportar <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-4 animate-fade-in">
        
        {/* Main Card Header */}
        <div className="bg-[#11141c] border border-dark-700 rounded-2xl overflow-hidden shadow-2xl">
          
          <div className="p-6 border-b border-dark-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                {empresaAtiva?.nome || 'TESTE LOJA'}
              </h2>
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                <Calendar size={12} className="text-amber-500" />
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Filtrado: {dataAtual.split('-').reverse().join('/')}</span>
              </div>
              <button onClick={handleLimparRegistrosDoDia} className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-800 text-dark-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                <Trash2 size={16} />
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 transition-colors">
                <Upload size={16} />
              </button>
            </div>
            
            <div className="text-right border-l border-dark-700 pl-6">
              <p className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Saldo em Caixa</p>
              <div className="flex items-baseline gap-1">
                <span className="text-dark-500 font-bold text-sm">R$</span>
                <span className="text-3xl font-bold text-white">0,00</span>
              </div>
            </div>
          </div>

          {/* Filters Row */}
          <div className="p-6 border-b border-dark-700 flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14} /> Filtrar por data de pagamento
              </span>
              <input 
                type="date"
                value={dataAtual}
                onChange={e => setDataAtual(e.target.value)}
                className="bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-1.5 text-sm outline-none w-36"
              />
            </div>
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20">
              <Search size={14} /> Filtrar por Data
            </button>
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
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleImportarArquivo(e, 'dda')} disabled={importando} />
                    </label>
                    <label className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700 cursor-pointer transition-colors">
                      <FileText size={16} className="text-emerald-400" />
                      <span className="text-sm font-semibold text-white">Folha de Pagamento</span>
                      <input type="file" accept="application/pdf" className="hidden" onChange={e => handleImportarArquivo(e, 'folha')} disabled={importando} />
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

            {/* Selection Batch Actions */}
            {selecionados.length > 0 && (
               <div className="flex items-center gap-2 animate-fade-in bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-lg">
                 <span className="text-sm text-blue-400 font-bold mr-2">{selecionados.length} selecionado(s)</span>
                 <button onClick={() => handleExcluirEmLote(selecionados)} className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">
                   Excluir
                 </button>
                 <button onClick={() => handleAgendarEmLote(selecionados)} className="bg-amber-500 hover:bg-amber-600 text-[#0b0e14] px-3 py-1.5 rounded text-xs font-bold transition-colors">
                   Agendar
                 </button>
               </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[250px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0b0e14] border-b border-dark-700 text-[10px] uppercase font-bold tracking-widest text-dark-400">
                  <th className="px-6 py-4 w-12">
                    <input 
                      type="checkbox" 
                      checked={selecionados.length > 0 && selecionados.length === pagamentosIndividuais.length && pagamentosIndividuais.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-dark-500 bg-dark-800 text-blue-500 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
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
                    <td colSpan={9} className="p-12 text-center text-dark-500 font-semibold text-sm">
                      <RefreshCw className="animate-spin mx-auto mb-3" size={24} />
                      Carregando...
                    </td>
                  </tr>
                ) : pagamentos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-dark-500 font-semibold text-sm uppercase tracking-wider">
                      Nenhum lançamento ativo para esta loja.
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Linha Agrupada DDA */}
                    {pagamentosDda.length > 0 && (
                      <tr className="bg-dark-800/20 hover:bg-dark-800/40 transition-colors border-l-4 border-l-blue-500">
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4">
                           <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-blue-500/10 text-blue-400">DDA</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-white text-sm">Lançamentos DDA</td>
                        <td className="px-6 py-4 text-sm text-dark-300">Diversos</td>
                        <td className="px-6 py-4 text-sm text-dark-300">Total de {pagamentosDda.length} itens importados</td>
                        <td className="px-6 py-4">
                           <span className="text-[10px] font-bold px-3 py-1 rounded bg-dark-700/50 text-dark-300 border border-dark-600 uppercase tracking-wider">—</span>
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
                    
                    {/* Linha Agrupada Folha */}
                    {pagamentosFolha.length > 0 && (
                      <tr className="bg-dark-800/10 hover:bg-dark-800/30 transition-colors border-l-4 border-l-emerald-500">
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4">
                           <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">FOLHA</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-white text-sm">Folha de Pagamento</td>
                        <td className="px-6 py-4 text-sm text-dark-300">Salários / Adiantamentos</td>
                        <td className="px-6 py-4 text-sm text-dark-300">Total de {pagamentosFolha.length} colaboradores</td>
                        <td className="px-6 py-4">
                           <span className="text-[10px] font-bold px-3 py-1 rounded bg-dark-700/50 text-dark-300 border border-dark-600 uppercase tracking-wider">—</span>
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

                    {/* Linhas Individuais (Transferências, outros) */}
                    {pagamentosIndividuais.map((pag, idx) => (
                      <tr key={pag.id || idx} className={`${selecionados.includes(pag.id) ? 'bg-blue-500/10' : 'bg-[#11141c] hover:bg-dark-800/30'} transition-colors border-b border-dark-700/50`}>
                        <td className="px-6 py-4">
                           <input 
                              type="checkbox" 
                              checked={selecionados.includes(pag.id)}
                              onChange={() => toggleSelect(pag.id)}
                              className="rounded border-dark-500 bg-dark-800 text-blue-500 focus:ring-blue-500 cursor-pointer w-4 h-4"
                           />
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            pag.origem === 'Transferência' ? 'text-emerald-400' : 'text-dark-300'
                          }`}>
                            {pag.origem === 'Agendamento' ? 'AGEND' : pag.origem}
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
                        <td className="px-6 py-4 font-bold text-rose-400 text-sm">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pag.valor)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                             <button 
                               onClick={() => { setItemEditando(pag); setModalEdicaoAberto(true); }}
                               className="text-dark-400 hover:text-white transition-colors p-1"
                             >
                               <Edit2 size={16}/>
                             </button>
                             <button 
                               onClick={() => handleExcluirIndividual(pag.id, pag.origem)}
                               className="text-dark-400 hover:text-rose-400 transition-colors p-1"
                             >
                               <Trash2 size={16}/>
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
              <p className="text-2xl font-black text-rose-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
              </p>
            </div>
            <div className="md:border-l md:border-dark-700 md:pl-12">
              <p className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Entradas (Transf)</p>
              <p className="text-2xl font-black text-emerald-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEntradas)}
              </p>
            </div>
            <div className="md:ml-auto text-right">
              <p className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Saldo Final Estimado</p>
              <p className="text-2xl font-black text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoFinalEstimado)}
              </p>
            </div>
          </div>
          
        </div>
      </div>

      <ModalAgendamento 
        open={modalAgendamentoAberto} 
        onClose={() => setModalAgendamentoAberto(false)} 
        empresaAtiva={empresaAtiva} 
        onSuccess={carregarPagamentos} 
      />

      <ModalTransferencia 
        open={modalTransferenciaAberto} 
        onClose={() => setModalTransferenciaAberto(false)} 
        empresaAtiva={empresaAtiva} 
        empresas={empresas} 
        onSuccess={carregarPagamentos} 
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
        titulo={`Lançamentos DDA — ${empresaAtiva?.nome || ''}`}
        lancamentos={pagamentosDda}
        onDelete={handleExcluirEmLote}
        onAgendar={handleAgendarEmLote}
        onVoltarAberto={handleVoltarAbertoEmLote}
        onEditarItem={(item) => { setItemEditando(item); setModalEdicaoAberto(true); }}
        onToggleStatus={toggleStatus}
      />

      <ModalDetalhesLancamentos 
        open={modalDetalhesFolha}
        onClose={() => setModalDetalhesFolha(false)}
        titulo={`Folha de Pagamento — ${empresaAtiva?.nome || ''}`}
        lancamentos={pagamentosFolha}
        onDelete={handleExcluirEmLote}
        onAgendar={handleAgendarEmLote}
        onVoltarAberto={handleVoltarAbertoEmLote}
        onEditarItem={(item) => { setItemEditando(item); setModalEdicaoAberto(true); }}
        onToggleStatus={toggleStatus}
      />

      {/* Modal de Edição (Categoria e Descrição) */}
      {modalEdicaoAberto && itemEditando && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleSalvarEdicao} className="bg-[#11141c] border border-dark-600 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-dark-700 flex items-center justify-between">
               <h3 className="text-white font-bold text-lg">Editar Lançamento</h3>
               <button type="button" onClick={() => setModalEdicaoAberto(false)} className="text-dark-400 hover:text-white">
                  <X size={20} />
               </button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Categoria</label>
                  <input 
                    type="text" 
                    value={itemEditando.categoria || ''} 
                    onChange={e => setItemEditando({...itemEditando, categoria: e.target.value})}
                    className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="Ex: Diversos"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-dark-400 uppercase mb-1">Descrição</label>
                  <input 
                    type="text" 
                    value={itemEditando.descricao || (itemEditando.origem === 'DDA' ? `Doc: ${itemEditando.documento}` : '')} 
                    onChange={e => setItemEditando({...itemEditando, descricao: e.target.value})}
                    className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="Detalhes..."
                  />
               </div>
            </div>
            <div className="p-5 border-t border-dark-700 flex justify-end gap-3 bg-[#0b0e14]">
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
    </>
  )
}
