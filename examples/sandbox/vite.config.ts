import { UserConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const config: UserConfig = {
  optimizeDeps: {
    // exclude: ["@hdwallet/*"],
    // include: ["bn.js", "@ethersproject/bignumber"],
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
    sourcemap: false,
    commonjsOptions: {
      include: [/node_modules/, /packages\/hdwallet-.+\/dist\/.*\.js$/],
      // include: [/node_modules/, /packages\/hdwallet-.+\/dist\/.*\.(js|map)$/],
      transformMixedEsModules: true,
      // requireReturnsDefault: "auto",
      // esmExternals: true,
    },
    target: "esnext",
  },
  // resolve: {
  //   alias: {
  //     "bn.js": "bn.js",
  //   },
  // },
};

export default config;
