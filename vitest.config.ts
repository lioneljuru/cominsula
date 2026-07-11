import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["convex/lib/scoring.ts", "convex/lib/limits.ts", "convex/lib/rls.ts"],
      exclude: ["convex/**/*.test.ts"],
      thresholds: {
        lines: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
