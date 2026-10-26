import path from "path";
import type { NextConfig } from "next";

const isElectronBuild = process.env.ELECTRON_BUILD === "true";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(isElectronBuild && {
    output: "export",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
