import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  dts: false,
  clean: true,
  sourcemap: true,
  target: "node20",
  external: ["vscode"],
  noExternal: ["@pr-buildr/core"],
});
