export type Chunk = {
  content: string;
  pageNumber: number;
  chunkIndex: number;
};

// Chunks the whole document as one word stream so lists and sections that
// run across page breaks stay together. pageNumber = page where the chunk starts.
export function chunkPages(pages: string[], size = 180, overlap = 30): Chunk[] {
  const words: string[] = [];
  const wordPage: number[] = [];

  pages.forEach((text, i) => {
    for (const w of text.replace(/\s+/g, " ").trim().split(" ")) {
      if (w) {
        words.push(w);
        wordPage.push(i + 1);
      }
    }
  });

  const chunks: Chunk[] = [];
  let index = 0;

  for (let start = 0; start < words.length; start += size - overlap) {
    chunks.push({
      content: words.slice(start, start + size).join(" "),
      pageNumber: wordPage[start],
      chunkIndex: index++,
    });
    if (start + size >= words.length) break;
  }

  return chunks;
}