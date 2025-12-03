import * as pdfjsLib from 'pdfjs-dist';

// Configura o worker do PDF.js (necessário para processamento)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export const PdfService = {
  extractText: async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      // Itera sobre todas as páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Concatena o texto da página
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
          
        fullText += pageText + '\n\n';
      }

      return fullText;
    } catch (error) {
      console.error("Erro ao ler PDF:", error);
      throw new Error("Não foi possível ler o arquivo PDF.");
    }
  }
};