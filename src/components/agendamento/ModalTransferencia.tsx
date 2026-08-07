'use client'

import { useState } from 'react'
import { X, ArrowRightLeft, CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Empresa } from '@/types'

interface ModalTransferenciaProps {
  open: boolean
  onClose: () => void
  empresaAtiva: Empresa | null
  empresas: Empresa[]
  onSuccess: () => void
}

export default function ModalTransferencia({ open, onClose, empresaAtiva, empresas, onSuccess }: ModalTransferenciaProps) {
  const [origem, setOrigem] = useState(empresaAtiva?.id || '')
  const [destino, setDestino] = useState('')
  const [dataTransferencia, setDataTransferencia] = useState('')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const supabase = createClient()

  if (!open) return null

  const handleSalvar = async () => {
    if (!origem || !destino || !dataTransferencia || !valor) {
      toast.error('Preencha Origem, Destino, Data e Valor.')
      return
    }

    if (origem === destino) {
      toast.error('Origem e Destino não podem ser a mesma loja.')
      return
    }

    setSalvando(true)
    try {
      const empresaDestino = empresas.find(e => e.id === destino)
      
      // Cria a transferência como um agendamento com o tipo Transferência
      const { error } = await supabase.from('agendamentos').insert({
        empresa_id: origem,
        fornecedor: empresaDestino?.nome || 'Loja Destino',
        descricao: descricao || `Transferência para ${empresaDestino?.nome}`,
        data_vencimento: dataTransferencia,
        valor: parseFloat(valor.replace(',', '.')),
        categoria: 'Transferência',
        tipo: 'Transferência'
      })

      if (error) throw error

      toast.success('Transferência registrada com sucesso!')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar transferência')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <ArrowRightLeft size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Nova Transferência</h3>
              <p className="text-dark-400 text-xs">Transfira saldo entre as lojas cadastradas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Origem <span className="text-rose-400">*</span></label>
              <select value={origem} onChange={e => setOrigem(e.target.value)} className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all">
                <option value="" disabled>Selecione...</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 relative">
              <label className="text-xs font-semibold text-dark-400 uppercase">Destino <span className="text-rose-400">*</span></label>
              <select value={destino} onChange={e => setDestino(e.target.value)} className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all">
                <option value="" disabled>Selecione...</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Data Transferência <span className="text-rose-400">*</span></label>
              <input type="date" value={dataTransferencia} onChange={e => setDataTransferencia(e.target.value)} className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Valor (R$) <span className="text-rose-400">*</span></label>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0.00" className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-dark-400 uppercase">Descrição</label>
            <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da transferência..." className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-dark-700 flex justify-end gap-3 shrink-0 bg-dark-900 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition-all disabled:opacity-50">
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
