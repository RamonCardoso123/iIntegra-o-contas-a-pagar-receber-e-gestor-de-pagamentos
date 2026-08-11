import { parseCurrency, parseDate } from '../utils'

export function parseDDAFromOCR(texto: string) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const resultados: any[] = []
  
  // Padrão comum em DDA: (Nome) (Doc) (Data) (Valor)
  // Como OCR.space com isTable=true tenta manter colunas na mesma linha,
  // ou pode quebrar CNPJ para linha de baixo.
  
  const regexValor = /(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/
  const regexData = /(\d{2}\/\d{2}\/\d{4})/
  const regexDoc = /(\d+)/
  // CNPJ formatado: 99.999.999/9999-99
  const regexCNPJ = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/
  // CNPJ sem formatação: 14 dígitos seguidos (ex: 52011070000111)
  const regexCNPJSemFormato = /\b(\d{14})\b/

  let beneficiarioAtual = ''
  let cnpjAtual = ''
  
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
      
      // Procurar documento (CNPJ formatado ou sem formato)
      let cpfCnpj = ''
      const matchCnpj = linha.match(regexCNPJ)
      const matchCnpjSF = linha.match(regexCNPJSemFormato)
      
      if (matchCnpj) {
          cpfCnpj = matchCnpj[1]
          resto = resto.replace(matchCnpj[0], '').trim()
      } else if (matchCnpjSF) {
          // Formatar o CNPJ sem formato para o padrão XX.XXX.XXX/XXXX-XX
          const d = matchCnpjSF[1]
          cpfCnpj = `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`
          resto = resto.replace(matchCnpjSF[0], '').trim()
      } else if (cnpjAtual) {
          // Usa o CNPJ capturado na linha anterior
          cpfCnpj = cnpjAtual
      } else {
          // Procurar na linha seguinte se for um CNPJ isolado
          if (i + 1 < linhas.length) {
              const linhaSeguinte = linhas[i+1]
              const matchCnpjSeguinte = linhaSeguinte.match(regexCNPJ)
              const matchCnpjSFSeguinte = linhaSeguinte.match(regexCNPJSemFormato)
              if (matchCnpjSeguinte) {
                  cpfCnpj = matchCnpjSeguinte[1]
              } else if (matchCnpjSFSeguinte) {
                  const d = matchCnpjSFSeguinte[1]
                  cpfCnpj = `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`
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
      
      // Se houver um beneficiarioAtual que capturamos antes, damos prioridade.
      let beneficiarioFinal = beneficiarioAtual || beneficiarioLixo
      
      let docFinal = documento
      if (cpfCnpj) {
          docFinal = docFinal ? `${docFinal} - CNPJ: ${cpfCnpj}` : `CNPJ: ${cpfCnpj}`
      }
      
      if (valor > 0) {
          resultados.push({
              beneficiario: beneficiarioFinal || 'Não identificado',
              documento: docFinal || 'S/N',
              cpf_cnpj: cpfCnpj || '',
              valor,
              data_vencimento
          })
          
          // Limpar estados atuais para não vazar para o próximo lançamento!
          beneficiarioAtual = ''
          cnpjAtual = ''
      }
    } else {
        // Possível linha com nome do beneficiário (e talvez CNPJ)
        if (linha.length > 5 && !linha.includes('R$') && !linha.match(regexData)) {
            let linhaLimpa = linha
            
            // Verifica se tem CNPJ nessa linha "solta"
            const matchCnpj = linha.match(regexCNPJ)
            const matchCnpjSF = linha.match(regexCNPJSemFormato)
            
            if (matchCnpj) {
                cnpjAtual = matchCnpj[1]
                linhaLimpa = linhaLimpa.replace(matchCnpj[0], '').trim()
            } else if (matchCnpjSF) {
                const d = matchCnpjSF[1]
                cnpjAtual = `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`
                linhaLimpa = linhaLimpa.replace(matchCnpjSF[0], '').trim()
            }
            
            // O que sobrar é o nome do beneficiário
            linhaLimpa = linhaLimpa.replace(/^(O|0|X)\s*/, '').trim()
            if (linhaLimpa.length > 2) {
                beneficiarioAtual = linhaLimpa
            }
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
    // Vamos procurar por qualquer linha que termine com um valor monetário.
    // Ex: 3 ERNANE DIAS VIANA GREGORIO 010.866.866-59 2.139,56
    // Ex: ANDRE LUIS DOS SANTOS GOMES 788,84
    const regexLinhaDinheiro = /(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/

    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i]
        let fornecedor = ''
        let cpf = ''
        let valorStr = ''
        
        const matchValor = linha.match(regexLinhaDinheiro)
        if (matchValor) {
            valorStr = matchValor[1]
            
            // Remove o valor da linha para sobrar o nome e possível CPF
            let resto = linha.replace(matchValor[0], '').trim()
            
            // Ignorar linhas que claramente são rodapés ou totais
            const linhaLower = resto.toLowerCase()
            if (linhaLower.includes('total') || 
                linhaLower.includes('estagiários') || 
                linhaLower.includes('contribuintes') || 
                linhaLower.includes('líquidos') ||
                linhaLower.includes('bruto') ||
                linhaLower.includes('líquido') ||
                linhaLower.includes('empresa:')) {
                continue // Pula para a próxima linha
            }
            
            // Tenta achar CPF
            const matchCpf = resto.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/)
            if (matchCpf) {
                cpf = matchCpf[1]
                resto = resto.replace(matchCpf[0], '').trim()
            }
            
            // Tira numeros perdidos no começo (como matrícula) e lixo comum como "Empregados"
            resto = resto.replace(/^(Empregados|Empregado|Empre)\s*/i, '').trim()
            resto = resto.replace(/^\d+\s+/, '').trim()
            
            fornecedor = resto
            
            // Se o nome sumiu (ex: estava na linha anterior e essa linha só tinha CPF e valor)
            if (!fornecedor && i > 0) {
                let linhaAnterior = linhas[i-1].trim()
                linhaAnterior = linhaAnterior.replace(/^(Empregados|Empregado|Empre)\s*/i, '').trim()
                linhaAnterior = linhaAnterior.replace(/^\d+\s+/, '').trim()
                // Evita pegar cabeçalhos
                if (!linhaAnterior.toLowerCase().includes('cpf') && !linhaAnterior.toLowerCase().includes('código')) {
                    fornecedor = linhaAnterior
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
