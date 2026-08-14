import { NextResponse } from 'next/server'

// Rota de diagnóstico temporária, usada só pra investigar se o endpoint
// /movimentodiario do Datacar servia como substituto do Relatório de
// Caixa (CxRl010). Conclusão: não serve — traz um resumo financeiro por
// dia (venda à vista/a prazo, custo financeiro, fluxo de caixa), não o
// fechamento de caixa por operador com formas de pagamento. Desativada
// depois do teste (o sandbox não permite apagar o arquivo, só esvaziar).
export async function GET() {
  return NextResponse.json({ error: 'Rota de diagnóstico desativada' }, { status: 404 })
}
