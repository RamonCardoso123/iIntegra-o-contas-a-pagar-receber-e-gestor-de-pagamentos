import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buscarMovimentoDiario } from '@/services/datacar/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * ROTA DE DIAGNÓSTICO — temporária, só pra investigar se o endpoint
 * /movimentodiario do Datacar traz dados equivalentes ao Relatório de
 * Caixa (CxRl010) do Datacar.Cloud, que não existe na API pública.
 * Não é usada por nenhuma tela do app — pode ser removida depois.
 *
 * Uso: GET /api/datacar/testar-movimento?empresa_nome=barao&dtIni=2026-08-13&dtFim=2026-08-14
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const empresaNome = searchParams.get('empresa_nome')
    const empresaId = searchParams.get('empresa_id')
    const dtIni = searchParams.get('dtIni')
    const dtFim = searchParams.get('dtFim')

    if (!dtIni || !dtFim) {
      return NextResponse.json({ error: 'dtIni e dtFim são obrigatórios (formato aaaa-mm-dd)' }, { status: 400 })
    }
    if (!empresaNome && !empresaId) {
      return NextResponse.json({ error: 'Informe empresa_nome ou empresa_id' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('empresas')
      .select('id, nome, datacar_token, datacar_cod_emp, datacar_id_operador')

    query = empresaId ? query.eq('id', empresaId) : query.ilike('nome', `%${empresaNome}%`)

    const { data: empresas, error: empErr } = await query.limit(5)

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 500 })
    }
    if (!empresas || empresas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma empresa encontrada com esse nome' }, { status: 404 })
    }
    if (empresas.length > 1) {
      return NextResponse.json({
        aviso: 'Mais de uma empresa encontrada, refine a busca ou use empresa_id',
        opcoes: empresas.map(e => ({ id: e.id, nome: e.nome })),
      }, { status: 300 })
    }

    const empresa = empresas[0]
    if (!empresa.datacar_token || !empresa.datacar_cod_emp || !empresa.datacar_id_operador) {
      return NextResponse.json({ error: `Empresa "${empresa.nome}" não tem credenciais do Datacar configuradas` }, { status: 400 })
    }

    const credentials = {
      token: empresa.datacar_token,
      codEmp: empresa.datacar_cod_emp,
      idOperador: empresa.datacar_id_operador,
    }

    const dados = await buscarMovimentoDiario(credentials, dtIni, dtFim)

    return NextResponse.json({
      empresa_nome: empresa.nome,
      total_registros: Array.isArray(dados) ? dados.length : 0,
      campos_primeiro_registro: Array.isArray(dados) && dados[0] ? Object.keys(dados[0] as object) : [],
      amostra: Array.isArray(dados) ? dados.slice(0, 3) : dados,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
