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
  onSuccess:
    "mkdir -p dist/webview && cp src/webview/html/main.js src/webview/html/styles.css dist/webview/ && cp node_modules/@vscode/webview-ui-toolkit/dist/toolkit.js dist/webview/toolkit.js && cp node_modules/marked/lib/marked.umd.js dist/webview/marked.js",
});
