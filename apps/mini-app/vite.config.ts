import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/health": "http://localhost:3001",
      "/practices": "http://localhost:3001",
      "/materials": "http://localhost:3001",
      "/schedule": "http://localhost:3001",
      "/timer": "http://localhost:3001",
      "/diary": "http://localhost:3001",
      "/statistics": "http://localhost:3001",
      "/notifications": "http://localhost:3001",
    },
  },
});
