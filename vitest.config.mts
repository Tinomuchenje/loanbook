import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@convex": fileURLToPath(new URL("./convex", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
