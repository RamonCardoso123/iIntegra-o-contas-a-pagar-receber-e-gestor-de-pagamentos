"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Check, AlertCircle, RefreshCw, Send, DollarSign, Upload, FileText, Download, ChevronDown, ArrowRightLeft, Sparkles, Plus } from 'lucide-react'
import { useEmpresa } from '@/contexts/EmpresaContext'
import toast from 'react-hot-toast'
import ModalAgendamento from '@/components/agendamento/ModalAgendamento'
import ModalTransferencia from '@/components/agendamento/ModalTransferencia'

export default function GestaoPagamentos() {
  const supabase = createClient()
  const { empresaAtiva, empresas } = useEmpresa()
  const [dataAtual, setDataAtual] = useState(new Date().toISOString().split('T')[0])
  
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [exportando, setExportando] = useState(false)
  
  const [menuImportarAberto, setMenuImportarAberto] = useState(false)
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false)
  const [modalTransferenciaAberto, setModalTransferenciaAberto] = useState(false)

  useEffect(() => {
    if (empresaAtiva) {
      carregarPagamentos()
    }
  }, [empresaAtiva, dataAtual])

  async function carregarPagamentos() {
    if (!empresaAtiva) return
    setCarregando(true)
    
    // Buscar DDA
    const { data: ddas } = await supabase
      .from('pagamentos_dda')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .eq('data_vencimento', dataAtual)
      
    // Buscar Agendamentos/Folha/Transferencias
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .eq('data_vencimento', dataAtual)

    const unificados = [
      ...(ddas || []).map(d => ({ ...d, origem: 'DDA' })),
      ...(agendamentos || []).map(f => ({ ...f, origem: f.tipo === 'Transferência' ? 'Transferência' : 'Agendamento/Folha' }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    setPagamentos(unificados)
    setCarregando(false)
  }

  async function handleImportarArquivo(e: React.ChangeEvent<HTMLInputElement>, tipo: 'dda' | 'folha') {
    const file = e.target.files?.[0]
    if (!file || !empresaAtiva) return

    setImportando(true)
    toast.loading('Enviando para a Inteligência Artificial...', { id: 'import' })
    setMenuImportarAberto(false)
    
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
          await supabase.from('agendamentos').insert({
            empresa_id: empresaAtiva.id,
            fornecedor: item.fornecedor,
            tipo: item.tipo || 'Folha',
            valor: parseFloat(String(item.valor).replace(',', '.')),
            data_vencimento: item.data_vencimento || dataAtual,
            descricao: item.descricao,
            cpf_cnpj: item.cpf_cnpj
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
      e.target.value = ''
    }
  }

  async function handleExportarContaAzul(pagamento: any) {
    if (!empresaAtiva) return
    setExportando(true)
    toast.loading('Preparando exportação para o Conta Azul...', { id: 'export' })

    try {
      // 1. Inserir "escondido" na tabela de contas_pagar_importadas
      const { data: inserido, error: errInsert } = await supabase
        .from('contas_pagar_importadas')
        .insert({
          empresa_id: empresaAtiva.id,
          fornecedor: pagamento.origem === 'DDA' ? pagamento.beneficiario : pagamento.fornecedor,
          cnpj_fornecedor: pagamento.origem === 'DDA' ? null : pagamento.cpf_cnpj,
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

      // 2. Enviar para a CA
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

      // Marcar como pago localmente
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
  
  // Saldo mockado por enquanto, pode ser implementado via integração futuramente
  const saldoCaixa = 15000.00 
  const totalEntradas = 0.00 // Pode ser preenchido caso seja transferido algo para esta loja
  const saldoFinalEstimado = saldoCaixa + totalEntradas - totalDespesas

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        
        {/* Header e Título */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-dark-900 border border-dark-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Pagamentos <span className="text-brand-400">BPO Financeiro</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-dark-400 text-sm">Grupo:</span>
              <span className="bg-dark-800 text-white px-2 py-0.5 rounded text-xs font-semibold border border-dark-600">TESTE</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-dark-400 text-xs font-semibold uppercase tracking-wider">Saldo em Caixa</span>
              <span className="text-white font-bold text-lg">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoCaixa)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar e Filtros */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-dark-900 border border-dark-600 rounded-lg px-3 py-2">
              <Calendar size={16} className="text-brand-400" />
              <input 
                type="date"
                value={dataAtual}
                onChange={e => setDataAtual(e.target.value)}
                className="bg-transparent text-white text-sm outline-none w-32"
              />
            </div>
            
            <button className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-brand-900/20">
              Filtrar por Data
            </button>
            <button className="text-dark-300 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-dark-700/50 hover:bg-dark-700">
              Mostrar Todos (Ativos)
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Importar Arquivos Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setMenuImportarAberto(!menuImportarAberto)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-900/20"
              >
                <Upload size={16} />
                Importar Arquivos
                <ChevronDown size={14} className={`transition-transform ${menuImportarAberto ? 'rotate-180' : ''}`} />
              </button>
              
              {menuImportarAberto && (
                <div className="absolute top-full mt-2 left-0 w-64 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <label className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700 cursor-pointer transition-colors group border-b border-dark-700/50">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">DDA</p>
                      <p className="text-xs text-dark-400">PDF ou Imagem</p>
                    </div>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleImportarArquivo(e, 'dda')} disabled={importando} />
                  </label>
                  
                  <label className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700 cursor-pointer transition-colors group">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Folha de Pagamento</p>
                      <p className="text-xs text-dark-400">PDF</p>
                    </div>
                    <input type="file" accept="application/pdf" className="hidden" onChange={e => handleImportarArquivo(e, 'folha')} disabled={importando} />
                  </label>
                </div>
              )}
            </div>

            <button onClick={() => setModalAgendamentoAberto(true)} className="flex items-center gap-2 bg-dark-900 border border-dark-600 hover:border-dark-500 hover:bg-dark-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
              <Calendar size={16} className="text-emerald-400" /> Agendamento
            </button>
            <button onClick={() => setModalTransferenciaAberto(true)} className="flex items-center gap-2 bg-dark-900 border border-dark-600 hover:border-dark-500 hover:bg-dark-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
              <ArrowRightLeft size={16} className="text-amber-400" /> Transferência
            </button>
            <button className="flex items-center gap-2 bg-dark-900 border border-brand-500/30 hover:border-brand-500 text-brand-300 hover:text-brand-400 hover:bg-brand-500/10 px-4 py-2 rounded-lg text-sm font-semibold transition-all">
              <Sparkles size={16} /> Integrar Connecta AI
            </button>
          </div>
        </div>

        {/* Tabela de Lançamentos */}
        <div className="bg-dark-900 border border-dark-700 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-800/50 border-b border-dark-700 text-xs uppercase tracking-wider text-dark-400">
                  <th className="p-4 font-semibold">Tipo</th>
                  <th className="p-4 font-semibold">Beneficiário</th>
                  <th className="p-4 font-semibold">Descrição</th>
                  <th className="p-4 font-semibold">Situação</th>
                  <th className="p-4 font-semibold">Data Pg.</th>
                  <th className="p-4 font-semibold text-right">Valor</th>
                  <th className="p-4 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {carregando ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-dark-400">
                      <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                      Carregando pagamentos...
                    </td>
                  </tr>
                ) : pagamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-dark-500">
                      Nenhum lançamento ativo para esta data.
                    </td>
                  </tr>
                ) : (
                  pagamentos.map((pag, idx) => (
                    <tr key={idx} className="hover:bg-dark-800/30 transition-colors">
                      <td className="p-4">
                        <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md ${
                          pag.origem === 'DDA' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                          pag.origem === 'Transferência' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {pag.origem}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-white">
                        {pag.origem === 'DDA' ? pag.beneficiario : pag.fornecedor}
                      </td>
                      <td className="p-4 text-sm text-dark-300 max-w-[200px] truncate">
                        {pag.origem === 'DDA' ? `Doc: ${pag.documento}` : pag.descricao || '—'}
                      </td>
                      <td className="p-4">
                        {pag.status === 'enviado_ca' ? (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 w-fit">
                            <Check size={12}/> Sincronizado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 w-fit">
                            <AlertCircle size={12}/> Pendente
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-white">
                        {pag.data_vencimento.split('-').reverse().join('/')}
                      </td>
                      <td className="p-4 text-right font-bold text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pag.valor)}
                      </td>
                      <td className="p-4 text-center">
                        {pag.status !== 'enviado_ca' && (
                           <button 
                             onClick={() => handleExportarContaAzul(pag)}
                             disabled={exportando}
                             title="Enviar para Conta Azul"
                             className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
                           >
                             <Send size={14}/>
                           </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totais (Footer da Tabela) */}
          <div className="bg-dark-900 border-t border-dark-700 p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-dark-700">
            <div className="pt-4 sm:pt-0 sm:px-6">
              <p className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-1">Total Despesas</p>
              <p className="text-2xl font-black text-rose-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
              </p>
            </div>
            <div className="pt-4 sm:pt-0 sm:px-6">
              <p className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-1">Entradas (Transf)</p>
              <p className="text-2xl font-black text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEntradas)}
              </p>
            </div>
            <div className="pt-4 sm:pt-0 sm:px-6">
              <p className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-1">Saldo Final Estimado</p>
              <p className="text-2xl font-black text-brand-400">
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
    </>
  )
}
