'use client'

import { useState } from 'react'
import { X, Edit2, ArrowRightLeft, Trash2 } from 'lucide-react'

interface ModalDetalhesProps {
  open: boolean
  onClose: () => void
  titulo: string
  lancamentos: any[]
  onDelete: (ids: string[]) => void
  onAgendar: (ids: string[]) => void
  onEditarItem?: (item: any) => void
  onTransferirItem?: (item: any) => void
}

export default function ModalDetalhesLancamentos({
  open,
  onClose,
  titulo,
  lancamentos,
  onDelete,
  onAgendar,
  onEditarItem,
  onTransferirItem
}: ModalDetalhesProps) {
  const [selecionados, setSelecionados] = useState<string[]>([])

  if (!open) return null

  const toggleSelect = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(i => i !== id))
    } else {
      setSelecionados([...selecionados, id])
    }
  }

  const toggleSelectAll = () => {
    if (selecionados.length === lancamentos.length) {
      setSelecionados([])
    } else {
      setSelecionados(lancamentos.map(l => l.id))
    }
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
    
  const total = lancamentos.reduce((acc, curr) => acc + Number(curr.valor), 0)
  
  const totalSelecionado = lancamentos
    .filter(l => selecionados.includes(l.id))
    .reduce((acc, curr) => acc + Number(curr.valor), 0)

  const totalPendente = total - totalSelecionado

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#11141c] border border-dark-700 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="flex flex-col p-5 border-b border-dark-700 gap-4 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-xl">{titulo}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Action Bar (Top) */}
          <div className="h-10 flex items-center justify-end">
             {selecionados.length > 0 && (
                <div className="flex items-center gap-2 animate-fade-in">
                   <button 
                     onClick={() => { onDelete(selecionados); setSelecionados([]) }}
                     className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                   >
                     Excluir ({selecionados.length})
                   </button>
                   <button 
                     onClick={() => { onAgendar(selecionados); setSelecionados([]) }}
                     className="bg-amber-500 hover:bg-amber-600 text-[#0b0e14] px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                   >
                     Voltar para Aberto
                   </button>
                </div>
             )}
          </div>
        </div>

        {/* Content (Table) */}
        <div className="flex-1 overflow-auto custom-scrollbar p-0">
           <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0b0e14] z-10">
                <tr className="border-b border-dark-700 text-[10px] uppercase font-bold tracking-widest text-dark-400">
                  <th className="px-6 py-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={selecionados.length > 0 && selecionados.length === lancamentos.length}
                      onChange={toggleSelectAll}
                      className="rounded border-dark-500 bg-dark-800 text-blue-500 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-4">Beneficiário</th>
                  <th className="px-6 py-4">Doc.</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Situação</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {lancamentos.length === 0 ? (
                  <tr>
                     <td colSpan={7} className="p-12 text-center text-dark-500 font-semibold text-sm">
                       Nenhum lançamento encontrado.
                     </td>
                  </tr>
                ) : (
                  lancamentos.map((pag, idx) => {
                     const doc = pag.documento || pag.cpf_cnpj || '—'
                     const nome = pag.beneficiario || pag.fornecedor || '—'
                     
                     return (
                        <tr key={pag.id || idx} className={`transition-colors ${selecionados.includes(pag.id) ? 'bg-blue-500/10' : 'hover:bg-dark-800/30'}`}>
                           <td className="px-6 py-4 text-center">
                              <input 
                                type="checkbox" 
                                checked={selecionados.includes(pag.id)}
                                onChange={() => toggleSelect(pag.id)}
                                className="rounded border-dark-500 bg-dark-800 text-blue-500 focus:ring-blue-500 cursor-pointer w-4 h-4"
                              />
                           </td>
                           <td className="px-6 py-4 font-semibold text-white text-sm">
                              {nome}
                           </td>
                           <td className="px-6 py-4 text-sm text-dark-300">
                              {doc}
                           </td>
                           <td className="px-6 py-4 text-sm text-dark-300">
                              {pag.data_vencimento ? pag.data_vencimento.split('-').reverse().join('/') : '—'}
                           </td>
                           <td className="px-6 py-4">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${pag.status === 'enviado_ca' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-500/10 text-emerald-400'} uppercase tracking-wider`}>
                                 {pag.status === 'enviado_ca' ? 'Enviado' : 'Agendado'}
                              </span>
                           </td>
                           <td className="px-6 py-4 font-bold text-white text-sm">
                              {formatCurrency(pag.valor)}
                           </td>
                           <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                 {onEditarItem && (
                                   <button onClick={() => onEditarItem(pag)} className="text-dark-400 hover:text-white transition-colors p-1" title="Editar">
                                      <Edit2 size={14}/>
                                   </button>
                                 )}
                                 {onTransferirItem && (
                                   <button onClick={() => onTransferirItem(pag)} className="text-dark-400 hover:text-emerald-400 transition-colors p-1" title="Transferir">
                                      <ArrowRightLeft size={14}/>
                                   </button>
                                 )}
                                 <button onClick={() => onDelete([pag.id])} className="text-dark-400 hover:text-rose-400 transition-colors p-1" title="Excluir">
                                    <Trash2 size={14}/>
                                 </button>
                              </div>
                           </td>
                        </tr>
                     )
                  })
                )}
              </tbody>
           </table>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-700 shrink-0 bg-[#0b0e14] rounded-b-2xl flex items-center justify-between">
           <div>
              <p className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Total {titulo.includes('DDA') ? 'DDA' : 'Folha'}</p>
              <p className="text-xl font-black text-white">{formatCurrency(total)}</p>
           </div>
           
           <div className="flex gap-12">
              <div className="text-right">
                 <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Pendente</p>
                 <p className="text-xl font-black text-amber-500">{formatCurrency(totalPendente)}</p>
              </div>
              
              <div className="text-right">
                 <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Selecionado</p>
                 <p className="text-xl font-black text-blue-500">{formatCurrency(totalSelecionado)}</p>
              </div>
           </div>
        </div>
        
      </div>
    </div>
  )
}
