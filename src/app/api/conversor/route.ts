import { NextRequest, NextResponse } from 'next/server';
import { parseDDAFromOCR, parseFolhaFromOCR } from '@/lib/parsers/ocrParsers';

export const runtime = 'nodejs';
export const maxDuration = 60; // Operações de IA podem demorar

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
    apiFormData.append('file', file);
    apiFormData.append('apikey', process.env.OCR_SPACE_API_KEY);
    apiFormData.append('language', 'por');
    apiFormData.append('isTable', 'true');
    apiFormData.append('OCREngine', '2'); // Melhor reconhecimento
    apiFormData.append('scale', 'true'); // Upscale interno melhora precisão

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: apiFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API OCR.space:', errorText);
      return NextResponse.json({ error: 'Falha ao processar arquivo no OCR.space.' }, { status: response.status });
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
