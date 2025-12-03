import * as pdfjsLib from 'pdfjs-dist';

// --- POLYFILL PARA CORRIGIR ERRO 'Q0' (Promise.withResolvers) ---
// Necessário para pdfjs-dist v4+ em navegadores que ainda não suportam nativamente
if (typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Configura o worker do PDF.js usando UNPKG (mais estável para arquivos estáticos)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export const PdfService = {
  extractText: async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Carrega o documento
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';

      // Itera sobre todas as páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Concatena o texto da página
        const pageText = textContent.items
          // @ts-ignore
          .map((item: any) => item.str)
          .join(' ');
          
        fullText += pageText + '\n\n';
      }

      return fullText;
    } catch (error) {
      console.error("Erro detalhado ao ler PDF:", error);
      throw new Error("Não foi possível ler o arquivo PDF. Verifique se não está corrompido ou protegido por senha.");
    }
  }
};