import { NextRequest, NextResponse } from 'next/server';
import { parseDDAFromOCR, parseFolhaFromOCR } from '@/lib/parsers/ocrParsers';
import { buscarCnpj } from '@/services/brasil-api/client';
import { extrairDDAComGemini, extrairFolhaComGemini, ItemDDA } from '@/lib/parsers/geminiExtractor';

export const runtime = 'nodejs';
export const maxDuration = 120; // Aumentado para comportar consultas de CNPJ na Brasil API

// ========================================================
// ENRIQUECER BENEFICIÁRIOS VIA CNPJ (Brasil API)
// O OCR (e às vezes a própria IA) erra os nomes mas acerta os CNPJs.
// Consultamos a Brasil API para cada CNPJ único e substituímos
// o beneficiário pelo nome real da empresa.
// Usado tanto pelo fluxo do Gemini quanto pelo fluxo antigo (OCR.space + regex).
// ========================================================
async function enriquecerBeneficiariosPorCnpj(dados: ItemDDA[]): Promise<ItemDDA[]> {
  const regexCnpjDoc = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/

  const cnpjsUnicos = new Set<string>()
  for (const item of dados) {
    const doc = item.documento || ''
    const matchDoc = doc.match(regexCnpjDoc)
    if (matchDoc) cnpjsUnicos.add(matchDoc[1])

    if (item.cpf_cnpj) {
      const matchCpfCnpj = item.cpf_cnpj.match(regexCnpjDoc)
      if (matchCpfCnpj) cnpjsUnicos.add(matchCpfCnpj[1])
    }
  }

  const cacheCnpj: Record<string, string> = {}

  if (cnpjsUnicos.size > 0) {
    console.log(`[DDA] Consultando ${cnpjsUnicos.size} CNPJ(s) na Brasil API...`)

    const consultas = Array.from(cnpjsUnicos).map(async (cnpj) => {
      try {
        // Timeout de 2.5 segundos para que a Brasil API não atrase o processo geral
        const resultado = await Promise.race([
          buscarCnpj(cnpj),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout Brasil API')), 2500))
        ])
        if (resultado) {
          const nome = resultado.razao_social && resultado.razao_social.trim()
            ? resultado.razao_social.trim()
            : resultado.nome_fantasia?.trim() || ''

          if (nome) {
            cacheCnpj[cnpj] = nome
            console.log(`[DDA] CNPJ ${cnpj} → ${nome}`)
          }
        }
      } catch (err) {
        console.warn(`[DDA] Falha ao consultar CNPJ ${cnpj}:`, err)
      }
    })

    await Promise.all(consultas)
  }

  for (const item of dados) {
    let cnpjEncontrado = ''

    const doc = item.documento || ''
    const matchDoc = doc.match(regexCnpjDoc)
    if (matchDoc) cnpjEncontrado = matchDoc[1]

    if (!cnpjEncontrado && item.cpf_cnpj) {
      const matchCpf = item.cpf_cnpj.match(regexCnpjDoc)
      if (matchCpf) cnpjEncontrado = matchCpf[1]
    }

    if (cnpjEncontrado && cacheCnpj[cnpjEncontrado]) {
      item.beneficiario = cacheCnpj[cnpjEncontrado]
    }
  }

  return dados
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const tipo = formData.get('tipo') as string; // 'dda' ou 'folha'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    // ========================================================
    // CAMINHO NOVO: extração via Gemini (IA), só entra em ação
    // se a variável GEMINI_API_KEY estiver configurada. Se der
    // qualquer erro, cai automaticamente no fluxo antigo abaixo
    // (OCR.space + regex) — nada quebra se o Gemini falhar.
    // ========================================================
    if (process.env.GEMINI_API_KEY) {
      try {
        if (tipo === 'dda') {
          const dados = await extrairDDAComGemini(file)
          const dadosEnriquecidos = await enriquecerBeneficiariosPorCnpj(dados)
          return NextResponse.json({ dados: dadosEnriquecidos, fonte: 'gemini' });
        } else {
          const resultado = await extrairFolhaComGemini(file)
          return NextResponse.json({
            dados: resultado.dados,
            tipoCalculo: resultado.tipoCalculo,
            fonte: 'gemini',
          });
        }
      } catch (geminiError) {
        console.warn('[Gemini] Falha ao extrair com IA, usando fallback OCR.space:', geminiError)
        // Segue para o fluxo antigo abaixo, sem interromper o usuário.
      }
    }

    // ========================================================
    // FLUXO ANTIGO: OCR.space + regex (padrão quando GEMINI_API_KEY
    // não está configurada, ou fallback se o Gemini falhar acima)
    // ========================================================
    let parsedText = ''
    
    // Verifica a extensão do arquivo
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    
    if (ext === 'pdf') {
       // Se for PDF, usar nosso extrator nativo perfeito em vez do OCR falho
       const { extrairTextoPDF } = await import('@/lib/parsers/pdfExtractor')
       parsedText = await extrairTextoPDF(file)
    } else {
       // Para imagens, mantemos o fluxo do OCR.space
       if (!process.env.OCR_SPACE_API_KEY) {
         return NextResponse.json({ error: 'Chave da API OCR.space não configurada.' }, { status: 500 });
       }
   
       const apiFormData = new FormData();
       apiFormData.append('apikey', process.env.OCR_SPACE_API_KEY || '');
       apiFormData.append('file', file);
       apiFormData.append('language', 'por');
       apiFormData.append('isTable', 'true');
       apiFormData.append('OCREngine', '2');
       apiFormData.append('scale', 'true');
   
       const response = await fetch('https://api.ocr.space/parse/image', {
         method: 'POST',
         headers: {
           'apikey': process.env.OCR_SPACE_API_KEY
         },
         body: apiFormData
       });
   
       if (!response.ok) {
         const errorText = await response.text();
         console.error('Erro na API OCR.space:', errorText);
         return NextResponse.json({ 
             error: 'Falha ao processar arquivo no OCR.space.', 
             detalhes: errorText 
         }, { status: response.status });
       }
   
       const jsonResult = await response.json();
       console.log('Resposta bruta OCR.space:', JSON.stringify(jsonResult));
   
       if (jsonResult.OCRExitCode !== 1 && jsonResult.OCRExitCode !== 2) {
         return NextResponse.json({ 
           error: jsonResult.ErrorMessage?.[0] || 'O OCR não conseguiu ler a imagem.' 
         }, { status: 500 });
       }
   
       parsedText = jsonResult.ParsedResults?.[0]?.ParsedText || '';
    }

    if (!parsedText.trim()) {
       return NextResponse.json({ error: 'Nenhum texto foi encontrado no arquivo.' }, { status: 400 });
    }

    try {
      if (tipo === 'dda') {
          const dados = parseDDAFromOCR(parsedText);

          // Mesma lógica de enriquecimento por CNPJ usada no caminho do Gemini
          const dadosEnriquecidos = await enriquecerBeneficiariosPorCnpj(dados);

          return NextResponse.json({ dados: dadosEnriquecidos, fonte: 'ocr-space' });
      } else {
          // 'folha'
          const resultado = parseFolhaFromOCR(parsedText);
          // Mandamos o tipo_calculo junto para o frontend calcular a competência
          return NextResponse.json({
              dados: resultado.dados,
              tipoCalculo: resultado.tipoCalculo,
              fonte: 'ocr-space'
          });
      }
    } catch (parseError) {
      console.error('Erro ao fazer parse do texto OCR:', parseError);
      return NextResponse.json({ error: 'Falha ao estruturar os dados extraídos.' }, { status: 500 });
    }

  } catch (error) {
    console.error('Erro interno na rota do conversor:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
