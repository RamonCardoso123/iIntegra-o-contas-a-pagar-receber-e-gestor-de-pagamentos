/**
 * Exportador: gera o "Relatório Financeiro – Pagamentos BPO" (Excel Geral)
 * de um Grupo, no mesmo modelo visual usado no app antigo: cabeçalho azul
 * marinho em negrito, linhas zebradas, linha TOTAL GERAL destacada e seção
 * DETALHADO com um bloco por loja (sem a marcação amarela — essa é só a
 * anotação manual que o usuário faz na conciliação bancária).
 */
import ExcelJS from 'exceljs'

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
  /** Saldo em caixa real da loja, informado manualmente no card */
  saldoInicial?: number
}

const FMT_MOEDA = '"R$"#,##0.00'

const COR_NAVY = 'FF1F4E78'
const COR_BRANCO = 'FFFFFFFF'
const COR_ZEBRA = 'FFF2F2F2'
const COR_TOTAL = 'FFE7E6E6'
const COR_SECAO = 'FFD9E1F2'
const COR_VERDE = 'FF006100'
const COR_VERMELHO = 'FF9C0006'
const COR_CINZA_TEXTO = 'FF555555'

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

function fillSolido(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

export async function construirWorkbookRelatorioGeral(nomeGrupo: string, lojas: LojaRelatorio[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Dinheiro em Caixa BPO'
  wb.created = new Date()

  const ws = wb.addWorksheet('Relatório Financeiro', {
    views: [{ showGridLines: false }],
  })

  ws.columns = [
    { width: 26 }, { width: 35 }, { width: 45 }, { width: 15 },
    { width: 17 }, { width: 17 }, { width: 17 }, { width: 15 },
  ]

  // Título
  ws.mergeCells('A1:H1')
  const tituloCell = ws.getCell('A1')
  tituloCell.value = `Relatório Financeiro – Pagamentos BPO (Grupo: ${nomeGrupo})`
  tituloCell.font = { bold: true, size: 14 }
  ws.getRow(1).height = 22

  // Gerado em
  ws.mergeCells('A2:H2')
  const geradoCell = ws.getCell('A2')
  geradoCell.value = `Gerado em: ${formatarDataHoraAgora()}`
  geradoCell.font = { color: { argb: COR_CINZA_TEXTO }, size: 10 }

  ws.addRow([])

  // Cabeçalho da tabela-resumo
  const headerRow = ws.addRow(['Loja / Saldo Inicial', 'DDA', 'Folha', 'Agendamento', 'Transferência', 'Total Despesas', 'Saldo Final', 'Status'])
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: COR_BRANCO } }
    cell.fill = fillSolido(COR_NAVY)
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  headerRow.height = 20

  const resumo = lojas.map(loja => {
    const soma = (origem: PagamentoRelatorio['origem']) =>
      loja.pagamentos.filter(p => p.origem === origem).reduce((acc, p) => acc + Number(p.valor || 0), 0)
    const dda = soma('DDA')
    const folha = soma('Folha')
    const agendamento = soma('Agendamento')
    const transferencia = soma('Transferência')
    const entradas = soma('Transferência Recebida')
    const saldoInicial = Number(loja.saldoInicial || 0)
    const totalDespesas = dda + folha + agendamento + transferencia
    const saldoFinal = saldoInicial - totalDespesas + entradas
    return { nome: loja.nome, dda, folha, agendamento, transferencia, totalDespesas, saldoFinal, saldoInicial }
  })

  resumo.forEach((r, i) => {
    const saldoInicialFmt = r.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const row = ws.addRow([`${r.nome}\nR$ ${saldoInicialFmt}`, r.dda, r.folha, r.agendamento, r.transferencia, r.totalDespesas, r.saldoFinal, ''])
    row.height = 30
    const zebra = i % 2 === 1
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (zebra) cell.fill = fillSolido(COR_ZEBRA)
      if (colNumber === 1) {
        cell.alignment = { wrapText: true, vertical: 'middle' }
      }
      if (colNumber >= 2 && colNumber <= 7) {
        cell.numFmt = FMT_MOEDA
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      }
      if (colNumber === 7) {
        cell.font = { color: { argb: r.saldoFinal < 0 ? COR_VERMELHO : COR_VERDE } }
      }
    })
  })

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
  const totalRow = ws.addRow(['TOTAL GERAL', totalGeral.dda, totalGeral.folha, totalGeral.agendamento, totalGeral.transferencia, totalGeral.totalDespesas, '', ''])
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.fill = fillSolido(COR_TOTAL)
    cell.font = { bold: true }
    if (colNumber >= 2 && colNumber <= 6) {
      cell.numFmt = FMT_MOEDA
      cell.alignment = { horizontal: 'right' }
    }
  })

  ws.addRow([])
  const detalhadoRow = ws.addRow(['DETALHADO'])
  detalhadoRow.getCell(1).font = { bold: true, size: 12 }

  for (const loja of lojas) {
    if (loja.pagamentos.length === 0) continue

    ws.addRow([])

    const secaoRowNum = ws.rowCount + 1
    const secaoRow = ws.addRow([loja.nome])
    ws.mergeCells(`A${secaoRowNum}:F${secaoRowNum}`)
    secaoRow.eachCell({ includeEmpty: true }, cell => {
      cell.fill = fillSolido(COR_SECAO)
      cell.font = { bold: true }
    })
    // preenche o resto das colunas mescladas com o mesmo fundo
    for (let c = 2; c <= 6; c++) {
      secaoRow.getCell(c).fill = fillSolido(COR_SECAO)
    }

    const colHeaderRow = ws.addRow(['Tipo', 'Beneficiário', 'Descrição', 'Data Pg.', 'Valor', 'Situação'])
    colHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: COR_BRANCO } }
      cell.fill = fillSolido(COR_NAVY)
    })

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
      const dataRow = ws.addRow([
        tipoLabel,
        beneficiario,
        descricao,
        formatarDataBr(p.data_vencimento),
        Number(p.valor || 0),
        p.status === 'agendado' ? 'Agendado' : 'Em Aberto',
      ])
      dataRow.getCell(5).numFmt = FMT_MOEDA
      dataRow.getCell(5).alignment = { horizontal: 'right' }
    }
  }

  return wb
}

export async function exportarRelatorioGeralXlsx(nomeGrupo: string, lojas: LojaRelatorio[]) {
  const wb = await construirWorkbookRelatorioGeral(nomeGrupo, lojas)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const dataStr = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `Relatorio_Pagamentos_BPO_${nomeGrupo.replace(/[^\w\- ]/g, '')}_${dataStr}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
