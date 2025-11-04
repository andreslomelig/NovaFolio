import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// PDF → texto por página
export async function extractPdfPages(buf: Buffer): Promise<string[]> {
  const pages: string[] = [];
  await pdf(buf, {
    pagerender: async (pageData: any) => {
      const tc = await pageData.getTextContent();
      const text = (tc.items || []).map((i: any) => i.str).join(' ');
      pages.push(text || '');
      return text;
    },
  });
  return pages;
}

// DOCX → todo en una “página 1”
export async function extractDocxPages(buf: Buffer): Promise<string[]> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return [value || ''];
}