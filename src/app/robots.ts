import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      {
        userAgent: [
          "GPTBot",
          "Google-Extended",
          "anthropic-ai",
          "ClaudeBot",
          "CCBot",
          "Applebot-Extended",
          "Meta-ExternalAgent",
          "Bytespider",
        ],
        disallow: "/",
      },
    ],
  };
}
