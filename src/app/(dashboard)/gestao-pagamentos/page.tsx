"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Calendar, FileText, Check, AlertCircle, RefreshCw, Send, DollarSign } from 'lucide-react'

export default function GestaoPagamentos() {
  const supabase = createClient()
  const [empresas, setEmpresas] = useState<any[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [dataAtual, setDataAtual] = useState(new Date().toISOString().split('T')[0])
  
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' })

  useEffect(() => {
    carregarEmpresas()
  }, [])

  useEffect(() => {
    if (empresaId) {
      carregarPagamentos()
    }
  }, [empresaId, dataAtual])

  async function carregarEmpresas() {
    const { data } = await supabase.from('empresas').select('id, nome').order('nome')
    if (data) {
      setEmpresas(data)
      if (data.length > 0) setEmpresaId(data[0].id)
    }
  }

  async function carregarPagamentos() {
    setCarregando(true)
    
    // Buscar DDA
    const { data: ddas } = await supabase
      .from('pagamentos_dda')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('data_vencimento', dataAtual)
      
    // Buscar Agendamentos/Folha
    const { data: folha } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('data_vencimento', dataAtual)

    const unificados = [
      ...(ddas || []).map(d => ({ ...d, origem: 'DDA' })),
      ...(folha || []).map(f => ({ ...f, origem: 'Agendamento/Folha' }))
    ]
    
    setPagamentos(unificados)
    setCarregando(false)
  }

  async function handleImportarArquivo(e: React.ChangeEvent<HTMLInputElement>, tipo: 'dda' | 'folha') {
    const file = e.target.files?.[0]
    if (!file || !empresaId) return

    setImportando(true)
    setMensagem({ texto: 'Enviando para a Inteligência Artificial...', tipo: 'info' })
    
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
            empresa_id: empresaId,
            beneficiario: item.beneficiario,
            documento: item.documento,
            valor: parseFloat(item.valor),
            data_vencimento: item.data_vencimento || dataAtual
          })
        } else {
          await supabase.from('agendamentos').insert({
            empresa_id: empresaId,
            fornecedor: item.fornecedor,
            tipo: item.tipo || 'Folha',
            valor: parseFloat(item.valor),
            data_vencimento: item.data_vencimento || dataAtual,
            descricao: item.descricao,
            cpf_cnpj: item.cpf_cnpj
          })
        }
        count++
      }

      setMensagem({ texto: `${count} pagamento(s) extraído(s) e salvo(s) com sucesso!`, tipo: 'success' })
      carregarPagamentos()
    } catch (err: any) {
      setMensagem({ texto: err.message, tipo: 'error' })
    } finally {
      setImportando(false)
      // Reset input
      e.target.value = ''
    }
  }

  async function handleExportarContaAzul(pagamento: any) {
    setExportando(true)
    setMensagem({ texto: 'Preparando exportação para o Conta Azul...', tipo: 'info' })

    try {
      // 1. Inserir "escondido" na tabela de contas_pagar_importadas (Reaproveitamento Genial)
      const { data: inserido, error: errInsert } = await supabase
        .from('contas_pagar_importadas')
        .insert({
          empresa_id: empresaId,
          fornecedor: pagamento.origem === 'DDA' ? pagamento.beneficiario : pagamento.fornecedor,
          cnpj_fornecedor: pagamento.origem === 'DDA' ? null : pagamento.cpf_cnpj,
          valor: pagamento.valor,
          vencimento: pagamento.data_vencimento,
          emissao: pagamento.data_vencimento,
          descricao: pagamento.origem === 'DDA' ? `DDA - Doc: ${pagamento.documento}` : pagamento.descricao,
          categoria: 'Materiais para Revenda', // O backend da CA vai tentar match, se falhar usa isso
          status: 'pendente'
        })
        .select('id')
        .single()

      if (errInsert || !inserido) throw new Error('Erro ao preparar conta para envio.')

      // 2. Chamar a rota existente da Conta Azul passando apenas o ID dessa conta
      const res = await fetch('/api/conta-azul/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId,
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

      setMensagem({ texto: 'Enviado para a Conta Azul com sucesso!', tipo: 'success' })
      carregarPagamentos()

    } catch (err: any) {
      setMensagem({ texto: err.message, tipo: 'error' })
    } finally {
      setExportando(false)
    }
  }

  const totais = pagamentos.reduce((acc, curr) => acc + Number(curr.valor), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestor de Pagamentos</h1>
          <p className="text-gray-500 text-sm mt-1">Integração avançada com DDA e Folha (via IA)</p>
        </div>

        <div className="flex gap-4 items-center w-full md:w-auto">
          <select 
            value={empresaId} 
            onChange={e => setEmpresaId(e.target.value)}
            className="bg-white dark:bg-[#1A1F2E] border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm w-full md:w-64"
          >
            {empresas.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>

          <input 
            type="date"
            value={dataAtual}
            onChange={e => setDataAtual(e.target.value)}
            className="bg-white dark:bg-[#1A1F2E] border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm"
          />
        </div>
      </div>

      {mensagem.texto && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          mensagem.tipo === 'error' ? 'bg-red-50 text-red-600 border border-red-200' :
          mensagem.tipo === 'success' ? 'bg-green-50 text-green-600 border border-green-200' :
          'bg-blue-50 text-blue-600 border border-blue-200'
        }`}>
          {mensagem.tipo === 'error' ? <AlertCircle size={20}/> : 
           mensagem.tipo === 'success' ? <Check size={20}/> : 
           <RefreshCw size={20} className="animate-spin"/>}
          <span className="font-medium">{mensagem.texto}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Painel Esquerdo: Ações e Resumo */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1A1F2E] rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><DollarSign size={20}/> Resumo do Dia</h2>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais)}
            </div>
            <p className="text-sm text-gray-500 mt-1">{pagamentos.length} pagamentos encontrados em {dataAtual.split('-').reverse().join('/')}</p>
          </div>

          <div className="bg-white dark:bg-[#1A1F2E] rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Upload size={20}/> Importação por Inteligência</h2>
            <p className="text-sm text-gray-500 mb-6">Envie o arquivo JPG ou PDF. Nossa IA vai ler tudo automaticamente.</p>
            
            <div className="space-y-3">
              <label className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg cursor-pointer transition-colors opacity-90 hover:opacity-100">
                <FileText size={18} /> Importar DDA (Imagem/PDF)
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleImportarArquivo(e, 'dda')} disabled={importando} />
              </label>

              <label className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg cursor-pointer transition-colors opacity-90 hover:opacity-100">
                <FileText size={18} /> Importar Folha/Recibos (PDF)
                <input type="file" accept="application/pdf" className="hidden" onChange={e => handleImportarArquivo(e, 'folha')} disabled={importando} />
              </label>
            </div>
          </div>
        </div>

        {/* Painel Direito: Lista de Pagamentos */}
        <div className="md:col-span-2 bg-white dark:bg-[#1A1F2E] rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Lançamentos de Hoje</h2>
          
          {carregando ? (
            <div className="flex justify-center items-center h-48 text-gray-400">
              <RefreshCw className="animate-spin" />
            </div>
          ) : pagamentos.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-48 text-gray-400 gap-2">
              <Calendar size={32} className="opacity-50" />
              <p>Nenhum pagamento encontrado para esta data.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pagamentos.map((pag, idx) => (
                <div key={idx} className="flex flex-col md:flex-row items-center justify-between p-4 border border-gray-100 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-[#151923] transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${pag.origem === 'DDA' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {pag.origem}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {pag.origem === 'DDA' ? pag.beneficiario : pag.fornecedor}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {pag.origem === 'DDA' ? `Doc: ${pag.documento}` : pag.descricao || 'Sem descrição'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <span className="text-lg font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pag.valor)}
                    </span>

                    {pag.status === 'enviado_ca' ? (
                      <div className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-sm font-medium">
                        <Check size={16}/> Sincronizado
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleExportarContaAzul(pag)}
                        disabled={exportando}
                        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        <Send size={14}/> Enviar ao CA
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
