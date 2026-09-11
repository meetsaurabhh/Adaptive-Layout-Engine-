/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The resolver runs headless via the estimate measurer, so the test suite
    // needs no DOM. Node environment keeps it fast.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
