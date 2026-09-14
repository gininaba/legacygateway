import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / runtime-resolved packages that must NOT be bundled by webpack.
  // sharp uses native binaries; pg is externalized for serverless pool drivers.
  serverExternalPackages: ["@babel/core", "@babel/preset-env", "sharp", "pg"],
  // The proxy must preserve upstream paths EXACTLY (a trailing slash changes
  // relative-URL resolution on directory documents). Disable Next's
  // automatic slash-stripping redirects.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
