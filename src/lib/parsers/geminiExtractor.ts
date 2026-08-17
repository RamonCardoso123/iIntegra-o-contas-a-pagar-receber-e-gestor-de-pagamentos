import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ItemDDA {
  beneficiario: string
  documento: string
  cpf_cnpj: string
  valor: number
  data_vencimento: string
}

export interface ItemFolha {
  fornecedor: string
  cpf_cnpj: string
  valor: number
  tipo: string
  descricao: string
  data_vencimento: string
}

export interface ItemAvulso {
  fornecedor: string
  descricao: string
  documento: string
  data_vencimento: string
  data_documento: string
  valor: number
  categoria: string
  tipo: string
  chave_pix: string
  codigo_barras: string
}

// Pode ser trocado via variável de ambiente sem precisar mexer no código.
// gemini-3.5-flash-lite: versão rápida e gratuita, ideal pra extração de
// dados estruturados (não precisa do "raciocínio profundo" dos modelos
// maiores, então responde bem mais rápido). Se um dia parar de existir,
// troque aqui ou defina GEMINI_MODEL na Vercel sem precisar mexer no código.
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'

async function fileParaBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())
  return {
    base64: buffer.toString('base64'),
    mimeType: file.type || 'application/octet-stream',
  }
}

/**
 * Extrai o primeiro bloco JSON (array ou objeto) de um texto,
 * removendo cercas de código markdown (```json ... ```) que o
 * Gemini às vezes adiciona mesmo quando instruído a não fazer isso.
 */
function extrairJSON(texto: string): any {
  const limpo = texto.replace(/```json/gi, '').replace(/```/g, '').trim()

  const idxColchete = limpo.indexOf('[')
  const idxChave = limpo.indexOf('{')

  let inicio: number
  if (idxColchete === -1) {
    inicio = idxChave
  } else if (idxChave === -1) {
    inicio = idxColchete
  } else {
    inicio = Math.min(idxColchete, idxChave)
  }

  const fim = Math.max(limpo.lastIndexOf(']'), limpo.lastIndexOf('}'))

  if (inicio === -1 || fim === -1 || fim < inicio) {
    throw new Error('Resposta da IA não contém JSON reconhecível: ' + limpo.slice(0, 200))
  }

  const jsonStr = limpo.slice(inicio, fim + 1)
  return JSON.parse(jsonStr)
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada.')
  }
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: MODEL_NAME })
}

/**
 * Envia o boleto/print de DDA (imagem ou PDF) direto pro Gemini e devolve
 * a lista de pagamentos já estruturada, no mesmo formato que o parser
 * regex antigo (parseDDAFromOCR) produzia.
 */
export async function extrairDDAComGemini(file: File): Promise<ItemDDA[]> {
  const { base64, mimeType } = await fileParaBase64(file)
  const model = getModel()

  const prompt = `Você é um especialista em ler boletos e telas de "Inclusão de pagamento"/DDA de bancos brasileiros (Itaú e outros).
Analise o documento anexado (pode ser uma foto, print de tela ou PDF) e extraia TODOS os pagamentos/boletos listados nele.

Para cada pagamento, devolva um objeto com exatamente estes campos:
- "beneficiario": nome do beneficiário/fornecedor (razão social, se disponível)
- "documento": número do documento/nota fiscal (ex: "NF 3224" ou o número do boleto). Se não houver, use "S/N"
- "cpf_cnpj": CNPJ ou CPF formatado (ex: "29.563.201/0001-89"). Deixe "" se não encontrar
- "valor": valor numérico, usando PONTO como separador decimal, sem "R$" e sem separador de milhar (ex: 1384.48)
- "data_vencimento": data de vencimento no formato "AAAA-MM-DD"

Responda APENAS com um array JSON válido, sem nenhum texto antes ou depois, sem markdown. Exemplo do formato exato:
[{"beneficiario":"GOMMA PNEUS LTDA","documento":"5961443","cpf_cnpj":"29.563.201/0001-89","valor":1384.48,"data_vencimento":"2026-07-30"}]

Se não conseguir identificar nenhum pagamento no documento, responda: []`

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: base64 } },
  ])

  const texto = result.response.text()
  const dados = extrairJSON(texto)

  if (!Array.isArray(dados)) {
    throw new Error('IA não devolveu uma lista de pagamentos (DDA).')
  }

  return dados
    .map((item: any) => ({
      beneficiario: String(item.beneficiario || 'Não identificado').trim(),
      documento: String(item.documento || 'S/N').trim(),
      cpf_cnpj: String(item.cpf_cnpj || '').trim(),
      valor: Number(item.valor) || 0,
      data_vencimento: String(item.data_vencimento || '').trim(),
    }))
    .filter((item: ItemDDA) => item.valor > 0)
}

