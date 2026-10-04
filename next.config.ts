import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  // Ship only the Linux x64 onnxruntime binaries (what Vercel runs on) to stay under 250 MB.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/onnxruntime-node/bin/**/linux/x64/**"],
  },
  outputFileTracingExcludes: {
    "/api/**": [
      "./node_modules/onnxruntime-node/bin/**/win32/**",
      "./node_modules/onnxruntime-node/bin/**/darwin/**",
      "./node_modules/onnxruntime-node/bin/**/linux/arm64/**",
    ],
  },
};

export default nextConfig;