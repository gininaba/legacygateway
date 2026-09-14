import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Babel performs dynamic config/preset resolution at runtime; keep it out
  // of the Turbopack bundle and let Node require it directly.
  serverExternalPackages: ["@babel/core", "@babel/preset-env"],
  // The proxy must preserve upstream paths EXACTLY (a trailing slash changes
  // relative-URL resolution on directory documents). Disable Next's
  // automatic slash-stripping redirects.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
