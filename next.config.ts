import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / runtime-resolved packages that must NOT be bundled by webpack.
  // - @babel/core, @babel/preset-env: dynamic config resolution at runtime
  // - sharp: native .node binary — bundling breaks it on Vercel Linux
  // - pg / pg-native: native PostgreSQL client binaries
  serverExternalPackages: [
    "@babel/core",
    "@babel/preset-env",
    "sharp",
    "pg",
    "pg-native",
  ],
  // The proxy must preserve upstream paths EXACTLY (a trailing slash changes
  // relative-URL resolution on directory documents). Disable Next's
  // automatic slash-stripping redirects.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
