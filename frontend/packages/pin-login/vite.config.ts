import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig(({ mode }) => {
  if (mode === "library") {
    return {
      plugins: [
        react(),
        dts({
          include: ["src"],
          rollupTypes: true,
        }),
      ],
      build: {
        lib: {
          entry: resolve(__dirname, "src/index.ts"),
          name: "PinLogin",
          formats: ["es", "umd"],
          fileName: (format) =>
            format === "es" ? "pin-login.js" : "pin-login.umd.cjs",
        },
        rollupOptions: {
          external: ["react", "react-dom", "react/jsx-runtime"],
          output: {
            globals: {
              react: "React",
              "react-dom": "ReactDOM",
              "react/jsx-runtime": "jsxRuntime",
            },
            assetFileNames: "pin-login[extname]",
          },
        },
        cssCodeSplit: false,
      },
    };
  }

  return {
    plugins: [react()],
    root: "demo",
    publicDir: "../prototype/assets",
  };
});
