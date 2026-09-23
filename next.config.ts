import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        // Cache-busted brand art uses ?v= on mosslingsPublicAsset().
        pathname: "/mosslings/**",
      },
    ],
  },
  // The dev badge otherwise covers the Meteor button in the game HUD.
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/help": ["./HELP.md"],
  },
};

export default nextConfig;
