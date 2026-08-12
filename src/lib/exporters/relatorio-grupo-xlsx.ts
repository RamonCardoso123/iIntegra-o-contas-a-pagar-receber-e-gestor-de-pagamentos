/**
 * Exportador: gera o "Relatório Financeiro – Pagamentos BPO" (Excel Geral)
 * de um Grupo, no mesmo modelo usado no app antigo: uma tabela-resumo por
 * loja (DDA / Folha / Agendamento / Transferência / Total Despesas / Saldo
 * Final) seguida de uma seção DETALHADO com os lançamentos de cada loja
 * que teve movimento.
 */
import * as XLSX from 'xlsx'

export interface PagamentoRelatorio {
  origem: 'DDA' | 'Folha' | 'Agendamento' | 'Transferência' | 'Transferência Recebida'
  fornecedor?: string | null
  beneficiario?: string | null
  descricao?: string | null
  documento?: string | null
  data_vencimento: string
  valor: number
  status?: string | null
}

export interface LojaRelatorio {
  nome: string
  pagamentos: PagamentoRelatorio[]
}

const FMT_MOEDA = '"R$"#,##0.00'

function formatarDataHoraAgora(): string {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatarDataBr(iso: string): string {
  if (!iso) return ''
  const partes = iso.split('-')
  if (partes.length !== 3) return iso
  const [ano, mes, dia] = partes
  return `${dia}/${mes}/${ano}`
}

export function exportarRelatorioGeralXlsx(nomeGrupo: string, lojas: LojaRelatorio[]) {
  const linhas: any[][] = []
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
  const celulasMoeda: { r: number; c: number }[] = []

  function addLinha(valores: any[]) {
    linhas.push(valores)
    return linhas.length - 1 // índice (0-based) da linha recém-adicionada
  }

  function marcarMoeda(linhaIdx: number, colIdx: number) {
    celulasMoeda.push({ r: linhaIdx, c: colIdx })
  }

  // Título + data de geração
  let idx = addLinha([`Relatório Financeiro – Pagamentos BPO (Grupo: ${nomeGrupo})`])
  merges.push({ s: { r: idx, c: 0 }, e: { r: idx, c: 7 } })
  idx = addLinha([`Gerado em: ${formatarDataHoraAgora()}`])
  merges.push({ s: { r: idx, c: 0 }, e: { r: idx, c: 7 } })
  addLinha([])

  // Cabeçalho da tabela-resumo
  addLinha(['Loja / Saldo Inicial', 'DDA', 'Folha', 'Agendamento', 'Transferência', 'Total Despesas', 'Saldo Final', 'Status'])

  const resumo = lojas.map(loja => {
    const soma = (origem: PagamentoRelatorio['origem']) =>
      loja.pagamentos.filter(p => p.origem === origem).reduce((acc, p) => acc + Number(p.valor || 0), 0)
    const dda = soma('DDA')
    const folha = soma('Folha')
    const agendamento = soma('Agendamento')
    const transferencia = soma('Transferência')
    const entradas = soma('Transferência Recebida')
    const saldoInicial = 0 // o app ainda não guarda um saldo inicial por loja
    const totalDespesas = dda + folha + agendamento + transferencia
    const saldoFinal = saldoInicial - totalDespesas + entradas
    return { nome: loja.nome, dda, folha, agendamento, transferencia, totalDespesas, saldoFinal }
  })

  for (const r of resumo) {
    const linhaIdx = addLinha([`${r.nome}\nR$ 0,00`, r.dda, r.folha, r.agendamento, r.transferencia, r.totalDespesas, r.saldoFinal, ''])
    for (let c = 1; c <= 6; c++) marcarMoeda(linhaIdx, c)
  }

  const totalGeral = resumo.reduce(
    (acc, r) => ({
      dda: acc.dda + r.dda,
      folha: acc.folha + r.folha,
      agendamento: acc.agendamento + r.agendamento,
      transferencia: acc.transferencia + r.transferencia,
      totalDespesas: acc.totalDespesas + r.totalDespesas,
    }),
    { dda: 0, folha: 0, agendamento: 0, transferencia: 0, totalDespesas: 0 }
  )
  const linhaTotal = addLinha(['TOTAL GERAL', totalGeral.dda, totalGeral.folha, totalGeral.agendamento, totalGeral.transferencia, totalGeral.totalDespesas, '', ''])
  for (let c = 1; c <= 5; c++) marcarMoeda(linhaTotal, c)

  addLinha([])
  addLinha(['DETALHADO'])

  for (const loja of lojas) {
    if (loja.pagamentos.length === 0) continue

    const linhaSecao = addLinha([loja.nome])
    merges.push({ s: { r: linhaSecao, c: 0 }, e: { r: linhaSecao, c: 5 } })

    addLinha(['Tipo', 'Beneficiário', 'Descrição', 'Data Pg.', 'Valor', 'Situação'])

    for (const p of loja.pagamentos) {
      const tipoLabel =
        p.origem === 'DDA' ? 'DDA' :
        p.origem === 'Folha' ? 'FOLHA' :
        p.origem === 'Transferência Recebida' ? 'TRANSF. RECEBIDA' :
        p.origem
      const beneficiario = p.fornecedor || p.beneficiario || '—'
      const descricao = p.descricao
        ? (p.documento ? `${p.descricao} - Doc: ${p.documento}` : p.descricao)
        : (p.documento ? `Doc: ${p.documento}` : '—')
      const linhaIdx = addLinha([
        tipoLabel,
        beneficiario,
        descricao,
        formatarDataBr(p.data_vencimento),
        Number(p.valor || 0),
        p.status === 'agendado' ? 'Agendado' : 'Em Aberto',
      ])
      marcarMoeda(linhaIdx, 4)
    }
    addLinha([])
  }

  const ws = XLSX.utils.aoa_to_sheet(linhas)
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 28 }, { wch: 35 }, { wch: 45 }, { wch: 15 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }]

  for (const { r, c } of celulasMoeda) {
    const addr = XLSX.utils.encode_cell({ r, c })
    if (ws[addr]) ws[addr].z = FMT_MOEDA
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório Financeiro')

  const dataStr = new Date().toISOString().slice(0, 10)
  const nomeArquivo = `Relatorio_Pagamentos_BPO_${nomeGrupo.replace(/[^\w\- ]/g, '')}_${dataStr}.xlsx`
  XLSX.writeFile(wb, nomeArquivo)
}
