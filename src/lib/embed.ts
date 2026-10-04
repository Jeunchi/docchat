// Loaded lazily: routes that never embed text never touch the native runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    const { pipeline, env } = await import("@huggingface/transformers");
    // Serverless filesystems are read-only except /tmp, so cache the model there.
    if (process.env.VERCEL) {
      env.cacheDir = "/tmp/transformers-cache";
    }
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