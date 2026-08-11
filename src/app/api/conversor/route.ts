import { NextRequest, NextResponse } from 'next/server';
import { parseDDAFromOCR, parseFolhaFromOCR } from '@/lib/parsers/ocrParsers';
import { buscarCnpj } from '@/services/brasil-api/client';

export const runtime = 'nodejs';
export const maxDuration = 120; // Aumentado para comportar consultas de CNPJ na Brasil API

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const tipo = formData.get('tipo') as string; // 'dda' ou 'folha'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (!process.env.OCR_SPACE_API_KEY) {
      return NextResponse.json({ error: 'Chave da API OCR.space não configurada.' }, { status: 500 });
    }

    const apiFormData = new FormData();
    apiFormData.append('apikey', process.env.OCR_SPACE_API_KEY || '');
    apiFormData.append('file', file);
    apiFormData.append('language', 'por');
    apiFormData.append('isTable', 'true');
    apiFormData.append('OCREngine', '2'); // Melhor reconhecimento
    apiFormData.append('scale', 'true'); // Upscale interno melhora precisão

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

    const parsedText = jsonResult.ParsedResults?.[0]?.ParsedText || '';

    if (!parsedText.trim()) {
       return NextResponse.json({ error: 'Nenhum texto foi encontrado na imagem.' }, { status: 400 });
    }

    try {
      if (tipo === 'dda') {
          const dados = parseDDAFromOCR(parsedText);
          
          // ========================================================
          // ENRIQUECER BENEFICIÁRIOS VIA CNPJ (Brasil API)
          // O OCR erra os nomes mas acerta os CNPJs.
          // Consultamos a Brasil API para cada CNPJ único e 
          // substituímos o beneficiário pelo nome real da empresa.
          // ========================================================
          
          // 1. Coletar todos os CNPJs únicos (do campo documento e cpf_cnpj)
          const regexCnpjDoc = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/
          const cnpjsUnicos = new Set<string>()
          
          for (const item of dados) {
            // Tenta extrair CNPJ do campo documento
            const doc = item.documento || ''
            const matchDoc = doc.match(regexCnpjDoc)
            if (matchDoc) {
              cnpjsUnicos.add(matchDoc[1])
            }
            // Também verifica o campo cpf_cnpj separado
            if (item.cpf_cnpj) {
              const matchCpfCnpj = item.cpf_cnpj.match(regexCnpjDoc)
              if (matchCpfCnpj) {
                cnpjsUnicos.add(matchCpfCnpj[1])
              }
            }
          }
          
          // 2. Consultar Brasil API para cada CNPJ (em paralelo, com limite)
          const cacheCnpj: Record<string, string> = {}
          
          if (cnpjsUnicos.size > 0) {
            console.log(`[DDA] Consultando ${cnpjsUnicos.size} CNPJ(s) na Brasil API...`)
            
            const consultas = Array.from(cnpjsUnicos).map(async (cnpj) => {
              try {
                const resultado = await buscarCnpj(cnpj)
                if (resultado) {
                  // Prioriza razão social (que é o que vem no boleto/DDA), se não tiver usa nome fantasia
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
          
          // 3. Substituir o nome do beneficiário pelo nome real
          for (const item of dados) {
            let cnpjEncontrado = ''
            
            // Tenta do campo documento
            const doc = item.documento || ''
            const matchDoc = doc.match(regexCnpjDoc)
            if (matchDoc) cnpjEncontrado = matchDoc[1]
            
            // Tenta do campo cpf_cnpj
            if (!cnpjEncontrado && item.cpf_cnpj) {
              const matchCpf = item.cpf_cnpj.match(regexCnpjDoc)
              if (matchCpf) cnpjEncontrado = matchCpf[1]
            }
            
            if (cnpjEncontrado && cacheCnpj[cnpjEncontrado]) {
              item.beneficiario = cacheCnpj[cnpjEncontrado]
            }
          }
          
          return NextResponse.json({ dados });
      } else {
          // 'folha'
          const resultado = parseFolhaFromOCR(parsedText);
          // Mandamos o tipo_calculo junto para o frontend calcular a competência
          return NextResponse.json({ 
              dados: resultado.dados,
              tipoCalculo: resultado.tipoCalculo
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
