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
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/, /packages\/hdwallet-.+\/dist\/.*\.js$/],
      transformMixedEsModules: true,
    },
    target: "esnext",
  },
};

export default config;
