'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Empresa } from '@/types'

interface EmpresaContextType {
  empresas: Empresa[]
  empresaAtiva: Empresa | null
  setEmpresaAtiva: (empresa: Empresa) => void
  loading: boolean
  recarregar: (showLoading?: boolean) => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const carregarEmpresas = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (showLoading) setLoading(false); return }

      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('nome')

      if (error) throw error

      setEmpresas(data || [])

      // Recuperar empresa ativa do localStorage e mantê-la atualizada com os dados novos
      const savedId = localStorage.getItem('empresa_ativa_id')
      
      if (savedId) {
        const saved = data?.find((e) => e.id === savedId)
        if (saved) {
          setEmpresaAtivaState(saved)
        }
      } else if (!empresaAtiva && data && data.length > 0) {
        setEmpresaAtivaState(data[0])
      } else if (empresaAtiva) {
        // Se já tinha empresa ativa mas não no localStorage, atualiza os dados dela
        const atualizada = data?.find((e) => e.id === empresaAtiva.id)
        if (atualizada) setEmpresaAtivaState(atualizada)
      }
    } catch (err) {
      console.error('Erro ao carregar empresas:', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const setEmpresaAtiva = (empresa: Empresa) => {
    setEmpresaAtivaState(empresa)
    localStorage.setItem('empresa_ativa_id', empresa.id)
  }

  useEffect(() => {
    carregarEmpresas()
    
    // Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') carregarEmpresas()
      if (event === 'SIGNED_OUT') {
        setEmpresas([])
        setEmpresaAtivaState(null)
      }
    })

    // Realtime Listener (caso o Realtime esteja ativado na tabela empresas)
    const channel = supabase
      .channel('public:empresas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'empresas' },
        () => {
          console.log('[EmpresaContext] Realtime trigger: atualizando empresas')
          carregarEmpresas(false)
        }
      )
      .subscribe()

    // Polling de fallback (a cada 10 segundos) para caso o Realtime não esteja ativado
    // Isso garante que se o cliente autorizar o link, a tela destrava sozinha.
    const intervalId = setInterval(() => {
      carregarEmpresas(false)
    }, 10000)

    return () => {
      subscription.unsubscribe()
      supabase.removeChannel(channel)
      clearInterval(intervalId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <EmpresaContext.Provider
      value={{
        empresas,
        empresaAtiva,
        setEmpresaAtiva,
        loading,
        recarregar: carregarEmpresas,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider')
  return ctx
}
