import { UserConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const config: UserConfig = {
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      supported: {
        bigint: true,
      },
    },
  },
  plugins: [
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
      },
    }),
  ],
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    target: "esnext",
  },
};

export default config;
