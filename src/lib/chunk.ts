export type Chunk = {
  content: string;
  pageNumber: number;
  chunkIndex: number;
};

// Splits each page into overlapping word windows.
// Chunks never cross page boundaries, so every citation maps to one page.
export function chunkPages(pages: string[], size = 180, overlap = 30): Chunk[] {
  const chunks: Chunk[] = [];
  let index = 0;

  pages.forEach((text, i) => {
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    for (let start = 0; start < words.length; start += size - overlap) {
      chunks.push({
        content: words.slice(start, start + size).join(" "),
        pageNumber: i + 1,
        chunkIndex: index++,
      });
      if (start + size >= words.length) break;
    }
  });

  return chunks;
}