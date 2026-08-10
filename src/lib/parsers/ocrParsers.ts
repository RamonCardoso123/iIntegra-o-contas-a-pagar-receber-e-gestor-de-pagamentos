import { parseCurrency, parseDate } from '../utils'

export function parseDDAFromOCR(texto: string) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const resultados = []
  
  // Padrão comum em DDA: (Nome) (Doc) (Data) (Valor)
  // Como OCR.space com isTable=true tenta manter colunas na mesma linha,
  // ou pode quebrar CNPJ para linha de baixo.
  
  const regexValor = /(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/
  const regexData = /(\d{2}\/\d{2}\/\d{4})/
  const regexDoc = /(\d+)/
  const regexCNPJ = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/

  let beneficiarioAtual = ''
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    
    // Tenta encontrar um valor na linha
    const matchValor = linha.match(regexValor)
    const matchData = linha.match(regexData)
    
    if (matchValor && matchData) {
      // É uma linha de pagamento
      const valorStr = matchValor[1]
      const dataStr = matchData[1]
      
      const valor = parseCurrency(valorStr)
      const data_vencimento = parseDate(dataStr) || dataStr.split('/').reverse().join('-')
      
      // Remover valor e data da linha para sobrar beneficiário e doc
      let resto = linha.replace(matchValor[0], '').replace(matchData[0], '').trim()
      
      // Procurar documento (CNPJ)
      let cpfCnpj = ''
      const matchCnpj = linha.match(regexCNPJ)
      if (matchCnpj) {
          cpfCnpj = matchCnpj[1]
          resto = resto.replace(matchCnpj[0], '').trim()
      } else {
          // Procurar na linha seguinte se for um CNPJ isolado
          if (i + 1 < linhas.length) {
              const linhaSeguinte = linhas[i+1]
              const matchCnpjSeguinte = linhaSeguinte.match(regexCNPJ)
              if (matchCnpjSeguinte) {
                  cpfCnpj = matchCnpjSeguinte[1]
              }
          }
      }

      // Procurar NF ou numero de doc
      let documento = ''
      const matchNumDoc = resto.match(/\b(NF\s*\d+|\d{3,})\b/)
      if (matchNumDoc) {
          documento = matchNumDoc[1]
          resto = resto.replace(matchNumDoc[0], '').trim()
      }
      
      let beneficiarioLixo = resto.replace(/Pagar hoje|Pagar no vencimento/gi, '').trim()
      beneficiarioLixo = beneficiarioLixo.replace(/\b(\d{2}\/\d{2}\/\d{4})\b/g, '').trim() // limpa datas perdidas
      beneficiarioLixo = beneficiarioLixo.replace(/^(O|0|X)\s*/, '').trim()
      
      let beneficiarioFinal = beneficiarioAtual || beneficiarioLixo
      // Se houver um beneficiarioAtual que capturamos antes (ex: GOMMA PNEUS LTDA), damos prioridade.
      
      let docFinal = documento
      if (cpfCnpj) {
          docFinal = docFinal ? `${docFinal} - CNPJ: ${cpfCnpj}` : `CNPJ: ${cpfCnpj}`
      }
      
      if (valor > 0) {
          resultados.push({
              beneficiario: beneficiarioFinal || 'Não identificado',
              documento: docFinal || 'S/N',
              valor,
              data_vencimento
          })
      }
    } else {
        // Possível linha apenas com nome do beneficiário
        if (linha.length > 5 && !linha.includes('R$') && !linha.match(regexData)) {
            beneficiarioAtual = linha
        }
    }
  }
  
  return resultados
}

export function parseFolhaFromOCR(texto: string) {
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)
    const resultados = []
    
    let tipoCalculo = 'Folha Mensal' // Padrão
    
    // 1. Identificar o tipo (Folha ou Adiantamento)
    for (const linha of linhas) {
        if (linha.toLowerCase().includes('cálculo:')) {
            if (linha.toLowerCase().includes('adiantamento')) {
                tipoCalculo = 'Adiantamento'
            } else if (linha.toLowerCase().includes('folha')) {
                tipoCalculo = 'Folha Mensal'
            }
        }
    }
    
    // 2. Extrair os pagamentos
    // Padrão da linha de funcionário: (Código numérico) (Nome) (CPF opcional) (Valor)
    // Ex: 3 ERNANE DIAS VIANA GREGORIO 010.866.866-59 2.139,56
    // Ex: 55 ANDRE LUIS DOS SANTOS GOMES 788,84
    const regexFuncionario = /^(\d+)\s+(.+?)(?:\s+(\d{3}\.\d{3}\.\d{3}-\d{2}))?\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/
    const regexAlternativa = /^(\d+)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/

    for (const linha of linhas) {
        let fornecedor = ''
        let cpf = ''
        let valorStr = ''
        
        let match = linha.match(regexFuncionario)
        if (match) {
            fornecedor = match[2].trim()
            cpf = match[3] ? match[3].trim() : ''
            valorStr = match[4]
        } else {
            // Tentar alternativa (sem CPF)
            match = linha.match(regexAlternativa)
            if (match) {
                // Verificar se a parte do nome não termina num formato estranho
                fornecedor = match[2].trim()
                valorStr = match[3]
                
                // Se o nome tiver CPF grudado no final por erro de OCR, extrair
                const matchCpfInName = fornecedor.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})$/)
                if (matchCpfInName) {
                    cpf = matchCpfInName[1]
                    fornecedor = fornecedor.replace(matchCpfInName[1], '').trim()
                }
            }
        }
        
        if (fornecedor && valorStr) {
            const valor = parseCurrency(valorStr)
            if (valor > 0) {
                resultados.push({
                    fornecedor,
                    cpf_cnpj: cpf || '',
                    valor,
                    tipo: tipoCalculo,
                    descricao: tipoCalculo,
                    data_vencimento: '' // Será preenchido no frontend via Modal
                })
            }
        }
    }
    
    // Retornamos os resultados e o tipo para o frontend usar
    return {
        tipoCalculo,
        dados: resultados
    }
}
