'use client'

import { useState } from 'react'
import { X, Calendar as CalendarIcon, Upload, CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Empresa } from '@/types'

interface ModalAgendamentoProps {
  open: boolean
  onClose: () => void
  empresaAtiva: Empresa | null
  onSuccess: () => void
}

export default function ModalAgendamento({ open, onClose, empresaAtiva, onSuccess }: ModalAgendamentoProps) {
  const [fornecedor, setFornecedor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [dataCompetencia, setDataCompetencia] = useState('')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState('')
  const [contaPagamento, setContaPagamento] = useState('')
  const [tipo, setTipo] = useState('PIX')
  const [chavePix, setChavePix] = useState('')
  const [salvando, setSalvando] = useState(false)
  const supabase = createClient()

  if (!open) return null

  const handleSalvar = async () => {
    if (!empresaAtiva) return
    if (!fornecedor || !dataVencimento || !valor) {
      toast.error('Preencha os campos obrigatórios (Fornecedor, Vencimento e Valor).')
      return
    }

    setSalvando(true)
    try {
      const { error } = await supabase.from('agendamentos').insert({
        empresa_id: empresaAtiva.id,
        fornecedor,
        descricao,
        data_vencimento: dataVencimento,
        valor: parseFloat(valor.replace(',', '.')),
        categoria,
        conta_pagamento: contaPagamento,
        tipo,
        chave_pix: chavePix
      })

      if (error) throw error

      toast.success('Agendamento criado com sucesso!')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar agendamento')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center">
              <CalendarIcon size={18} className="text-brand-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Novo Agendamento</h3>
              <p className="text-dark-400 text-xs">Crie um novo lançamento ou agendamento manualmente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Fornecedor / Colaborador <span className="text-rose-400">*</span></label>
              <input type="text" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Descrição / Observações</label>
              <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes do pagamento" className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Data Pgto (Venc.) <span className="text-rose-400">*</span></label>
              <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Data Competência</label>
              <input type="date" value={dataCompetencia} onChange={e => setDataCompetencia(e.target.value)} className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Valor (R$) <span className="text-rose-400">*</span></label>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0.00" className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Categoria</label>
              <input type="text" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Salários" className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Conta de Pagamento</label>
              <input type="text" value={contaPagamento} onChange={e => setContaPagamento(e.target.value)} placeholder="Ex: Banco Itaú" className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all">
                <option value="PIX">PIX</option>
                <option value="Boleto">Boleto</option>
                <option value="TED">TED</option>
                <option value="Folha">Folha</option>
                <option value="Imposto">Imposto</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          {tipo === 'PIX' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Chave PIX</label>
              <input type="text" value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="Chave do beneficiário" className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-dark-400 uppercase">Anexo (Opcional)</label>
            <div className="border-2 border-dashed border-dark-700 rounded-xl p-8 flex flex-col items-center justify-center text-dark-500 hover:bg-dark-800 hover:text-dark-300 hover:border-dark-500 cursor-pointer transition-all">
              <Upload size={24} className="mb-2" />
              <p className="text-sm font-medium">Arraste um arquivo ou clique para fazer upload</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-dark-700 flex justify-end gap-3 shrink-0 bg-dark-900 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/30 transition-all disabled:opacity-50">
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
