import { embed } from "../src/lib/embed";
import { chunkPages } from "../src/lib/chunk";

const dot = (x: number[], y: number[]) =>
  x.reduce((sum, v, i) => sum + v * y[i], 0);

async function main() {
  const [a, b, c] = await embed([
    "How do I reset my password?",
    "Steps to change your account password",
    "The capital of France is Paris",
  ]);

  console.log("dimensions:", a.length);
  console.log("similar sentences:", dot(a, b).toFixed(3));
  console.log("unrelated sentences:", dot(a, c).toFixed(3));

  const chunks = chunkPages(["word ".repeat(400)]);
  console.log("chunk word counts:", chunks.map((ch) => ch.content.split(" ").length));
}

main();