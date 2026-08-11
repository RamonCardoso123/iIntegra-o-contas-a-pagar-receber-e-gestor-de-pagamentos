'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Calendar as CalendarIcon, Upload, CheckCircle2, Loader2, Sparkles, FileCheck2, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Empresa } from '@/types'
import SelectorFornecedor from '@/components/upload/SelectorFornecedor'
import SelectorCategoria from '@/components/upload/SelectorCategoria'
import SelectorContaFinanceira, { ContaFinanceiraOpcao } from '@/components/upload/SelectorContaFinanceira'

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
  const [lendoAnexo, setLendoAnexo] = useState(false)
  const [nomeAnexo, setNomeAnexo] = useState('')
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null)
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceiraOpcao[]>([])
  const [editandoFornecedor, setEditandoFornecedor] = useState(false)
  const [editandoCategoria, setEditandoCategoria] = useState(false)
  const [editandoConta, setEditandoConta] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!open || !empresaAtiva?.id) return
    fetch(`/api/conta-azul/contas-financeiras?empresa_id=${empresaAtiva.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.contas && Array.isArray(data.contas)) {
          setContasFinanceiras(data.contas)
        }
      })
      .catch(() => {
        // Sem conexão com o Conta Azul (ou token expirado) — o campo
        // continua funcionando, só sem sugestões automáticas.
      })
  }, [open, empresaAtiva?.id])

  if (!open) return null

  const handleArquivoAnexo = async (file: File | undefined | null) => {
    if (!file) return
    setNomeAnexo(file.name)
    setArquivoAnexo(file)
    setLendoAnexo(true)
    toast.loading('Lendo documento com IA...', { id: 'ler_anexo' })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const resp = await fetch('/api/extrair-anexo', { method: 'POST', body: formData })
      const json = await resp.json()

      if (!resp.ok) {
        throw new Error(json.error || 'Falha ao ler o documento.')
      }

      const dados = json.dados
      if (dados.fornecedor) setFornecedor(dados.fornecedor)
      if (dados.data_vencimento) setDataVencimento(dados.data_vencimento)
      if (dados.valor) setValor(String(dados.valor))
      if (dados.categoria) setCategoria(dados.categoria)
      if (dados.tipo) setTipo(dados.tipo)
      if (dados.chave_pix) setChavePix(dados.chave_pix)

      // Pra boleto: a Descrição mostra o nº do documento e a Data de
      // Competência usa a data do próprio documento (não o vencimento)
      if (dados.tipo === 'Boleto' && dados.documento) {
        setDescricao(`Boleto nº ${dados.documento}`)
      } else if (dados.descricao) {
        setDescricao(dados.descricao)
      }
      if (dados.tipo === 'Boleto' && dados.data_documento) {
        setDataCompetencia(dados.data_documento)
      }

      toast.success('Documento lido! Confira os campos antes de salvar.', { id: 'ler_anexo' })
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível ler o anexo automaticamente. Preencha manualmente.', { id: 'ler_anexo' })
    } finally {
      setLendoAnexo(false)
    }
  }

  const handleSalvar = async () => {
    if (!empresaAtiva) return
    if (!fornecedor || !dataVencimento || !dataCompetencia || !valor) {
      toast.error('Preencha os campos obrigatórios (Fornecedor, Vencimento, Competência e Valor).')
      return
    }

    setSalvando(true)
    try {
      // Se tiver anexo, sobe pro Supabase Storage antes de salvar o
      // agendamento, pra já guardar o link de visualização junto.
      let anexoUrl = ''
      if (arquivoAnexo) {
        try {
          const extensao = arquivoAnexo.name.split('.').pop() || 'bin'
          const caminho = `${empresaAtiva.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extensao}`
          const { error: erroUpload } = await supabase.storage
            .from('anexos')
            .upload(caminho, arquivoAnexo, { upsert: false, contentType: arquivoAnexo.type || undefined })

          if (erroUpload) {
            toast.error('Não foi possível salvar o anexo (' + erroUpload.message + '), mas o agendamento será salvo mesmo assim.')
          } else {
            const { data: urlData } = supabase.storage.from('anexos').getPublicUrl(caminho)
            anexoUrl = urlData.publicUrl
          }
        } catch {
          toast.error('Não foi possível salvar o anexo, mas o agendamento será salvo mesmo assim.')
        }
      }

      const { error } = await supabase.from('agendamentos').insert({
        empresa_id: empresaAtiva.id,
        fornecedor,
        descricao,
        data_vencimento: dataVencimento,
        competencia: dataCompetencia,
        valor: parseFloat(valor.replace(',', '.')),
        categoria,
        conta_pagamento: contaPagamento,
        tipo,
        chave_pix: chavePix,
        anexo_url: anexoUrl || null
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
          {/* Anexo compacto no topo — anexa e a IA preenche o resto do formulário */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => handleArquivoAnexo(e.target.files?.[0])}
            />
            <div
              onClick={() => !lendoAnexo && fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                if (!lendoAnexo) handleArquivoAnexo(e.dataTransfer.files?.[0])
              }}
              className={`flex items-center gap-3 border border-dashed rounded-xl px-4 py-2.5 transition-all ${
                lendoAnexo
                  ? 'border-brand-500 bg-brand-500/5 text-brand-300 cursor-wait'
                  : 'border-dark-700 text-dark-400 hover:bg-dark-800 hover:border-dark-500 cursor-pointer'
              }`}
            >
              {lendoAnexo ? (
                <>
                  <Loader2 size={16} className="animate-spin shrink-0" />
                  <span className="text-sm font-medium">Lendo documento com IA...</span>
                </>
              ) : nomeAnexo ? (
                <>
                  <FileCheck2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="text-sm text-dark-300 truncate">{nomeAnexo}</span>
                  <span className="text-xs text-dark-500 ml-auto shrink-0">Clique pra trocar</span>
                </>
              ) : (
                <>
                  <Paperclip size={16} className="shrink-0" />
                  <span className="text-sm">Anexar boleto/imposto/taxa</span>
                  <span className="text-xs text-dark-500 ml-auto flex items-center gap-1 shrink-0">
                    <Sparkles size={12} className="text-brand-400" /> a IA preenche os campos
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Fornecedor / Colaborador <span className="text-rose-400">*</span></label>
              {editandoFornecedor ? (
                <SelectorFornecedor
                  valorInicial={fornecedor}
                  onSelect={nome => { setFornecedor(nome); setEditandoFornecedor(false) }}
                  onCancel={() => setEditandoFornecedor(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditandoFornecedor(true)}
                  className="w-full text-left bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm hover:border-brand-500 transition-all truncate"
                >
                  {fornecedor || <span className="text-dark-500">Clique para buscar...</span>}
                </button>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
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
              <label className="text-xs font-semibold text-dark-400 uppercase">Data Competência <span className="text-rose-400">*</span></label>
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
              {editandoCategoria ? (
                <SelectorCategoria
                  valorInicial={categoria}
                  onSelect={nome => { setCategoria(nome); setEditandoCategoria(false) }}
                  onCancel={() => setEditandoCategoria(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditandoCategoria(true)}
                  className="w-full text-left bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm hover:border-brand-500 transition-all truncate"
                >
                  {categoria || <span className="text-dark-500">Clique para buscar...</span>}
                </button>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Forma de Pagamento</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all">
                <option value="PIX">PIX</option>
                <option value="Boleto">Boleto</option>
                <option value="TED">TED</option>
                <option value="Folha">Folha</option>
                <option value="Imposto">Imposto</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Conta de Pagamento</label>
              {editandoConta ? (
                <SelectorContaFinanceira
                  valorInicial={contaPagamento}
                  contas={contasFinanceiras}
                  onSelect={nome => { setContaPagamento(nome); setEditandoConta(false) }}
                  onCancel={() => setEditandoConta(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditandoConta(true)}
                  className="w-full text-left bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm hover:border-brand-500 transition-all truncate"
                >
                  {contaPagamento || <span className="text-dark-500">Clique para buscar...</span>}
                </button>
              )}
            </div>
          </div>

          {tipo === 'PIX' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-400 uppercase">Chave PIX</label>
              <input type="text" value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="Chave do beneficiário" className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all" />
            </div>
          )}
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
