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
    
    console.log('PDF24 response keys:', Object.keys(jsonResult));
    console.log('PDF24 full response:', JSON.stringify(jsonResult).substring(0, 500));
    
    // A API pode retornar a resposta em várias propriedades diferentes
    let llmResponse = jsonResult.output || jsonResult.content || jsonResult.result 
      || jsonResult.text || jsonResult.answer || jsonResult.response || jsonResult.data || '';
    
    // Se nenhuma propriedade conhecida, tenta usar o objeto inteiro como string
    if (!llmResponse && typeof jsonResult === 'object') {
      const values = Object.values(jsonResult).filter(v => typeof v === 'string' && v.length > 10);
      if (values.length > 0) {
        llmResponse = values[0] as string;
      }
    }
    
    if (typeof llmResponse !== 'string') {
      // Se já é um array/objeto, tenta usar diretamente
      if (Array.isArray(llmResponse)) {
        return NextResponse.json({ dados: llmResponse });
      }
      llmResponse = JSON.stringify(llmResponse);
    }

    if (!llmResponse || llmResponse === '""' || llmResponse === '{}') {
      return NextResponse.json({ 
        error: 'A API retornou uma resposta vazia. Tente enviar o arquivo novamente.', 
        debug: jsonResult 
      }, { status: 500 });
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
          // Se o resultado é um objeto único (não array), coloca dentro de array
          const dados = Array.isArray(dadosExtraidos) ? dadosExtraidos : [dadosExtraidos];
          return NextResponse.json({ dados });
      }
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON retornado pela IA:', llmResponse);
      return NextResponse.json({ error: 'A inteligência não conseguiu extrair um formato válido.', raw: jsonResult }, { status: 500 });
    }

  } catch (error) {
    console.error('Erro interno na rota do conversor:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