/**
 * Envia o relatório de folha de pagamento / relação de líquidos
 * (imagem ou PDF) direto pro Gemini e devolve a lista de empregados
 * já estruturada, no mesmo formato que o parser regex antigo
 * (parseFolhaFromOCR) produzia.
 */
export async function extrairFolhaComGemini(
  file: File
): Promise<{ tipoCalculo: string; dados: ItemFolha[] }> {
  const { base64, mimeType } = await fileParaBase64(file)
  const model = getModel()

  const prompt = `Você é um especialista em ler relatórios de folha de pagamento / relação de líquidos de empresas brasileiras.
Analise o documento anexado (pode ser uma foto, print de tela ou PDF) e extraia TODOS os empregados/pagamentos listados nele.

Primeiro identifique o tipo de cálculo do documento: se mencionar "Adiantamento", use "Adiantamento". Caso contrário, use "Folha Mensal".

Para cada empregado, devolva um objeto com exatamente estes campos:
- "fornecedor": nome completo do empregado
- "cpf_cnpj": CPF formatado (ex: "010.866.866-59"). Deixe "" se não encontrar
- "valor": valor líquido numérico, usando PONTO como separador decimal, sem "R$" e sem separador de milhar
- "tipo": o tipo de cálculo identificado ("Folha Mensal" ou "Adiantamento")
- "descricao": igual ao campo "tipo"

Ignore linhas de total, cabeçalho ou rodapé (como "Total", "Estagiários", "Contribuintes", "Líquidos", "Empresa:").

Responda APENAS com um array JSON válido, sem texto antes ou depois, sem markdown. Exemplo:
[{"fornecedor":"ANDRE LUIS DOS SANTOS GOMES","cpf_cnpj":"010.866.866-59","valor":788.84,"tipo":"Folha Mensal","descricao":"Folha Mensal"}]

Se não conseguir identificar nenhum empregado, responda: []`

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: base64 } },
  ])

  const texto = result.response.text()
  const dados = extrairJSON(texto)

  if (!Array.isArray(dados)) {
    throw new Error('IA não devolveu uma lista de empregados (Folha).')
  }

  let tipoCalculo = 'Folha Mensal'
  if (dados.length > 0 && dados[0].tipo) {
    tipoCalculo = String(dados[0].tipo)
  }

  const itens: ItemFolha[] = dados
    .map((item: any) => ({
      fornecedor: String(item.fornecedor || '').trim(),
      cpf_cnpj: String(item.cpf_cnpj || '').trim(),
      valor: Number(item.valor) || 0,
      tipo: String(item.tipo || tipoCalculo).trim(),
      descricao: String(item.descricao || item.tipo || tipoCalculo).trim(),
      data_vencimento: '',
    }))
    .filter((item: ItemFolha) => item.fornecedor && item.valor > 0)

  return { tipoCalculo, dados: itens }
}

function normalizarItemAvulso(item: any): ItemAvulso {
  return {
    fornecedor: String(item?.fornecedor || '').trim(),
    descricao: String(item?.descricao || '').trim(),
    documento: String(item?.documento || '').trim(),
    data_vencimento: String(item?.data_vencimento || '').trim(),
    data_documento: String(item?.data_documento || '').trim(),
    valor: Number(item?.valor) || 0,
    categoria: String(item?.categoria || '').trim(),
    tipo: String(item?.tipo || 'Outros').trim(),
    chave_pix: String(item?.chave_pix || '').trim(),
    codigo_barras: String(item?.codigo_barras || '').replace(/[^0-9]/g, '').trim(),
  }
}

