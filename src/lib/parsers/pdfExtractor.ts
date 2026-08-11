export async function extrairTextoPDF(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  // @ts-expect-error
  GlobalWorkerOptions.workerSrc = false

  const buffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(buffer)
  
  const pdf = await getDocument({ 
      data: uint8, 
      useWorkerFetch: false, 
      isEvalSupported: false, 
      useSystemFonts: true 
  }).promise

  let textoCompleto = ''

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    
    // items tem a estrutura { str: string, transform: [scaleX, skewY, skewX, scaleY, x, y] }
    const items = content.items as any[]
    
    // Agrupar itens por linha (coordenada Y)
    // Usamos um delta de 3 pixels para considerar a mesma linha (já que pode haver leves desalinhamentos)
    const linhasMap = new Map<number, any[]>()
    
    for (const item of items) {
      if (!item.str.trim()) continue
      
      const y = Math.round(item.transform[5])
      
      // Encontrar se já existe uma linha próxima
      let linhaY = y
      for (const key of Array.from(linhasMap.keys())) {
        if (Math.abs(key - y) <= 4) {
          linhaY = key
          break
        }
      }
      
      if (!linhasMap.has(linhaY)) {
        linhasMap.set(linhaY, [])
      }
      linhasMap.get(linhaY)!.push(item)
    }
    
    // Ordenar as linhas de cima para baixo (y decrescente em PDFs geralmente)
    const yOrdenados = Array.from(linhasMap.keys()).sort((a, b) => b - a)
    
    for (const y of yOrdenados) {
      const linhaItems = linhasMap.get(y)!
      // Ordenar os itens da linha da esquerda para a direita (x crescente)
      linhaItems.sort((a, b) => a.transform[4] - b.transform[4])
      
      const textoLinha = linhaItems.map(item => item.str).join('   ')
      textoCompleto += textoLinha + '\n'
    }
  }

  return textoCompleto
}
