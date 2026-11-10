// Vitest の設定（node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md に沿ったもの）
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // ブラウザの代わりに jsdom（Node.js 上で動く疑似ブラウザ）を使う
    environment: "jsdom",
    // 各テストの前後に共通で行う処理
    setupFiles: ["./vitest.setup.ts"],
  },
});
