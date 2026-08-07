import { NextRequest, NextResponse } from 'next/server';

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

    if (!process.env.PDF24_API_KEY) {
      return NextResponse.json({ error: 'Chave da API PDF24 não configurada.' }, { status: 500 });
    }

    let questtext = '';

    if (tipo === 'dda') {
      questtext = `Analise a imagem deste DDA (Débito Direto Autorizado) ou boleto e extraia os dados.
Retorne APENAS um JSON estrito no seguinte formato (uma lista de objetos):
[
  {
    "beneficiario": "Nome da empresa/recebedor",
    "documento": "CNPJ, CPF ou código do boleto",
    "valor": 1234.56,
    "data_vencimento": "YYYY-MM-DD"
  }
]
Se houver mais de um pagamento, adicione na lista. Retorne APENAS o JSON, sem nenhuma formatação Markdown (sem \`\`\`json).`;
    } else {
      questtext = `Analise este arquivo de Folha de Pagamento ou Recibo e extraia os pagamentos.
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
Retorne APENAS o JSON, sem nenhuma formatação Markdown (sem \`\`\`json).`;
    }

    const apiFormData = new FormData();
    apiFormData.append('file', file);
    apiFormData.append('questtext', questtext);

    // Endpoint 27 da Cross Service Solutions (PDF24 API) para Extração de Texto com IA
    const response = await fetch('https://api.cross-service-solutions.com/solutions/solutions/api/27', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PDF24_API_KEY}`
        // Não definir Content-Type ao usar FormData no fetch, o navegador/node gerencia o boundary automaticamente
      },
      body: apiFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API PDF24:', errorText);
      return NextResponse.json({ error: 'Falha ao processar arquivo no PDF24.' }, { status: response.status });
    }

    const jsonResult = await response.json();
    
    // O PDF24 geralmente devolve a resposta do LLM dentro de alguma propriedade (ex: output, ou content)
    let llmResponse = jsonResult.output || jsonResult.content || '';
    
    if (typeof llmResponse !== 'string') {
        llmResponse = JSON.stringify(llmResponse);
    }

    try {
      // Tenta achar o JSON array na string usando regex
      const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
          const dadosExtraidos = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ dados: dadosExtraidos });
      } else {
          // Fallback parsing
          let cleaned = llmResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
          const dadosExtraidos = JSON.parse(cleaned);
          return NextResponse.json({ dados: dadosExtraidos });
      }
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON retornado pela IA:', llmResponse);
      return NextResponse.json({ error: 'A inteligência não conseguiu extrair um formato válido.', raw: llmResponse }, { status: 500 });
    }

  } catch (error) {
    console.error('Erro interno na rota do conversor:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
