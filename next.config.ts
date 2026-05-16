import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**/*": ["vector_store.json", "available_documents.json"],
  },
};

export default nextConfig;
