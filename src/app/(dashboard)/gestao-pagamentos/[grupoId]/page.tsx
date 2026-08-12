"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, FileText, LogOut, Upload, ChevronDown, Plus, Users,
  AlertCircle, Loader2, Building2, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import LojaCard from '@/components/gestao-pagamentos/LojaCard'
import { Empresa, Grupo } from '@/types'

export default function GrupoDetalhe() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const grupoId = params?.grupoId as string

  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [lojas, setLojas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalNovaLojaAberto, setModalNovaLojaAberto] = useState(false)
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<Empresa[]>([])
  const [carregandoDisponiveis, setCarregandoDisponiveis] = useState(false)
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null)

  useEffect(() => {
    if (grupoId) carregarGrupo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId])

  async function carregarGrupo() {
    setCarregando(true)
    const { data: grupoData } = await supabase.from('grupos').select('*').eq('id', grupoId).single()
    setGrupo(grupoData || null)

    const { data: lojasData } = await supabase.from('empresas').select('*').eq('grupo_id', grupoId).order('nome')
    setLojas(lojasData || [])
    setCarregando(false)
  }

  async function abrirModalNovaLoja() {
    setModalNovaLojaAberto(true)
    setCarregandoDisponiveis(true)
    const { data } = await supabase.from('empresas').select('*').is('grupo_id', null).order('nome')
    setEmpresasDisponiveis(data || [])
    setCarregandoDisponiveis(false)
  }

  async function handleAdicionarLoja(empresa: Empresa) {
    setAdicionandoId(empresa.id)
    try {
      const { error } = await supabase.from('empresas').update({ grupo_id: grupoId }).eq('id', empresa.id)
      if (error) throw error
      toast.success(`${empresa.nome} adicionada ao grupo!`)
      setModalNovaLojaAberto(false)
      carregarGrupo()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar loja')
    } finally {
      setAdicionandoId(null)
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-dark-400" size={32} />
      </div>
    )
  }

  if (!grupo) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-dark-400">Grupo não encontrado.</p>
        <button onClick={() => router.push('/gestao-pagamentos')} className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          <ArrowLeft size={16} /> Voltar pra Meus Grupos
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Top Navbar */}
      <div className="bg-[#0b0e14] border-b border-dark-700 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/gestao-pagamentos')} className="flex items-center gap-2 text-dark-300 hover:text-white transition-colors bg-dark-800 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Pagamentos BPO Financeiro</h1>
            <p className="text-dark-400 text-xs">Grupo: <span className="text-dark-300 font-semibold">{grupo.nome}</span></p>
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

          <button
            onClick={abrirModalNovaLoja}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus size={16} /> Nova Loja
          </button>

          <button className="flex items-center gap-2 bg-dark-800 border border-dark-600 hover:bg-dark-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
            <Upload size={16} className="text-dark-300" /> Exportar <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-4 animate-fade-in">
        {lojas.length === 0 ? (
          <div className="bg-[#11141c] border border-dark-700 rounded-2xl p-16 flex flex-col items-center justify-center gap-4 text-center">
            <Building2 className="text-dark-600" size={40} />
            <p className="text-dark-400 font-semibold">Esse grupo ainda não tem nenhuma loja.</p>
            <button onClick={abrirModalNovaLoja} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              <Plus size={16} /> Adicionar loja
            </button>
          </div>
        ) : (
          lojas.map(loja => (
            <LojaCard key={loja.id} empresa={loja} lojasDoGrupo={lojas} />
          ))
        )}
      </div>

      {/* Modal Nova Loja — escolhe entre empresas já cadastradas (sem grupo) */}
      {modalNovaLojaAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-5 border-b border-dark-700 shrink-0">
              <div>
                <h3 className="text-white font-bold text-lg">Adicionar loja ao grupo</h3>
                <p className="text-dark-400 text-xs">Escolha uma empresa já cadastrada (com CA/Datacar conectados)</p>
              </div>
              <button onClick={() => setModalNovaLojaAberto(false)} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {carregandoDisponiveis ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin text-dark-400" size={24} />
                </div>
              ) : empresasDisponiveis.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <p className="text-dark-400 text-sm">Nenhuma empresa disponível pra adicionar.</p>
                  <p className="text-dark-500 text-xs mt-1">Todas as empresas cadastradas já pertencem a algum grupo, ou você ainda não cadastrou nenhuma. Cadastre uma nova empresa na aba Empresas primeiro.</p>
                </div>
              ) : (
                empresasDisponiveis.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleAdicionarLoja(emp)}
                    disabled={!!adicionandoId}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-xl transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-9 h-9 bg-brand-500/10 border border-brand-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-400 font-bold text-xs">{emp.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{emp.nome}</p>
                      <p className="text-dark-500 text-xs flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.conta_azul_connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {emp.conta_azul_connected ? 'CA conectado' : 'CA não conectado'}
                      </p>
                    </div>
                    {adicionandoId === emp.id && <Loader2 className="animate-spin text-dark-400" size={16} />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
