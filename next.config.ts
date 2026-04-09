import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["kokoro-js", "onnxruntime-node"],
  webpack: (config) => {
    // Prevent bundling Node-only ONNX runtime and sharp on the client/server
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    // Enable async WASM loading required by ONNX runtime
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
