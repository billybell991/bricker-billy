import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Set base to repo name for GitHub Pages — update this to match your repo name
  base: "/",
});
