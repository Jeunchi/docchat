import { pipeline } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

// Returns one 384-number vector per input text (already normalized).
export async function embed(texts: string[]): Promise<number[][]> {
  const model = await getExtractor();
  const results: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const output = await model(texts.slice(i, i + BATCH), {
      pooling: "mean",
      normalize: true,
    });
    results.push(...(output.tolist() as number[][]));
  }
  return results;
}