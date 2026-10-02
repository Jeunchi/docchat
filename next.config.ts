import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;