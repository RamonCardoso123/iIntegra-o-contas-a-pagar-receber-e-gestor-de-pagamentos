"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Building2, Loader2, X, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Grupo } from '@/types'

export default function MeusGrupos() {
  const router = useRouter()
  const supabase = createClient()

  const [grupos, setGrupos] = useState<(Grupo & { totalLojas: number })[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalNovoGrupoAberto, setModalNovoGrupoAberto] = useState(false)
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState('')
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    carregarGrupos()
  }, [])

  async function carregarGrupos() {
    setCarregando(true)
    const { data: gruposData } = await supabase.from('grupos').select('*').order('created_at', { ascending: false })

    const gruposComContagem = await Promise.all(
      (gruposData || []).map(async (g) => {
        const { count } = await supabase.from('empresas').select('id', { count: 'exact', head: true }).eq('grupo_id', g.id)
        return { ...g, totalLojas: count || 0 }
      })
    )

    setGrupos(gruposComContagem)
    setCarregando(false)
  }

  async function handleCriarGrupo() {
    if (!nomeNovoGrupo.trim()) {
      toast.error('Dê um nome para o grupo.')
      return
    }
    setCriando(true)
    try {
      const { data, error } = await supabase.from('grupos').insert({ nome: nomeNovoGrupo.trim() }).select('id').single()
      if (error) throw error
      toast.success('Grupo criado com sucesso!')
      setModalNovoGrupoAberto(false)
      setNomeNovoGrupo('')
      if (data?.id) {
        router.push(`/gestao-pagamentos/${data.id}`)
      } else {
        carregarGrupos()
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar grupo')
    } finally {
      setCriando(false)
    }
  }

  return (
    <>
      <div className="bg-[#0b0e14] border-b border-dark-700 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-dark-300 hover:text-white transition-colors bg-dark-800 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Meus Grupos</h1>
            <p className="text-dark-400 text-xs uppercase tracking-wider">Gestão BPO Financeiro</p>
          </div>
        </div>

        <button
          onClick={() => setModalNovoGrupoAberto(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus size={16} /> Novo Grupo
        </button>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto animate-fade-in">
        {carregando ? (
          <div className="flex items-center justify-center h-72">
            <Loader2 className="animate-spin text-dark-400" size={32} />
          </div>
        ) : grupos.length === 0 ? (
          <div className="bg-[#11141c] border border-dark-700 rounded-2xl p-16 flex flex-col items-center justify-center gap-4 text-center">
            <Building2 className="text-dark-600" size={40} />
            <p className="text-dark-400 font-semibold">Você ainda não criou nenhum grupo.</p>
            <p className="text-dark-500 text-sm max-w-sm">Um grupo reúne as lojas de um mesmo cliente (ex: "Grupo do Seu Zé"). Crie um grupo e depois adicione as lojas dele.</p>
            <button onClick={() => setModalNovoGrupoAberto(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              <Plus size={16} /> Criar meu primeiro grupo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grupos.map(grupo => (
              <button
                key={grupo.id}
                onClick={() => router.push(`/gestao-pagamentos/${grupo.id}`)}
                className="bg-[#11141c] border border-dark-700 hover:border-brand-500 rounded-2xl p-5 text-left transition-all shadow-lg group"
              >
                <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                  <Building2 size={18} className="text-brand-400" />
                </div>
                <p className="text-white font-bold text-base truncate mb-1">{grupo.nome}</p>
                <p className="text-dark-400 text-xs font-semibold">
                  {grupo.totalLojas} {grupo.totalLojas === 1 ? 'loja' : 'lojas'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {modalNovoGrupoAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h3 className="text-white font-bold text-lg">Novo Grupo</h3>
              <button onClick={() => setModalNovoGrupoAberto(false)} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-2">
              <label className="text-xs font-semibold text-dark-400 uppercase">Nome do grupo</label>
              <input
                type="text"
                autoFocus
                value={nomeNovoGrupo}
                onChange={e => setNomeNovoGrupo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCriarGrupo() }}
                placeholder='Ex: "Grupo do Seu Zé"'
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-all"
              />
            </div>
            <div className="p-5 border-t border-dark-700 flex justify-end gap-3">
              <button onClick={() => setModalNovoGrupoAberto(false)} className="px-5 py-2.5 rounded-xl font-semibold bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 transition-all">
                Cancelar
              </button>
              <button onClick={handleCriarGrupo} disabled={criando} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/30 transition-all disabled:opacity-50">
                {criando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {criando ? 'Criando...' : 'Criar Grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
