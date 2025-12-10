module.exports = {
  collectCoverage: false,
  // collectCoverageFrom: ["<rootDir>/**/*.ts", "!<rootDir>/**/*.test.ts"],
  preset: "ts-jest",
  // reporters: ["default", "jest-junit"],
  rootDir: "./src",
  testEnvironment: "node",
  testMatch: ["<rootDir>/**/*.test.ts"],
  transformIgnorePatterns: ["node_modules/(?!(@shapeshiftoss/bitcoinjs-lib|valibot)/)"],
  moduleNameMapper: {
    "^@ledgerhq/live-network/(.*)$": "@ledgerhq/live-network/lib/$1.js",
    "^@shapeshiftoss/hdwallet-(.*)": "<rootDir>/../../packages/hdwallet-$1/src",
    "^valibot$": require.resolve("valibot"),
    "^axios$": require.resolve("axios"),
    "^@brandonblack/musig/base_crypto$": "<rootDir>/../../node_modules/@brandonblack/musig/lib/base_crypto.js",
  },
  globals: {
    "ts-jest": {
      diagnostics: {
        // TS(7016) "could not find a declaration file for module" occurs when ts-jest is confused about which *.d.ts to pass
        // as input to TypeScript's compilation API. When this happens, noImplicitAny will complain. Disabling this error will
        // suppress it when run under ts-jest; this is OK, because it will still be reported during the normal build process.
        ignoreCodes: [7016],
      },
    },
  },
};
