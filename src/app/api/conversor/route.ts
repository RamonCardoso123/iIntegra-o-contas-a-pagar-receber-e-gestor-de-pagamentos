import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60; // Operações de IA podem demorar

const DEFAULT_MODEL = 'gemini-1.5-flash';

const fileToBase64 = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const tipo = formData.get('tipo') as string; // 'dda' ou 'folha'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Chave da API Gemini não configurada. Adicione GEMINI_API_KEY no arquivo .env.' 
      }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const base64 = await fileToBase64(file);

    let prompt = '';

    if (tipo === 'dda') {
      prompt = `Analise a imagem deste DDA (Débito Direto Autorizado) ou boleto e extraia os dados.
Retorne APENAS um JSON estrito no seguinte formato (uma lista de objetos):
[
  {
    "beneficiario": "Nome da empresa/recebedor",
    "documento": "CNPJ, CPF ou código do boleto (string)",
    "valor": 1234.56,
    "data_vencimento": "YYYY-MM-DD"
  }
]
Retorne APENAS o JSON array, sem nenhuma formatação Markdown (sem \`\`\`json).`;
    } else {
      prompt = `Analise este arquivo de Folha de Pagamento ou Recibo e extraia os pagamentos.
Retorne APENAS um JSON estrito no seguinte formato (uma lista de objetos):
[
  {
    "fornecedor": "Nome do funcionário ou recebedor",
    "tipo": "Folha",
    "valor": 1234.56,
    "data_vencimento": "YYYY-MM-DD",
    "descricao": "Referência do pagamento",
    "cpf_cnpj": "Se houver CPF ou CNPJ"
  }
]
Retorne APENAS o JSON array, sem nenhuma formatação Markdown (sem \`\`\`json).`;
    }

    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    
    console.log(`Enviando para Gemini (${tipo}) - Arquivo: ${file.name}, Tamanho: ${file.size}`);

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.type || 'image/jpeg', data: base64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    });

    const responseText = result.response.text();
    console.log("Resposta Gemini:", responseText);

    if (!responseText) {
      throw new Error("A IA não retornou nenhum texto.");
    }

    let parsedData = [];
    try {
      parsedData = JSON.parse(responseText);
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON retornado pela IA:', responseText);
      return NextResponse.json({ error: 'A inteligência não conseguiu extrair um formato válido.', raw: responseText }, { status: 500 });
    }

    return NextResponse.json({ dados: parsedData });

  } catch (error: any) {
    console.error('Erro interno na rota do conversor:', error);
    const msg = error.message || "";
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
      return NextResponse.json({ error: 'O sistema da IA está temporariamente sobrecarregado. Tente novamente em instantes.' }, { status: 503 });
    }
    return NextResponse.json({ error: `Erro na leitura: ${msg}` }, { status: 500 });
  }
}
