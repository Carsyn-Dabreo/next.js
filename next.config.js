/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Transformers.js / ONNX Runtime contain native binaries. Keep them
    // external to webpack so Next.js does not try to parse .node files.
    serverComponentsExternalPackages: [
      "@huggingface/transformers",
      "onnxruntime-node",
    ],
  },
};

module.exports = nextConfig;
