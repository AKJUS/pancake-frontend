import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  // @ts-ignore
  plugins: [tsconfigPaths({ projects: ["tsconfig.test.json"] }), vanillaExtractPlugin()],
  resolve: {
    alias: {
      "@pancakeswap/uikit": r("../../packages/uikit/src"),
      "@pancakeswap/localization": r("../../packages/localization/src"),
    },
  },
  test: {
    dangerouslyIgnoreUnhandledErrors: true, // this.WebSocketClass is not a constructor
    environment: "happy-dom",
    globals: true,
    exclude: ["node_modules"],
  },
});
