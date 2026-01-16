/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/**/*.ts", "!<rootDir>/**/*.test.ts", "!**/dist/**"],
  coverageDirectory: "<rootDir>/../coverage",
  preset: "ts-jest",
  reporters: ["default", "jest-junit"],
  rootDir: "packages",
  testMatch: ["<rootDir>/**/*.test.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(@shapeshiftoss/bitcoinjs-lib|valibot|@ton/ton|@ton/core|@ton/crypto|axios)/.*)",
  ],
  moduleNameMapper: {
    "^@shapeshiftoss/hdwallet-(.*)": "<rootDir>/hdwallet-$1/src",
    "^valibot$": require.resolve("valibot"),
    "^@ton/ton$": "<rootDir>/hdwallet-native/__mocks__/@ton/ton.js",
  },
  globals: {
    "ts-jest": {
      diagnostics: {
        ignoreCodes: [7016],
      },
    },
  },
  setupFiles: ["fake-indexeddb/auto"],
};