/**
 * Envia um documento avulso (boleto, guia de imposto/taxa, comprovante,
 * nota fiscal etc — imagem ou PDF) direto pro Gemini e devolve UM único
 * pagamento estruturado, pra preencher automaticamente o formulário de
 * "Novo Agendamento" (fornecedor, descrição, vencimento, valor, categoria,
 * tipo e chave PIX quando aplicável).
 */
export async function extrairDocumentoAvulso(file: File): Promise<ItemAvulso> {
  const { base64, mimeType } = await fileParaBase64(file)
  const model = getModel()

  const prompt = `Você é um especialista em ler documentos financeiros brasileiros: boletos, guias de imposto (DAS, DARF, GPS, FGTS, ICMS, ISS etc.), taxas, notas fiscais e comprovantes de pagamento.
Analise o documento anexado (imagem ou PDF) e extraia os dados do pagamento principal desse documento.

Devolva um objeto JSON com exatamente estes campos:
- "fornecedor": nome do beneficiário/fornecedor a quem o pagamento se destina (razão social, se disponível; para guias de imposto, use o nome do tributo/órgão, ex: "DAS - Simples Nacional")
- "descricao": uma descrição curta do que é esse pagamento (ex: "Guia DAS competência 07/2026")
- "documento": o número do documento/boleto/nota fiscal impresso nele (ex: "1043475533"). Deixe "" se não encontrar
- "data_vencimento": data de vencimento no formato "AAAA-MM-DD"
- "data_documento": a "data do documento" ou "data de emissão" impressa nele (diferente da data de vencimento), no formato "AAAA-MM-DD". Deixe "" se não encontrar
- "valor": valor numérico total a pagar, usando PONTO como separador decimal, sem "R$" e sem separador de milhar (ex: 1384.48)
- "categoria": uma sugestão curta de categoria. Use uma das categorias fixas das regras especiais abaixo quando o documento se encaixar nelas. Para os demais casos, escolha a que fizer mais sentido entre: "Impostos", "Fornecedores", "Salários", "Taxas", "Aluguel", "Outros"
- "tipo": o meio de pagamento identificado — use exatamente um destes valores: "PIX", "Boleto", "TED", "Folha", "Imposto", "Outros"
- "chave_pix": se o documento tiver uma chave PIX visível (copia e cola, e-mail, telefone, CPF/CNPJ ou chave aleatória), coloque aqui. Caso contrário, deixe ""
- "codigo_barras": o código de barras ou a linha digitável do boleto ou guia de imposto, caso exista no documento (apenas os números, sem espaços, pontos ou barras, ex: "34191790010104351004791020150008793240000217000"). Se não for um boleto/tributo com código de barras ou se não encontrar, deixe ""

REGRA ESPECIAL — Guia de ISS Retido (DRAM / "ISSQN Retido" / "Documento de Recolhimento e Arrecadação Municipal"):
Se o documento for esse tipo de guia municipal, siga exatamente:
- "fornecedor": use o nome da PREFEITURA que emitiu a guia (aparece no cabeçalho/brasão do documento, ex: "Prefeitura de Belo Horizonte"). NÃO use o nome do contribuinte/empresa que está pagando (esse é o próprio cliente, não o fornecedor).
- "categoria": sempre exatamente "Retenção - ISS Serviços Tomados"
- "documento": o "Número da Guia"
- "data_vencimento": o campo "Vencimento" (geralmente destacado em amarelo)
- "data_documento": o primeiro dia do mês/ano do campo "COMPETÊNCIA" (também destacado), no formato "AAAA-MM-01" (ex: competência 07/2026 vira "2026-07-01")
- "valor": o campo "Valor a Pagar" ou "TOTAL"
- "descricao": "ISS Retido - competência MM/AAAA" (usando a competência identificada)
- "tipo": "Imposto"

REGRA ESPECIAL — Documento de Arrecadação de Receitas Federais / DARF, quando alguma linha da "Composição do Documento" tiver "CONTR PREV" na denominação (ex: "CONTR PREV DESCONTA SEGURADO-EMPREGADO/AVULSO", "CONTRIB PREVIDENCIÁRIA EMPRESA/EMPREGADOR") — é uma guia de INSS/GPS:
- "fornecedor": "Receita Federal"
- "categoria": sempre exatamente "INSS sobre Salários - GPS"
- "documento": o "Número do Documento"
- "data_vencimento": o campo "Data de Vencimento" / "Pagar este documento até"
- "data_documento": o primeiro dia do mês/ano do "Período de Apuração" (ex: Junho/2026 vira "2026-06-01")
- "valor": o "Valor Total do Documento"
- "descricao": "INSS/GPS - competência MM/AAAA"
- "tipo": "Imposto"

REGRA ESPECIAL — "Documento de Arrecadação do Simples Nacional" (DAS):
- "fornecedor": "Receita Federal"
- "categoria": sempre exatamente "Simples Nacional - DAS"
- "documento": o "Número do Documento"
- "data_vencimento": o campo "Data de Vencimento" / "Pagar este documento até"
- "data_documento": o primeiro dia do mês/ano do "Período de Apuração" (ex: Junho/2026 vira "2026-06-01")
- "valor": o "Valor Total do Documento"
- "descricao": "DAS - Simples Nacional - competência MM/AAAA"
- "tipo": "Imposto"

REGRA ESPECIAL — "GFD - Guia do FGTS Digital" (FGTS):
- "fornecedor": "Caixa Econômica Federal"
- "categoria": sempre exatamente "FGTS e Multa de FGTS"
- "documento": o "Identificador"
- "data_vencimento": o campo "Pagar este documento até"
- "data_documento": o primeiro dia do mês/ano do campo "Competência" (ex: 06/2026 vira "2026-06-01")
- "valor": o "Valor a recolher" / "Total da Guia"
- "descricao": "FGTS - competência MM/AAAA"
- "tipo": "Imposto"

Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem markdown. Exemplos do formato exato:
{"fornecedor":"GOMMA PNEUS LTDA","descricao":"Boleto NF 3224","documento":"3224","data_vencimento":"2026-07-30","data_documento":"2026-07-10","valor":1384.48,"categoria":"Fornecedores","tipo":"Boleto","chave_pix":"","codigo_barras":"34191790010104351004791020150008793240000217000"}
{"fornecedor":"Prefeitura de Belo Horizonte","descricao":"ISS Retido - competência 07/2026","documento":"0226231121098","data_vencimento":"2026-08-10","data_documento":"2026-07-01","valor":16.21,"categoria":"Retenção - ISS Serviços Tomados","tipo":"Imposto","chave_pix":"","codigo_barras":""}
{"fornecedor":"Receita Federal","descricao":"INSS/GPS - competência 06/2026","documento":"07.16.26190.4201400-0","data_vencimento":"2026-07-20","data_documento":"2026-06-01","valor":990.89,"categoria":"INSS sobre Salários - GPS","tipo":"Imposto","chave_pix":"","codigo_barras":""}
{"fornecedor":"Receita Federal","descricao":"DAS - Simples Nacional - competência 06/2026","documento":"07.20.26182.8446529-0","data_vencimento":"2026-07-20","data_documento":"2026-06-01","valor":9332.70,"categoria":"Simples Nacional - DAS","tipo":"Imposto","chave_pix":"","codigo_barras":""}
{"fornecedor":"Caixa Econômica Federal","descricao":"FGTS - competência 06/2026","documento":"0126070848549167-0","data_vencimento":"2026-07-20","data_documento":"2026-06-01","valor":220.70,"categoria":"FGTS e Multa de FGTS","tipo":"Imposto","chave_pix":"","codigo_barras":""}

Se não conseguir identificar algum campo com confiança, preencha os que conseguir e deixe os demais em branco ("" ou 0) — não invente dados.`

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: base64 } },
  ])

  const texto = result.response.text()
  const dados = extrairJSON(texto)

  // A IA pode devolver o objeto direto ou, ocasionalmente, dentro de um array de 1 item
  const item = Array.isArray(dados) ? dados[0] : dados

  return normalizarItemAvulso(item)
}
