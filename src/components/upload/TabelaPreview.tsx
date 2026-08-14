import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ContaPagarPreview } from '@/types'
import { CheckCircle, AlertCircle, Trash2, Edit2, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import SelectorFornecedor from './SelectorFornecedor'
import SelectorCategoria from './SelectorCategoria'
import SelectorContaFinanceira, { ContaFinanceiraOpcao } from './SelectorContaFinanceira'
import { LISTA_CATEGORIAS_FLAT } from '@/lib/conta-azul/constants'

interface Props {
  dados: (ContaPagarPreview & { originalIdx?: number })[]
  filtro: 'todos' | 'erro' | 'revisao'
  selecionados: Set<number>
  onToggle: (idx: number) => void
  onToggleTodos: () => void
  onRemover: (idx: number) => void
  onUpdateFornecedor: (idx: number, novoNome: string) => void
  onUpdateCategoria: (idx: number, novaCategoria: string) => void
  onUpdateConta: (idx: number, novaConta: string, contaId: string) => void
  onRemoverLote: (indices: number[]) => void
  onUpdateCategoriaLote: (indices: number[], novaCategoria: string) => void
  onUpdateContaLote: (indices: number[], novaConta: string) => void
  contasFinanceiras: ContaFinanceiraOpcao[]
  onUpdateValor: (idx: number, novoValor: number) => void
  onUpdateVencimento: (idx: number, novaData: string) => void
  onUpdateEmissao: (idx: number, novaData: string) => void
  onUpdateDescricao: (idx: number, novaDesc: string) => void
}

interface DadosEdicaoLinha {
  fornecedor: string
  valor: number
  vencimento: string
  emissao: string
  categoria: string
  conta_financeira: string
  conta_financeira_id: string
  descricao: string
}

interface ModalEditarLinhaProps {
  item: ContaPagarPreview
  contasFinanceiras: ContaFinanceiraOpcao[]
  onCancelar: () => void
  onSalvar: (dados: DadosEdicaoLinha) => void
}

function ModalEditarLinha({ item, contasFinanceiras, onCancelar, onSalvar }: ModalEditarLinhaProps) {
  const [fornecedor, setFornecedor] = useState(item.fornecedor)
  const [valor, setValor] = useState(item.valor)
  const [vencimento, setVencimento] = useState(item.vencimento || '')
  const [emissao, setEmissao] = useState(item.emissao || '')
  const [categoria, setCategoria] = useState(item.categoria || 'Materiais para Revenda')
  const [contaFinanceira, setContaFinanceira] = useState(item.conta_financeira || '')
  const [contaFinanceiraId, setContaFinanceiraId] = useState(item.conta_financeira_id || '')
  const [descricao, setDescricao] = useState(item.descricao || '')

  const [editandoFornecedor, setEditandoFornecedor] = useState(false)
  const [editandoCategoria, setEditandoCategoria] = useState(false)
  const [editandoConta, setEditandoConta] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onCancelar}>
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Editar lançamento</h3>
          <button onClick={onCancelar} className="text-dark-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="text-[10px] text-dark-500 uppercase tracking-wider font-semibold">Fornecedor</label>
          {editandoFornecedor ? (
            <div className="mt-1">
              <SelectorFornecedor
                valorInicial={fornecedor}
                onCancel={() => setEditandoFornecedor(false)}
                onSelect={(nome) => { setFornecedor(nome); setEditandoFornecedor(false) }}
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-between bg-dark-900 border border-dark-700 hover:border-dark-600 rounded-lg px-3 py-2 mt-1 cursor-pointer transition-colors"
              onClick={() => setEditandoFornecedor(true)}
            >
              <span className="text-white text-sm truncate">{fornecedor}</span>
              <Edit2 size={12} className="text-dark-500 flex-shrink-0 ml-2" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-dark-500 uppercase tracking-wider font-semibold">Valor</label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 mt-1 text-white text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-dark-500 uppercase tracking-wider font-semibold">Vencimento</label>
            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 mt-1 text-white text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-dark-500 uppercase tracking-wider font-semibold">Competência</label>
            <input
              type="date"
              value={emissao}
              onChange={(e) => setEmissao(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 mt-1 text-white text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-dark-500 uppercase tracking-wider font-semibold">Categoria</label>
          {editandoCategoria ? (
            <div className="mt-1">
              <SelectorCategoria
                valorInicial={categoria}
                onCancel={() => setEditandoCategoria(false)}
                onSelect={(cat) => { setCategoria(cat); setEditandoCategoria(false) }}
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-between bg-dark-900 border border-dark-700 hover:border-dark-600 rounded-lg px-3 py-2 mt-1 cursor-pointer transition-colors"
              onClick={() => setEditandoCategoria(true)}
            >
              <span className="text-white text-sm truncate">{categoria}</span>
              <ChevronDown size={14} className="text-dark-500 flex-shrink-0 ml-2" />
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] text-dark-500 uppercase tracking-wider font-semibold">Conta</label>
          {editandoConta ? (
            <div className="mt-1">
              <SelectorContaFinanceira
                valorInicial={contaFinanceira}
                contas={contasFinanceiras}
                onCancel={() => setEditandoConta(false)}
                onSelect={(nome, id) => { setContaFinanceira(nome); setContaFinanceiraId(id); setEditandoConta(false) }}
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-between bg-blue-900/10 border border-blue-500/20 hover:border-blue-500/40 rounded-lg px-3 py-2 mt-1 cursor-pointer transition-colors"
              onClick={() => setEditandoConta(true)}
            >
              <span className="text-blue-300 text-sm truncate">{contaFinanceira || 'Selecionar conta...'}</span>
              <ChevronDown size={14} className="text-blue-500 flex-shrink-0 ml-2" />
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] text-dark-500 uppercase tracking-wider font-semibold">Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 mt-1 text-white text-sm outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-dark-700">
          <button onClick={onCancelar} className="px-4 py-2 rounded-lg text-xs font-semibold text-dark-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSalvar({ fornecedor, valor, vencimento, emissao, categoria, conta_financeira: contaFinanceira, conta_financeira_id: contaFinanceiraId, descricao })}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function BadgeMatch({ confianca, score }: { confianca: string; score: number }) {
  if (confianca === 'exato' || score === 100) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full font-medium" title="Nome exato encontrado no ContaAzul">
        <CheckCircle size={9} /> exato
      </span>
    )
  }
  
  if (score >= 80) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full font-medium" title={`Match automático — confiança ${score}%`}>
        ✓ {score}%
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full font-medium" title={`Match fraco — verifique — confiança ${score}%`}>
      <AlertCircle size={9} /> {score}%
    </span>
  )
}


export default function TabelaPreview({
  dados, filtro, selecionados, onToggle, onToggleTodos, onRemover, onUpdateFornecedor, onUpdateCategoria,
  onRemoverLote, onUpdateCategoriaLote, onUpdateConta, onUpdateContaLote, contasFinanceiras,
  onUpdateValor, onUpdateVencimento, onUpdateEmissao, onUpdateDescricao
}: Props) {
  const [editandoLinha, setEditandoLinha] = useState<number | null>(null)
  const [buscaFornecedor, setBuscaFornecedor] = useState('')
  const [buscaCategoria, setBuscaCategoria] = useState('')
  const [buscaValor, setBuscaValor] = useState('')
  const [loteCategoria, setLoteCategoria] = useState('')
  const [loteConta, setLoteConta] = useState('')
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showBulkList, setShowBulkList] = useState(false)
  const [showBulkContaList, setShowBulkContaList] = useState(false)
  
  // Filtrar os dados para exibição
  const dadosFiltrados = dados.filter(d => {
    // Filtro de status (bolinhas)
    if (filtro === 'erro' && d.valido) return false
    if (filtro === 'revisao' && (!d.valido || !d.matchFornecedor || d.matchFornecedor.confianca === 'exato')) return false
    
    // Filtros de texto/valor
    if (buscaFornecedor && !d.fornecedor.toLowerCase().includes(buscaFornecedor.toLowerCase())) return false
    if (buscaCategoria && ! (d.categoria || 'Materiais para Revenda').toLowerCase().includes(buscaCategoria.toLowerCase())) return false
    if (buscaValor && !d.valor.toString().includes(buscaValor)) return false
    
    return true
  })

  const todosSelecionados = selecionados.size === dados.length && dados.length > 0
  const algunsSelecionados = selecionados.size > 0 && selecionados.size < dados.length
  const temMatch = dados.some((d) => d.matchFornecedor)
  const corrigidos = dados.filter(
    (d) => d.matchFornecedor && (d.matchFornecedor.confianca === 'exato' || d.matchFornecedor.confianca === 'alto')
      && d.matchFornecedor.nomeOriginal !== d.matchFornecedor.nomeCorrigido
  ).length

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
      {/* Header da tabela */}
      <div className="px-4 py-3 border-b border-dark-700 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-dark-400">
            Mostrando <span className="text-white font-semibold">{dadosFiltrados.length}</span> de <span className="text-white font-semibold">{dados.length}</span> registros
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {temMatch && corrigidos > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                <CheckCircle size={11} />
                {corrigidos} fornecedores corrigidos
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle size={12} />
              {dados.filter((d) => d.valido).length} válidos
            </span>
            {dados.filter((d) => !d.valido).length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle size={12} />
                {dados.filter((d) => !d.valido).length} com erro
              </span>
            )}
          </div>
        </div>

        {/* Barra de Filtros Pesquisa */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Filtrar fornecedor..."
              value={buscaFornecedor}
              onChange={(e) => setBuscaFornecedor(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Filtrar categoria..."
              value={buscaCategoria}
              onChange={(e) => setBuscaCategoria(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Filtrar valor..."
              value={buscaValor}
              onChange={(e) => setBuscaValor(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Painel de Edição em Lote */}
        {selecionados.size > 0 && (
          <div className="bg-brand-600/10 border border-brand-600/30 rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-brand-400">{selecionados.size} selecionados</span>
              <div className="h-4 w-px bg-dark-600" />
              {showBulkEdit ? (
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Categoria em Lote */}
                  <div className="flex items-center gap-2 relative">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Categoria para todos..."
                        value={loteCategoria}
                        onChange={(e) => { setLoteCategoria(e.target.value); setShowBulkList(true) }}
                        onFocus={() => setShowBulkList(true)}
                        className="bg-dark-900 border border-dark-600 rounded px-2 py-1 text-xs text-white outline-none w-[160px]"
                      />
                      {showBulkList && (
                        <div className="absolute z-50 mt-1 w-full bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden max-h-[200px] overflow-y-auto">
                          {LISTA_CATEGORIAS_FLAT.filter(c => c.toLowerCase().includes(loteCategoria.toLowerCase())).slice(0, 10).map((cat, i) => (
                            <button
                              key={i}
                              onClick={() => { setLoteCategoria(cat); setShowBulkList(false) }}
                              className="w-full text-left px-3 py-1.5 text-[10px] text-white hover:bg-brand-600/20 transition-colors"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        onUpdateCategoriaLote(Array.from(selecionados), loteCategoria)
                        setShowBulkList(false)
                        setLoteCategoria('')
                      }}
                      disabled={!loteCategoria}
                      className="bg-brand-600 text-white px-2 py-1 rounded text-[10px] font-bold disabled:opacity-50"
                    >
                      Aplicar
                    </button>
                  </div>

                  {/* Conta em Lote */}
                  <div className="flex items-center gap-2 relative">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Conta para todos..."
                        value={loteConta}
                        onChange={(e) => { setLoteConta(e.target.value); setShowBulkContaList(true) }}
                        onFocus={() => setShowBulkContaList(true)}
                        className="bg-dark-900 border border-dark-600 rounded px-2 py-1 text-xs text-white outline-none w-[160px]"
                      />
                      {showBulkContaList && (
                        <div className="absolute z-50 mt-1 w-full bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden max-h-[200px] overflow-y-auto">
                          {contasFinanceiras.filter(c => c.descricao.toLowerCase().includes(loteConta.toLowerCase())).map((c) => (
                            <button
                              key={c.id}
                              onClick={() => { setLoteConta(c.descricao); setShowBulkContaList(false) }}
                              className="w-full text-left px-3 py-1.5 text-[10px] text-white hover:bg-blue-600/20 transition-colors"
                            >
                              {c.descricao}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        onUpdateContaLote(Array.from(selecionados), loteConta)
                        setShowBulkContaList(false)
                        setLoteConta('')
                      }}
                      disabled={!loteConta}
                      className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold disabled:opacity-50"
                    >
                      Aplicar
                    </button>
                  </div>

                  <button onClick={() => { setShowBulkEdit(false); setShowBulkList(false); setShowBulkContaList(false) }} className="text-dark-400 text-[10px]">Fechar</button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowBulkEdit(true)}
                  className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
                >
                  <Edit2 size={12} /> Alterar em Lote
                </button>
              )}
            </div>
            <button 
              onClick={() => {
                if (confirm(`Remover todos os ${selecionados.size} itens selecionados?`)) {
                  onRemoverLote(Array.from(selecionados))
                }
              }}
              className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
            >
              <Trash2 size={12} /> Excluir selecionados
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="table-bpo">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={todosSelecionados}
                  ref={(el) => { if (el) el.indeterminate = algunsSelecionados }}
                  onChange={onToggleTodos}
                  className="w-4 h-4 rounded border-dark-500 bg-dark-700 checked:bg-brand-600 cursor-pointer"
                />
              </th>
              <th>Fornecedor</th>
              <th className="text-right">Valor</th>
              <th>Vencimento</th>
              <th>Competência</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th>Descrição</th>
              <th className="text-center">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {dadosFiltrados.map((item) => {
              const idx = item.originalIdx ?? 0
              const match = item.matchFornecedor
              const foiCorrigido = match && match.nomeOriginal !== match.nomeCorrigido
                && (match.confianca === 'exato' || match.confianca === 'alto')
              const isEditing = editandoLinha === idx

              return (
                <tr
                  key={idx}
                  className={cn(
                    !item.valido && 'bg-red-500/5',
                    selecionados.has(idx) && item.valido && 'bg-brand-600/5',
                    isEditing && 'bg-brand-900/10'
                  )}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selecionados.has(idx)}
                      onChange={() => onToggle(idx)}
                      className="w-4 h-4 rounded border-dark-500 bg-dark-700 checked:bg-brand-600 cursor-pointer"
                    />
                  </td>
                  <td className="min-w-[250px]">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium transition-colors',
                          foiCorrigido ? 'text-emerald-400' : 'text-white',
                          !item.valido && 'text-red-400'
                        )}>
                          {item.fornecedor}
                        </span>
                        {match && <BadgeMatch confianca={match.confianca} score={match.score} />}
                      </div>
                      {foiCorrigido && (
                        <span className="text-[10px] text-dark-500 flex items-center gap-1">
                          original: {match.nomeOriginal}
                        </span>
                      )}
                      {item.ca_duplicidade?.encontrado && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20 w-max cursor-help" title={`Possível duplicidade no Conta Azul:\nStatus: ${item.ca_duplicidade.status}\nData: ${item.ca_duplicidade.vencimento}\nValor: R$ ${item.ca_duplicidade.valor}\nFornecedor: ${item.ca_duplicidade.fornecedor}`}>
                          <AlertCircle size={10} />
                          <span>Possível Duplicidade CA</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="text-right font-mono text-white min-w-[120px]">
                    {formatCurrency(item.valor)}
                  </td>
                  <td className="text-dark-300 text-sm min-w-[140px]">
                    {item.vencimento ? formatDate(item.vencimento) : '---'}
                  </td>
                  <td className="text-dark-300 text-sm min-w-[140px]">
                    {item.emissao ? formatDate(item.emissao) : '---'}
                  </td>
                  <td className="text-dark-300 text-xs min-w-[200px]">
                    <span className="truncate block bg-dark-900/50 border border-dark-700/50 rounded px-2 py-1">
                      {item.categoria || 'Materiais para Revenda'}
                    </span>
                  </td>
                  <td className="text-dark-300 text-xs min-w-[180px]">
                    <span className="truncate block text-blue-300 bg-blue-900/10 border border-blue-500/20 rounded px-2 py-1">
                      {item.conta_financeira || 'Selecionar conta...'}
                    </span>
                  </td>
                  <td className="text-dark-400 text-xs max-w-[200px]">
                    <span className="truncate block" title={item.descricao}>{item.descricao || '---'}</span>
                  </td>
                  <td className="text-center">
                    {item.valido ? (
                      <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">OK</span>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Erro</span>
                        <p className="text-[9px] text-red-400/70 max-w-[100px] leading-tight">
                          {item.erros?.[0]}
                        </p>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditandoLinha(idx)}
                        className="text-dark-500 hover:text-brand-400 transition-colors p-1"
                        title="Editar lançamento"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => onRemover(idx)}
                        className="text-dark-500 hover:text-red-400 transition-colors p-1"
                        title="Excluir lançamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editandoLinha !== null && (() => {
        const itemEditando = dados.find(d => (d.originalIdx ?? 0) === editandoLinha)
        if (!itemEditando) return null
        return (
          <ModalEditarLinha
            item={itemEditando}
            contasFinanceiras={contasFinanceiras}
            onCancelar={() => setEditandoLinha(null)}
            onSalvar={(vals) => {
              onUpdateFornecedor(editandoLinha, vals.fornecedor)
              onUpdateValor(editandoLinha, vals.valor)
              onUpdateVencimento(editandoLinha, vals.vencimento)
              onUpdateEmissao(editandoLinha, vals.emissao)
              onUpdateCategoria(editandoLinha, vals.categoria)
              onUpdateConta(editandoLinha, vals.conta_financeira, vals.conta_financeira_id)
              onUpdateDescricao(editandoLinha, vals.descricao)
              setEditandoLinha(null)
            }}
          />
        )
      })()}
    </div>
  )
}
